import { authorStr, authorObj, confirmPromise, formatFileLink, formatFilename, formatString, setValue } from "../modules/util.js";
import { getCache, updateCache } from "../modules/cache.js";
import { httpRequest, queryArxivAPI } from "../modules/http.js";
import { parseArxivEntry, queryElementAttribute } from "../modules/dom-query.js";
import { executeTabQuery, getCurrentTabId } from "../modules/tabs.js";
import { searchLibrary } from "../modules/library.js";
import { getAccessibleStorageURL } from "../modules/storage.js";

async function getAbstractFromLink(links) {
    const link = links.find((obj) => { return obj["intended-application"] && obj["intended-application"] === "syndication" && obj["URL"] });
    if (!link) {
        throw new Error("Link for syndication not found in metadata.")
    }
    const linkData = await httpRequest("none", link["URL"], "json");
    if (linkData["data"] && linkData["data"]["abstract"] && linkData["data"]["abstract"]["value"]) {
        return linkData["data"]["abstract"]["value"];
    } else {
        throw new Error("Abstract not found from provided link.")
    }
}

async function getAbstractFromHtmlResponse(doi) {
    const page = await httpRequest("doi", doi, "html");
    console.debug(page.head.children)
    return await queryElementAttribute(page.head, "abstract", "content");
}

async function extractArxivId(dom, givenTitle) {
    const { arxiv, title } = parseArxivEntry(dom);
    if (givenTitle && givenTitle.toLowerCase().replaceAll(/\s+/g, "") === title.toLowerCase().replaceAll(/\s+/g, "")) {
        return arxiv;
    }
    await confirmPromise(
        "arXiv ID " + arxiv + " found, but its title seems to be different from original one.\n"
        + "\n"
        + title.replaceAll(/\s+/g, " ") + "\n"
        + "\n"
        + (givenTitle ? givenTitle.replaceAll(/\s+/g, " ") : "(No title given)") + "\n"
        + "\n"
        + "Are you sure to relate this arXiv ID with this reference?",
        new Error("This arXiv ID denied by user.")
    );
    return arxiv;
}

async function convertDataToField(key, input) {
    switch (key) {
        case "author":
            return formatString(
                input['author'],
                (array) => { return array.map((elem) => { return authorStr(elem) }).join('\n') }
            );
        case "date":
            if (!input["date"]) {
                console.log("aaa")
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
            const filename = input['localfile'] || formatFilename(input);
            try {
                await navigator.clipboard.writeText(filename.replace(".pdf", ""));
            } catch (e) {
                console.warn("On clipboard write: " + e.message)
            }
            try {
                const url = await getAccessibleStorageURL(filename);
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
            return { [key]: field.value.split("\n").map((aut) => { return authorObj(aut) }) }
        case "date":
            return { [key]: field.value.split("-").map((str) => { return Number(str) }) }
        case "journal":
            return { "container-title": field.value }
        case "number":
            return { "pages": field.value }
        case "tag":
            return { [key]: field.value.split("\n") }
        case "file":
            for (const node of field.children) {
                if (node.tagName.toLowerCase === "a") {
                    return { "localfile": node.innerHTML }
                }
            }
        default:
            return { [key]: field.value }
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
        return;
    }

    reset() {
        Object.values(this.fields).forEach((node) => { setValue(node, "") })
        this.log("-")
        return;
    }

    block() {
        Object.values(this.fields).forEach((field) => { field.setAttribute("disabled", "true") })
        return;
    }

    release() {
        Object.values(this.fields).forEach((field) => { field.removeAttribute("disabled") })
        return;
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
            if (data["link"]) {
                this.log("Fetching abstract from provided link...")
                data["abstract"] = await getAbstractFromLink(data["link"]);
                console.info("Fetched abstract from syndication link.")
                return;
            }
        } catch (e) {
            console.warn(e)
        }
        try {
            this.log("Fetching abstract from html response...")
            data["abstract"] = await getAbstractFromHtmlResponse(doi);
            console.info("Fetched abstract from html response.")
            return;
        } catch (e) {
            console.warn(e)
        }
        try {
            this.log("Fetching abstract from current tab...")
            data["abstract"] = await executeTabQuery("abstract", "content")
            console.info("Fetched abstract from current tab.")
            return;
        } catch (e) {
            console.warn(e)
        }
        return;
    }

    async getArxivId(data, doi) {
        const { title, author } = data;
        try {
            this.log("Fetching arXiv ID from current tab...")
            data["arxiv"] = await executeTabQuery("arxiv", "content");
            console.info("Fetched arXiv ID from current tab.")
            return;
        } catch (e) {
            console.warn(e)
        }
        try {
            this.log("Fetching arXiv ID related to this DOI...")
            const entry = await queryArxivAPI("search_query", { "all": doi });
            data["arxiv"] = await extractArxivId(entry, title);
            console.info("Fetched arXiv ID related to DOI.")
            return;
        } catch (e) {
            console.warn(e)
        }
        try {
            if (author && Array.isArray(author)) {
                this.log("Fetching arXiv ID related to this title and authors...")
                const entry = await queryArxivAPI("search_query", {
                    "ti": title,
                    "au": author.map((aut) => { return aut["family"] }).join(" ")
                });
                data["arxiv"] = await extractArxivId(entry, title);
                console.info("Fetched arXiv ID related to author & title.")
                return;
            }
        } catch (e) {
            console.warn(e)
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
            console.warn("Library search: " + e.message)
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
                data = parseArxivEntry(await queryArxivAPI("id_list", [id.value]));
            } else {
                throw new Error("No valid ID type given.");
            }
            this.log("Metadata fetched.")
            await updateCache(id, data);
            await this.fill(id);
            this.release()
            return;
        } catch (e) {
            console.warn("Metadata fetch: " + e.message)
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
            const url = await getAccessibleStorageURL(filename)
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
            await getAccessibleStorageURL(content["localfile"]).then((url) => {
                if (!url) {
                    delete content.localfile
                }
                return;
            }, () => {
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
        try {
            browser.tabs.sendMessage(await getCurrentTabId(), { method: "reload" })
        } catch (e) {
            console.warn(e)
        }
        return;
    }
}

export { convertFieldToData, EditFieldManager }