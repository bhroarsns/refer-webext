import {
    formatFileLink,
    formatString,
    isAccessibleFile,
    setValue
} from "./util.js"

import { searchLibrary } from "./library.js";
import { getCache, updateCache } from "./cache.js";
import { namingConvention } from "../customize-naming.js";

function formatFilename(input) {
    return namingConvention(
        input["date"],
        input["author"],
        input["title"],
        input["container-title"],
        input["container-title-short"],
        input["volume"],
        input["issue"],
        input["page"],
        input["article-number"]
    );
}

async function httpRequest(key, value, format) {
    const prefix = {
        "doi": "https://doi.org/",
        "arxiv_api": "https://export.arxiv.org/api/query?",
        "none": ""
    }
    let headers = { "User-Agent": "refer-webext" }
    switch (format) {
        case "csl":
            headers["Accept"] = "application/vnd.citationstyles.csl+json"
            break;
        case "xml":
            headers["Accept"] = "application/xml"
            break;
    }

    const response = await fetch(prefix[key] + value, { headers: headers });
    if (!response.ok) {
        throw new Error("Request failed.")
    }

    const type = { "xml": "application/xml", "html": "text/html" }
    switch (format) {
        case "csl":
        case "json":
            return await response.json();
        case "xml":
        case "html":
            const text = await response.text();
            const parser = new DOMParser();
            const content = parser.parseFromString(text, type[format])
            if (content.querySelector("parseerror")) {
                throw new Error("Error on parse.");
            }
            return content;
        default:
            return await response.text();
    }
}

async function queryArxivAPI(method, value) {
    const content = await httpRequest("arxiv_api", method + "=" + value, "xml")
    return content.documentElement.querySelector("entry");
}

async function getAbstractFromLink(data) {
    if (!data["link"]) {
        throw new Error("Link not found in metadata.")
    }
    const link = data["link"].find((obj) => { return obj["intended-application"] && obj["intended-application"] === "syndication" && obj["URL"] });
    if (!link) {
        throw new Error("Link for syndication not found in metadata.")
    }
    const linkData = await httpRequest("none", link["URL"], "json");
    if (linkData["data"] && linkData["data"]["abstract"] && linkData["data"]["abstract"]["value"]) {
        data["abstract"] = linkData["data"]["abstract"]["value"]
        return;
    } else {
        throw new Error("Abstract not found from provided link.")
    }
}

async function getAbstractFromHtmlResponse(data, doi) {
    const page = await httpRequest("doi", doi, "json");
    const meta = page.querySelector("meta[property=\'og:description\' i]") || page.querySelector("meta[name=\'description\' i]");
    if (meta) {
        data["abstract"] = meta.getAttribute("content")
        return;
    } else {
        throw new Error("Abstract not found from html response.");
    }
}

async function getAbstractFromCurrentTab(data) {
    const curTab = await browser.tabs.query({ currentWindow: true, active: true });
    const content = await browser.tabs.executeScript(
        curTab[0].id,
        {
            code: "let elem = document.querySelector('meta[property=\"og:description\" i]') || document.querySelector('meta[name=\"description\" i]');"
                + "(elem ? elem.getAttribute('content') : elem);"
        }
    )
    if (content && content[0]) {
        data["abstract"] = content[0]
        return;
    } else {
        throw new Error("Abstract not found from current tab.");
    }
}

async function extractArxivId(dom) {
    const node = dom.querySelector("id");
    if (!node) {
        throw new Error("No arXiv ID related to this DOI.")
    }
    const full = node.innerHTML.split("/").pop()
    const version = full.match(/v\d+$/)
    let arxiv = full
    if (version) {
        arxiv = arxiv.replace(version[0], "")
    }
    return arxiv
}

