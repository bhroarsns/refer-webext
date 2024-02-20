import {
    formatFileLink,
    formatString,
    isAccessibleFile,
    setValue
} from "./util.js"

import { searchLibrary } from "./library.js";
import { getCache, setCache } from "./cache.js";
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
                    const aStr = "" + a[0] + (a[1] > 10 ? a[1] : "0" + a[1]) + (a[2] > 10 ? a[2] : "0" + a[2])
                    const bStr = "" + b[0] + (b[1] > 10 ? b[1] : "0" + b[1]) + (b[2] > 10 ? b[2] : "0" + b[2])
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
                (a) => { return a[0] + "-" + (a[1] > 10 ? a[1] : "0" + a[1]) + "-" + (a[2] > 10 ? a[2] : "0" + a[2]) }
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
            return {
                "author": authors
            }
        case "date":
            const date = field.value.split("-").map((str) => { return Number(str) })
            return {
                "date": date
            }
        case "journal":
            return {
                "container-title": field.value
            }
        case "number":
            return {
                "pages": field.value
            }
        case "tag":
            return {
                "tag": field.value.split("\n")
            }
        case "file":
            for (const node of field.childNodes) {
                if (node.nodeType === 1 && node.tagName.toLowerCase === "a") {
                    return {
                        "localfile": node.innerHTML
                    }
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
        for (const node of document.getElementById("edit-fields").childNodes) {
            if (node.nodeType === 1 && node.tagName.toLowerCase() === "dt") {
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

    async setFromCache(id) {
        if (!id) {
            return;
        }
        this.reset()
        Object.values(this.fields).forEach((field) => { field.setAttribute("disabled", "true") })
        let data = await getCache(id);
        if (data) {
            this.log("Metadata load from cache.")
            await this.fill(data);
            await setCache(id, data);
            Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
            return;
        } else {
            Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
            throw new Error("No cache found for this ID.");
        }
    }

    async setFromInternet(id) {
        if (!id) {
            return;
        }
        this.reset()
        Object.values(this.fields).forEach((field) => { field.setAttribute("disabled", "true") })
        this.log("Fetching from internet...")

        try {
            if (id.type === "doi") {
                const response = await fetch(
                    "https://doi.org/" + id.value,
                    { headers: { "Accept": "application/vnd.citationstyles.csl+json" } }
                );
                let data = await response.json();
                this.log("Metadata fetched.")
                await this.fill(data);
                await setCache(id, data);
                Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
                return;
            } else if (id.type === "arxiv") {
                const response = await fetch(
                    "https://export.arxiv.org/api/query?id_list=" + id.value,
                    { headers: { "Accept": "application/xml" } }
                );
                let data = await response.text().then((text) => {
                    const parser = new DOMParser();
                    const content = parser.parseFromString(text, "application/xml");
                    if (content.querySelector("parseerror")) {
                        throw new Error("Error on parse.");
                    } else {
                        const metadata = content.documentElement.querySelector("entry");
                        if (metadata) {
                            const date = metadata.querySelector("published").innerHTML.slice(0, 10).split("-").map((str) => { return Number(str) });
                            const title = metadata.querySelector("title").innerHTML.replaceAll("\n", "");
                            const authors = metadata.querySelectorAll("author");
                            const author = [];
                            for (const aut of authors) {
                                let name = aut.querySelector("name").innerHTML.split(' ');
                                const family = name.pop();
                                const given = name.join(' ');
                                author.push({ given: given, family: family })
                            }
                            return {
                                created: { "date-parts": [date] },
                                title: title,
                                author: author,
                                "container-title": "arXiv",
                                "article-number": id.value
                            }
                        } else {
                            throw new Error("Error on parse.")
                        }
                    }
                });
                this.log("Metadata fetched.")
                await this.fill(data);
                await setCache(id, data);
                Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
                return;
            } else {
                Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
                throw new Error("No valid ID type given.");
            }
        } catch (e) {
            console.log(e)
            Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
            throw new Error("Failed to fetch metadata.")
        }
    }

    async setFromLibrary(id) {
        if (!id) {
            return;
        }
        this.reset()
        Object.values(this.fields).forEach((field) => { field.setAttribute("disabled", "true") })
        return searchLibrary(id).then(async (data) => {
            this.log("Found in the local library.")
            await this.fill(data);
            await setCache(id, data);
            Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
            return;
        }).catch(() => {
            Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
            throw new Error("Not found in the local library.")
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
        if (!id) {
            return;
        }
        if (!id["value"] || id["value"] === "") {
            return;
        }

        let content = await getCache(id);
        if (!content) {
            return;
        }
        if (content["localfile"]) {
            try {
                const url = await isAccessibleFile(content["localfile"])
                if (!url) {
                    delete content.localfile
                }
            } catch {
                delete content.localfile
            }
        }
        let body = {};
        if (content) {
            body = {
                "type": id.type,
                "value": id.value,
                "content": content
            };
        }
        const msg = await browser.runtime.sendNativeMessage("refer_mklib", body)
        this.log(msg)
        return;
    }

    async fill(input) {
        if (!input) {
            return;
        }

        for (const key of Object.keys(this.fields)) {
            setValue(this.fields[key], await convertDataToField(key, input))
        }
        return input;
    }
}

export { convertFieldToData, EditFieldManager }