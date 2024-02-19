import {
    IdFieldManager
} from "./id-field.js"

import {
    LibFieldManager
} from "./lib-field.js"

import {
    convertFieldToData,
    EditFieldManager
} from "./edit-field.js"

import {
    updateCache
} from "./cache.js"

let pathToExtension

const idField = new IdFieldManager()
const libField = new LibFieldManager()
const editField = new EditFieldManager()

let download = {}

let mode = "lib"
const containers = {}

async function getId(tabId, type) {
    if (type === "url") {
        const tab = await browser.tabs.get(tabId);
        return tab.url;
    }

    const codes = {
        "doi": "elem=document.querySelector('meta[name=\"citation_doi\" i]');"
            + "if (!elem) { elem=document.querySelector('meta[name=\"dc.Identifier\" i][scheme=\"doi\" i]') };"
            + "if (!elem) { elem=document.querySelector('meta[name=\"dc.Identifier\" i]:not([scheme])') };"
            + "if (elem) { elem.getAttribute('content') } else { undefined }",
        "arxiv": "elem=document.querySelector('meta[name=\"citation_arxiv_id\" i]');"
            + "if (elem) { elem.getAttribute('content') } else { undefined }"
    }
    const content = await browser.tabs.executeScript(tabId, { code: codes[type] });

    const names = { "doi": "DOI", "arxiv": "arXiv ID" }
    if (!content || !content[0]) {
        throw new Error(names[type] + " not found");
    }

    let value = content[0]
    if (type === "doi" && value.startsWith("doi:")) { value = value.replace("doi:", "") }
    return value;
}

async function showLibrary(id) {
    switch (mode) {
        case "lib":
            await libField.setFromLibrary(id);
            break;
        case "edit":
            await editField.setAuto(id);
            break;
    }
    return;
}

async function loadTab(tabId, force) {
    const allId = {}
    for (const type of idField.idOptions) {
        try {
            allId[type] = await getId(tabId, type)
        } catch (e) {
            console.log(e.message)
        }
    }
    const focusedType = idField.set(allId, force)
    if (focusedType) {
        switchMode("lib")
        await showLibrary(idField.show(focusedType));
    }
    return;
}

async function switchMode(newMode) {
    mode = newMode
    Object.entries(containers).forEach(([tag, cont]) => {
        if (tag === newMode) {
            cont.hidden = false
        } else {
            cont.hidden = true
        }
    })
    return;
}

window.addEventListener('load', async () => {
    pathToExtension = await fetch(browser.runtime.getURL("config.json")).then((resp) => {
        return resp.json()
    }).then((body) => {
        return body["dir"] + "/"
    });

    browser.tabs.onActivated.addListener(async (info) => { await loadTab(info.tabId) })
    browser.tabs.onUpdated.addListener(async (tabId) => { await loadTab(tabId) })
    document.getElementById("id-get").addEventListener('click', async () => {
        curTab = await browser.tabs.query({ currentWindow: true, active: true });
        await loadTab(curTab[0].id, true);
    })
    document.getElementById("lib-get").addEventListener('click', () => { libField.setFromLibrary(idField.currentId) })
    document.getElementById("lib-edit").addEventListener('click', async () => { switchMode("edit"); await showLibrary(idField.currentId); })
    document.getElementById("edit-get").addEventListener('click', () => { editField.setFromLibrary(idField.currentId).catch((e) => { editField.log(e.message) }) })
    document.getElementById("edit-fetch").addEventListener('click', () => { editField.setFromInternet(idField.currentId).catch((e) => { editField.log(e.message) }) })
    document.getElementById("edit-cancel").addEventListener('click', async () => { switchMode("lib"); await showLibrary(idField.currentId); })
    idField.selector.addEventListener('change', (event) => { showLibrary(idField.show(event.target.value)) })
    Object.values(idField.fields).forEach((field) => {
        field.addEventListener('change', async () => { await showLibrary(idField.currentId); })
    })
    Object.entries(editField.fields).forEach(([key, field]) => {
        field.addEventListener('change', (e) => {
            updateCache(idField.currentId, convertFieldToData(key, e.target))
        })
    })

    document.getElementById("edit-file-pick").addEventListener("click", () => { document.getElementById("edit-file-picker").click() })
    document.getElementById("edit-file-picker").addEventListener("change", async (e) => {
        const filename = e.target.value.replace("C:\\fakepath\\", "")
        await editField.setFilename(filename, "File selected.")
        await updateCache(idField.currentId, { "localfile": filename });
        return;
    })

    browser.downloads.onCreated.addListener(async (item) => {
        if (item.filename.startsWith(pathToExtension + "files/")) {
            const filename = item.filename.replace(pathToExtension + "files/", "")
            await editField.setFilename(filename, "File downloaded to local storage.")
            await updateCache(idField.currentId, { "localfile": filename });
            download[item.id] = idField.currentId;
            return;
        }
    })

    browser.downloads.onChanged.addListener(async (item) => {
        if (item.state && item.state.current === "complete") {
            const id = download[item.id]
            let body = {}
            body[id.type] = id.value
            const focusedType = idField.set(body)
            showLibrary(idField.show(focusedType))
        }
    })

    document.getElementById("page-open").addEventListener('click', () => {
        browser.tabs.create({
            url: browser.runtime.getURL("extension-page/index.html")
        })
    })
    document.getElementById("edit-save").addEventListener('click', () => {
        editField.saveChange(idField.currentId);
    })
    document.getElementById("delete-cache").addEventListener('click', async () => {
        await browser.storage.local.clear();
        await showLibrary(idField.currentId);
    })
})

browser.runtime.onMessage.addListener(async (msg) => {
    const focusedType = idField.set(msg, true);
    console.log(focusedType)
    switchMode("lib")
    await showLibrary(idField.show(focusedType));
})

libField.reset()
editField.reset()

for (const container of document.getElementById("containers").childNodes) {
    if (container.nodeType === 1 && container.tagName.toLowerCase() === "div") {
        containers[container.id.replace("-container", "")] = container
    }
}

switchMode(mode)
let curTab = await browser.tabs.query({ currentWindow: true, active: true });
await loadTab(curTab[0].id);