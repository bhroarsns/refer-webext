import { authorStr, formatFileLink, formatLink, setValue } from "../modules/util.js"
import { searchLibrary } from "../modules/library.js"
import { getAccessibleStorageURL } from "../modules/storage.js";
import { getCurrentTabId } from "../modules/tabs.js";

const library = {
    author: {
        assumeArray: true,
        internalLink: true,
        displayName: "Author",
        treatment: (input) => { return input.map((aut) => { return { key: "author", link: aut["given"][0] + ", " + aut["family"], text: authorStr(aut) } }); }
    },
    title: { displayName: "Title", treatment: (input) => { return "<a href='https://scholar.google.co.jp/scholar?q=" + input.replaceAll(/\s+/g, "+") + "' target='_blank' rel='noreferer noopener'>" + input + "</a>" } },
    journal: { displayName: "Journal", dataKeys: ["container-title"] },
    volume: { displayName: "Volume" },
    issue: { displayName: "Issue" },
    number: { displayName: "Number", dataKeys: ["article-number", "page"] },
    date: { assumeArray: true, displayName: "Date", treatment: (input) => { return input.join("-") } },
    doi: { displayName: "DOI", dataKeys: ["doi", "DOI"], treatment: (input) => { return formatLink("doi", input) } },
    arxiv: { displayName: "arXiv ID", treatment: (input) => { return formatLink("arxiv", input) } },
    abstract: { displayName: "Abstract" },
    tag: { assumeArray: true, displayName: "Tag", internalLink: true, treatment: (input) => { return input.map((tag) => { return { key: "tag", link: tag, text: tag } }) } },
    note: { displayName: "Note", treatment: (input) => { return "<p>" + input.replaceAll("\n", "</p><p>") + "</p>" } },
    file: {
        displayName: "File",
        dataKeys: ["localfile", "localfile_suppl"],
        toArray: true,
        treatment: async (input) => {
            let result = []
            for (const file of input) {
                try {
                    const url = await getAccessibleStorageURL(file);
                    if (url) {
                        result.push(formatFileLink(url, file));
                    } else {
                        result.push(file)
                    }
                } catch {
                    result.push(file)
                }
            }
            return result
        }
    }
}

function setInternalLink(node, value) {
    const link = node.appendChild(document.createElement("a"))
    link.innerHTML = value["text"]
    link.setAttribute("class", "link")
    link.addEventListener('click', async () => {
        try {
            await browser.tabs.sendMessage(await getCurrentTabId(), { method: "fill", key: value["key"], value: value["link"] });
        } catch {
            await browser.tabs.create({ url: browser.runtime.getURL("extension-page/index.html") }).then((tab) => {
                return new Promise((resolve, reject) => {
                    return setTimeout(() => { return resolve(tab.id) }, 100)
                })
            }).then((tabId) => {
                return browser.tabs.sendMessage(tabId, { method: "fill", key: value["key"], value: value["link"] });
            })
        }
    })
}

class LibCardManager {
    card;
    fields = {};
    libLink;
    logger;
    locked;
    idToDisplay;
    constructor(libCard) {
        this.card = libCard
        const field = this.card.appendChild(document.createElement("dl"))
        field.setAttribute("class", "card-body")
        for (const libKey in library) {
            const listContent = field.appendChild(document.createElement("div"))
            this.fields[libKey] = listContent
        }
        this.libLink = field.appendChild(document.createElement("div"))
        this.logger = this.card.appendChild(document.createElement("div"))
        this.logger.setAttribute("class", "card-footer")
        this.locked = false;
    }

    log(msg) {
        setValue(this.logger, msg)
        return;
    }

    show() {
        this.card.hidden = false
    }

    hide() {
        this.card.hidden = true
    }

    reset(key) {
        if (key) {
            this.fields[key].innerHTML = ""
            return;
        }
        this.log("-")
        this.libLink.innerHTML = ""
        Object.values(this.fields).forEach((field) => {
            field.innerHTML = ""
        })
        return;
    }

    setField(key, values) {
        const field = this.fields[key]
        const listTitle = field.appendChild(document.createElement("dt"))
        listTitle.innerHTML = library[key].displayName
        for (const value of values) {
            const desc = field.appendChild(document.createElement("dd"))
            if (library[key].internalLink) {
                setInternalLink(desc, value)
                continue;
            }
            desc.innerHTML = value
            continue;
        }
    }

    async fill(id, input) {
        if (!input) {
            return;
        }
        for (const key in library) {
            this.reset(key)
            const lib = library[key]
            let values;
            if (lib.dataKeys) {
                const arr = lib.dataKeys.map((dataKey) => { return input[dataKey] })
                values = lib.toArray ? arr.filter((v) => { return v }) : arr.find((v) => { return v })
            } else {
                values = input[key]
            }
            if (!values || (lib.assumeArray && !Array.isArray(values)) || (Array.isArray(values) && values.length === 0)) {
                continue;
            }
            values = lib.treatment ? await lib.treatment(values) : values;
            values = Array.isArray(values) ? values : [values]
            this.setField(key, values)
        }
        const libLinkTitle = this.libLink.appendChild(document.createElement("dt"));
        libLinkTitle.innerHTML = "Library Link"
        const libLinkDesc = this.libLink.appendChild(document.createElement("dd"));
        libLinkDesc.innerHTML = "<a href='" + browser.runtime.getURL("extension-page/library.html") + "?index=" + id.type + "/" + id.value + "' target='_blank' rel='noreferrer noopener'>" + id.type + "/" + id.value + "</a>"
        return;
    }

    async setFromLibrary(id, force) {
        if (this.locked) {
            console.log("locked!")
            return;
        }
        this.locked = true
        if (!id) {
            this.locked = false
            return;
        }
        if (!force && this.idToDisplay && id.type === this.idToDisplay.type && id.value === this.idToDisplay.value) {
            this.locked = false
            return;
        }
        this.idToDisplay = id
        this.reset()
        await searchLibrary(this.idToDisplay).then(async (data) => {
            this.log("Found in the local library.")
            await this.fill(this.idToDisplay, data)
            this.locked = false
            return;
        }).catch((e) => {
            console.warn(e)
            this.log("Not found in the local library.")
            this.locked = false
            return;
        })
    }
}

export { LibCardManager }