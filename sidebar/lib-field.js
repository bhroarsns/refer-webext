import { authorStr, formatFileLink, formatString, setValue } from "./util.js"
import { searchLibrary } from "./library.js"
import { getAccessibleStorageURL } from "./storage.js";
import { getCurrentTabId } from "./tabs.js";

async function getContent(key, input) {
    switch (key) {
        case "author":
            if (input[key] && Array.isArray(input[key])) {
                return input[key].map((aut) => { return { link: aut["given"][0] + ", " + aut["family"], text: authorStr(aut) } });
            } else {
                return [];
            }
        case "date":
            if (Array.isArray(input[key])) {
                return formatString(input[key], (array) => { return array.join("-") });
            }
        case "journal":
            return formatString(input["container-title"]);
        case "number":
            return formatString(input['page'] || input['article-number']);
        case "file":
            if (input['localfile']) {
                const filename = input['localfile']
                try {
                    const url = await getAccessibleStorageURL(filename);
                    if (url) {
                        return formatFileLink(url, filename);
                    } else {
                        return filename;
                    }
                } catch {
                    return filename;
                }
            }
        case "tag":
            if (input[key] && Array.isArray(input[key])) {
                return input[key].map((tag) => { return { link: tag, text: tag } });
            } else {
                return [];
            }
        default:
            return formatString(input[key]);
    }
}

class LibFieldManager {
    fields = {};
    logger;
    constructor() {
        for (const node of document.getElementById("lib-fields").children) {
            if (node.tagName.toLowerCase() === "dd") {
                this.fields[node.id.replace("lib-", "")] = node
            }
        }
        this.logger = document.getElementById("lib-log")
    }

    log(msg) {
        setValue(this.logger, msg)
        return;
    }

    reset() {
        this.log("-")
        Object.values(this.fields).forEach((field) => { setValue(field, "") })
        return;
    }

    async setFromLibrary(id) {
        if (!id) {
            return;
        }
        this.reset()
        await searchLibrary(id).then(async (data) => {
            this.log("Found in the local library.")
            return this.fill(data)
        }).catch((e) => {
            console.warn(e)
            this.log("Not found in the local library.")
        })
    }

    async fill(input) {
        if (!input) {
            return;
        }
        for (const key of Object.keys(this.fields)) {
            const content = await getContent(key, input);
            switch (key) {
                case "author":
                case "tag":
                    for (const value of content) {
                        const link = this.fields[key].appendChild(document.createElement("a"));
                        link.innerHTML = value["text"]
                        link.setAttribute("class", "link")
                        link.addEventListener('click', async () => {
                            try {
                                await browser.tabs.sendMessage(await getCurrentTabId(), { method: "fill", key: key, value: value["link"] });
                            } catch {
                                await browser.tabs.create({ url: browser.runtime.getURL("extension-page/index.html") }).then(() => {
                                    return new Promise(resolve => { return setTimeout(resolve, 100) });
                                }).then(() => {
                                    return getCurrentTabId()
                                }).then((tabId) => {
                                    console.log(tabId)
                                    return browser.tabs.sendMessage(tabId, { method: "fill", key: key, value: value["link"] });
                                })
                            }
                        })
                        this.fields[key].appendChild(document.createElement("br"));
                    }
                    break;
                default:
                    setValue(this.fields[key], content)
            }
        }
        return;
    }
}

export { LibFieldManager }