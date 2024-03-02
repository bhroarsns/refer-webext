import { setValue } from "../modules/util.js"

class IdFieldManager {
    selector;
    fields = {};
    idOptions = [];
    index;
    constructor() {
        this.selector = document.getElementById("id-type");
        for (const node of document.getElementById("id-fields").children) {
            this.fields[node.id.replace("id-", "")] = node;
        }
        for (const opt of this.selector.options) {
            this.idOptions.push(opt.value)
        }
        this.index = fetch(browser.runtime.getURL("library/index.json")).then((resp) => { return resp.json() })
        setValue(this.selector, "url")
        this.show("url")
    }

    get currentId() {
        const type = this.selector.value
        return { type: type, value: this.fields[type].value };
    }

    async set(allId, force) {
        let keys = Object.keys(allId)
        if (keys.filter((key) => { return key !== "url" }).length === 0) {
            if (allId["url"] && allId["url"].startsWith("moz-extension://")) {
                const url = new URL(allId["url"])
                const filename = url.pathname.replace(/^\/files\//g, "");
                if (!filename) {
                    return;
                }
                const libInd = Object.values(await this.index).find((lib) => { return lib["file"] && lib["file"] === filename })
                if (!libInd) {
                    return;
                }
                allId["url"] = libInd["url"] || allId["url"]
                allId["doi"] = libInd["doi"]
                allId["arxiv"] = libInd["arxiv"]
                keys = Object.keys(allId)
            } else {
                if (!force) {
                    return;
                }
                if (allId["url"] && allId["url"].startsWith("about:")) {
                    return;
                }
            }
        }

        Object.values(this.fields).forEach((node) => { setValue(node, "") })
        for (let i = 0; i < keys.length; i++) {
            setValue(this.fields[keys[i]], allId[keys[i]])
        }

        for (let i = 0; i < this.idOptions.length; i++) {
            if (allId[this.idOptions[i]]) {
                setValue(this.selector, this.idOptions[i])
                return this.idOptions[i]
            }
        }

        setValue(this.selector, "url")
        return "url"
    }

    show(type) {
        if (!type) {
            return;
        }

        let value;
        for (const [key, node] of Object.entries(this.fields)) {
            if (key === type) {
                node.hidden = false
                value = node.value
            } else {
                node.hidden = true
            }
        }

        return { type: type, value: value };
    }
}

export { IdFieldManager }