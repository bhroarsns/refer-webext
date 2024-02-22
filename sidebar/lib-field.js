import { authorStr, formatFileLink, formatString, setValue } from "./util.js"
import { searchLibrary } from "./library.js"
import { getAccessibleStorageURL } from "./storage.js";

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
            let valueText = ""
            switch (key) {
                case "author":
                    valueText = formatString(input[key], (array) => { return array.map((elem) => { return authorStr(elem) }).join('</br>') })
                    break;
                case "date":
                    if (Array.isArray(input[key])) {
                        valueText = formatString(input[key], (array) => { return array.join("-") })
                    }
                    break;
                case "journal":
                    valueText = formatString(input["container-title"])
                    break;
                case "number":
                    valueText = formatString(input['page'] || input['article-number'])
                    break;
                case "file":
                    if (input['localfile']) {
                        const filename = input['localfile']
                        try {
                            const url = await getAccessibleStorageURL(filename)
                            if (url) {
                                valueText = formatFileLink(url, filename);
                            } else {
                                valueText = filename;
                            }
                        } catch {
                            valueText = filename;
                        }
                    }
                    break;
                case "tag":
                    valueText = formatString(input[key], (array) => { return array.join("</br>") })
                    break;
                default:
                    valueText = formatString(input[key])
            }
            setValue(this.fields[key], valueText)
        }
        return;
    }
}

export { LibFieldManager }