async function convertDataToField(key, input) {
    switch (key) {
        case "author":
            return formatString(
                input['author'],
                (array) => { return array.map((elem) => { return elem['given'] + ' ' + elem['family'] }).join('\n') }
            );
        case "date":
            if (!input["date"]) {
                const dateKeys = ["published", "published-online", "published-print", "issued", "created", "deposited"]
                let candidates = []
                for (const key of dateKeys) {
                    if (input[key] && input[key]["date-parts"] && input[key]["date-parts"][0] && Array.isArray(input[key]["date-parts"][0])) {
                        candidates.push(input[key]["date-parts"][0])
                    }
                }
                candidates.forEach((arr) => {
                    for (let i = 0; i < 3 - arr.length; i++) {
                        arr.push(1)
                    }
                })
                candidates.sort((a, b) => {
                    const aStr = "" + a[0] + (a[1] < 10 ? "0" + a[1] : a[1]) + (a[2] < 10 ? "0" + a[2] : a[2])
                    const bStr = "" + b[0] + (b[1] < 10 ? "0" + b[1] : b[1]) + (b[2] < 10 ? "0" + b[2] : b[2])
                    if (aStr < bStr) {
                        return -1
                    } else if (aStr > bStr) {
                        return 1
                    } else {
                        return 0
                    }
                })
                input["date"] = candidates[0]
            }
            return formatString(
                input["date"],
                (a) => { return a[0] + "-" + (a[1] < 10 ? "0" + a[1] : a[1]) + "-" + (a[2] < 10 ? "0" + a[2] : a[2]) }
            )
        case "journal":
            return formatString(input["container-title"]);
        case "number":
            return formatString(input['page'] || input['article-number']);
        case "file":
            const filename = input['localfile'] ? input['localfile'] : formatFilename(input);
            try {
                await navigator.clipboard.writeText(filename.replace(".pdf", ""));
            } catch (e) {
                console.log(e)
            }
            try {
                const url = await isAccessibleFile(filename);
                if (url) {
                    input['localfile'] = filename
                    return formatFileLink(url, filename);
                } else {
                    return filename;
                }
            } catch (e) {
                return filename;
            }
        case "tag":
            return formatString(input["tag"], (array) => { return array.join("\n") });
        default:
            return formatString(input[key]);
    }
}

function convertFieldToData(key, field) {
    switch (key) {
        case "author":
            const authors = field.value.split("\n").map((aut) => {
                let array = aut.split(" ")
                const family = array.pop();
                const given = array.join(" ");
                return { given: given, family: family }
            })
            return { "author": authors }
        case "date":
            const date = field.value.split("-").map((str) => { return Number(str) })
            return { "date": date }
        case "journal":
            return { "container-title": field.value }
        case "number":
            return { "pages": field.value }
        case "tag":
            return { "tag": field.value.split("\n") }
        case "file":
            for (const node of field.children) {
                if (node.tagName.toLowerCase === "a") {
                    return { "localfile": node.innerHTML }
                }
            }
        default:
            let body = {}
            body[key] = field.value
            return body
    }
}

class EditFieldManager {
    fields = {};
    logger;
    constructor() {
        for (const node of document.getElementById("edit-fields").children) {
            if (node.tagName.toLowerCase() === "dt") {
                const fieldKey = node.id.replace("edit-", "").replace("-head", "")
                const field = document.getElementById("edit-" + fieldKey)
                this.fields[fieldKey] = field
            }
        }
        this.logger = document.getElementById("edit-log")
    }

    log(msg) {
        setValue(this.logger, msg)
    }

    reset() {
        Object.values(this.fields).forEach((node) => { setValue(node, "") })
        this.log("-")
        return;
    }

    block() {
        Object.values(this.fields).forEach((field) => { field.setAttribute("disabled", "true") })
    }

    release() {
        Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
    }

    async fill(id) {
        let cache = await getCache(id);
        if (!cache) {
            throw new Error("No cache found for this ID.")
        }
        for (const key of Object.keys(this.fields)) {
            setValue(this.fields[key], await convertDataToField(key, cache));
        }
        await updateCache(id, cache);
        return;
    }

    async setFromCache(id) {
        if (!id) {
            return;
        }
        this.block()
        this.reset()
        await this.fill(id);
        this.log("Metadata load from cache.")
        this.release()
        return;
    }

    async getAbstract(data, doi) {
        try {
            this.log("Fetching abstract from provided link...")
            await getAbstractFromLink(data);
            return;
        } catch (e) {
            console.log(e)
        }
        try {
            this.log("Fetching abstract from html response...")
            await getAbstractFromHtmlResponse(data, doi);
            return;
        } catch (e) {
            console.log(e)
        }
        try {
            this.log("Fetching abstract from current tab...")
            await getAbstractFromCurrentTab(data);
            return;
        } catch (e) {
            console.log(e)
        }
        return;
    }

