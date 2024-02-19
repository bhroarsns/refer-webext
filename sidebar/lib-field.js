import {
    formatFileLink,
    formatString,
    isAccessibleFile,
    setValue
} from "./util.js"

import {
    searchLibrary
} from "./library.js"

class LibFieldManager {
    fields = {};
    logger;
    constructor() {
        for (const node of document.getElementById("lib-fields").childNodes) {
            if (node.nodeType === 1 && node.tagName.toLowerCase() === "dd") {
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
        }).catch(() => {
            this.log("Not found in the local library.")
        })
    }

    async fill(input) {
        if (!input) {
            return;
        }

        for (const key of Object.keys(this.fields)) {
            switch (key) {
                case "author":
                    setValue(
                        this.fields[key],
                        formatString(
                            input['author'],
                            (array) => {
                                return array.map((elem) => { return elem['given'] + ' ' + elem['family'] }).join('</br>')
                            }
                        )
                    )
                    break;
                case "date":
                    if (Array.isArray(input["date"])) {
                        setValue(this.fields[key], formatString(input["date"], (array) => { return array.join("-") }))
                    } else {
                        setValue(this.fields[key], "")
                    }
                    break;
                case "journal":
                    setValue(this.fields[key], formatString(input["container-title"]))
                    break;
                case "number":
                    setValue(this.fields[key], formatString(input['page'] || input['article-number']))
                    break;
                case "file":
                    if (input['localfile']) {
                        const filename = input['localfile']
                        try {
                            const url = await isAccessibleFile(filename)
                            if (url) {
                                setValue(this.fields[key], formatFileLink(url, filename));
                            } else {
                                setValue(this.fields[key], filename);
                            }
                        } catch {
                            setValue(this.fields[key], filename);
                        }
                    } else {
                        setValue(this.fields[key], "");
                    }
                    break;
                case "tag":
                    setValue(this.fields[key], formatString(input["tag"], (array) => { return array.join("</br>") }))
                    break;
                default:
                    setValue(this.fields[key], formatString(input[key]))
            }
        }
        return;
    }
}

export { LibFieldManager }