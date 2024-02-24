import { IdFieldManager } from "./id-field.js"
import { LibCardManager } from "./lib-card.js"
import { convertFieldToData, EditFieldManager } from "./edit-field.js"
import { clearCache, updateCache } from "../modules/cache.js"
import { confirmPromise } from "../modules/util.js"
import { getCurrentTabId, getId } from "../modules/tabs.js"

let pathToExtension
let extensionName

let idField
let libCard
let editField

let download = {}

let mode = "lib"
const containers = {}

async function showLibrary(id) {
    if (mode === "lib") {
        await libCard.setFromLibrary(id);
    } else if (mode === "edit") {
        await editField.setAuto(id);
    }
    return;
}

async function loadTab(tabId, force) {
    const allId = {}
    for (const type of idField.idOptions) {
        try {
            allId[type] = await getId(tabId, type)
        } catch (e) {
            console.warn(e.message)
        }
    }
    const focusedType = idField.set(allId, force)
    if (focusedType) {
        switchMode("lib")
        await showLibrary(idField.show(focusedType));
    }
    return;
}

function switchMode(newMode) {
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
    await fetch(browser.runtime.getURL("config.json")).then((resp) => {
        return resp.json()
    }).then((body) => {
        pathToExtension = body["dir"] + "/"
        extensionName = body["name"]
        return;
    });

    for (const container of document.getElementById("containers").children) {
        if (container.tagName.toLowerCase() === "div") {
            containers[container.id.replace("-container", "")] = container
        }
    }

    idField = new IdFieldManager()
    libCard = new LibCardManager(document.getElementById("lib"))
    editField = new EditFieldManager()

    browser.tabs.onActivated.addListener(async (info) => { await loadTab(info.tabId) })
    browser.tabs.onUpdated.addListener(async (tabId) => { await loadTab(tabId) })
    browser.windows.onFocusChanged.addListener(async (windowId) => { await loadTab(await getCurrentTabId(windowId)); })
    browser.downloads.onCreated.addListener(async (item) => {
        console.debug(item)
        if (item.filename.startsWith(pathToExtension + "files/")) {
            const filename = item.filename.replace(pathToExtension + "files/", "")
            await editField.setFilename(filename, "File downloaded to local storage.")
            await updateCache(idField.currentId, { "localfile": filename });
            download[item.id] = idField.currentId;
            return;
        } else {
            await browser.downloads.pause(item.id).then(() => {
                return confirmPromise("Move file to the storage?");
            }).then(async () => {
                return await browser.downloads.cancel(item.id).finally(() => {
                    return browser.downloads.erase({ id: item.id });
                }).finally(() => {
                    return browser.downloads.download({
                        url: item.url,
                        saveAs: true
                    });
                }).catch(() => {
                    alert(extensionName + " cannot handle this file. Choose the correct storage directory or turn off " + extensionName + ".")
                });
            }, async () => {
                await browser.downloads.resume(item.id).catch(() => {
                    alert("Turn off " + extensionName + " to put this file outside the storage.")
                    return browser.downloads.erase({ id: item.id });
                });
                return;
            })
        }
    })
    browser.downloads.onChanged.addListener(async (item) => {
        const id = download[item.id]
        if (id) {
            if (item.state && item.state.current === "complete") {
                showLibrary(idField.show(idField.set({ [id.type]: id.value })))
            }
        }
    })

    document.getElementById("id-get").addEventListener('click', async () => { await loadTab(await getCurrentTabId(), true); })
    document.getElementById("lib-get").addEventListener('click', () => { libCard.setFromLibrary(idField.currentId) })
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
    document.getElementById("page-open").addEventListener('click', () => {
        browser.tabs.create({ url: browser.runtime.getURL("extension-page/index.html") })
    })
    document.getElementById("edit-save").addEventListener('click', async () => {
        await confirmPromise("Do you want to save the changes?");
        await editField.saveChange(idField.currentId);
    })
    document.getElementById("edit-delete").addEventListener('click', async () => {
        await confirmPromise("Deleting this entry from library. Are you sure?");
        const id = idField.currentId;
        const msg = await browser.runtime.sendNativeMessage("refer_mklib", {
            "type": id.type,
            "value": id.value,
            "content": "delete"
        });
        console.info("Delete message: " + msg)
        return;
    })
    document.getElementById("delete-cache").addEventListener('click', async () => {
        await clearCache();
        await showLibrary(idField.currentId);
    })

    switchMode(mode)
    libCard.reset()
    editField.reset()
    await clearCache();
    await loadTab(await getCurrentTabId());
})

browser.runtime.onMessage.addListener(async (msg) => {
    switchMode(msg["mode"] ? msg["mode"] : "lib")
    await showLibrary(idField.show(idField.set(msg["id"], true)));
})