    async getArxivId(data, doi) {
        try {
            this.log("Fetching arXiv ID related to this DOI...")
            let raw = await queryArxivAPI("search_query", "all:" + doi);
            if (!raw) {
                throw new Error("No arXiv ID related to this DOI.")
            }
            data["arxiv"] = await extractArxivId(raw);
            return;
        } catch (e) {
            console.log(e)
        }
        try {
            if (data["title"]) {
                this.log("Fetching arXiv ID related to this title...")
                raw = await queryArxivAPI("search_query", "ti:" + data["title"].replace(" ", "+"));
                if (!raw) {
                    throw new Error("No arXiv ID related to this title.");
                }
                data["arxiv"] = await extractArxivId(raw);
                return;
            }
        } catch (e) {
            console.log(e)
        }
        return;
    }

    async getFromDoi(doi) {
        let data = await httpRequest("doi", doi, "csl");
        if (!data["abstract"]) {
            await this.getAbstract(data, doi);
        }
        if (!data["arxiv"]) {
            await this.getArxivId(data, doi);
        }
        return data;
    }

    async getFromArxiv(arxiv) {
        const raw = await queryArxivAPI("id_list", arxiv);
        if (!raw) {
            throw new Error("arXiv ID not found.")
        }
        const authors = raw.querySelectorAll("author");
        const author = [];
        for (const aut of authors) {
            let name = aut.querySelector("name").innerHTML.split(' ');
            const family = name.pop();
            const given = name.join(' ');
            author.push({ given: given, family: family })
        }
        return {
            created: {
                "date-parts": [
                    raw.querySelector("published").innerHTML.slice(0, 10).split("-").map((str) => { return Number(str) })
                ]
            },
            title: raw.querySelector("title").innerHTML.replaceAll("\n", ""),
            abstract: raw.querySelector("summary").innerHTML,
            author: author,
            "container-title": "arXiv",
            "article-number": arxiv,
            "arxiv": arxiv
        }
    }

    async setFromLibrary(id) {
        if (!id) {
            return;
        }
        this.block()
        this.reset()
        try {
            const data = await searchLibrary(id);
            this.log("Found in the local library.")
            await updateCache(id, data);
            await this.fill(id);
            this.release()
            return;
        } catch (e) {
            console.log(e)
            this.release()
            throw new Error("Not found in the local library.")
        }
    }

    async setFromInternet(id) {
        if (!id) {
            return;
        }
        this.block()
        this.reset()
        this.log("Fetching from internet...")
        try {
            let data;
            if (id.type === "doi") {
                data = await this.getFromDoi(id.value);
            } else if (id.type === "arxiv") {
                data = await this.getFromArxiv(id.value);
            } else {
                throw new Error("No valid ID type given.");
            }
            this.log("Metadata fetched.")
            await updateCache(id, data);
            await this.fill(id);
            this.release()
            return;
        } catch (e) {
            console.log(e)
            this.release()
            throw new Error("Failed to fetch metadata.")
        }
    }

    setAuto(id) {
        if (!id) {
            return;
        }
        return this.setFromCache(id).catch(() => {
            this.log("No cache found for this ID. Start searching in the local library...")
            return this.setFromLibrary(id)
        }).catch(() => {
            this.log("Not found in the local library. Feting from internet...")
            return this.setFromInternet(id)
        }).catch(() => {
            this.log("Failed to fetch metadata.")
        })
    }

    async setFilename(filename, message) {
        try {
            const url = await isAccessibleFile(filename)
            if (url) {
                setValue(this.fields["file"], formatFileLink(url, filename));
            } else {
                setValue(this.fields["file"], filename);
            }
        } catch {
            setValue(this.fields["file"], filename);
        }
        this.log(message)
        return;
    }

    async saveChange(id) {
        if (!id || !id["value"]) {
            return;
        }
        let content = await getCache(id);
        if (!content) {
            return;
        }
        if (content["localfile"]) {
            await isAccessibleFile(content["localfile"]).then((url) => {
                if (!url) {
                    delete content.localfile
                }
                return;
            }, (e) => {
                console.log(e)
                delete content.localfile
                return;
            });
        }
        const msg = await browser.runtime.sendNativeMessage("refer_mklib", {
            "type": id.type,
            "value": id.value,
            "content": content
        })
        this.log(msg)
        return;
    }
}

export { convertFieldToData, EditFieldManager }