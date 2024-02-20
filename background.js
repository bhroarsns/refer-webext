function getLibraryURL(id) {
    return browser.runtime.getURL("library/" + id.type + "/" + id.value + ".json");
}

function getStorageURL(filename) {
    return browser.runtime.getURL("files/" + filename)
}

async function searchLibrary(id) {
    const response = await fetch(getLibraryURL(id));
    if (response.ok) {
        const data = await response.json();
        return data;
    }
}

async function isAccessible(url) {
    try {
        return await fetch(url).then((response) => {
            return response.body.getReader().read();
        }).then(() => {
            return true;
        })
    } catch (e) {
        console.log(e)
        return false;
    }
}

async function isAccessibleFile(filename) {
    const url = getStorageURL(filename);
    if (await isAccessible(url)) {
        return url
    } else {
        return;
    }
}

async function redirectId(id) {
    const data = await searchLibrary(id);
    if (data["localfile"]) {
        const url = await isAccessibleFile(data["localfile"])
        const body = {}
        body[id.type] = id.value
        await browser.runtime.sendMessage({ id: body });
        await browser.windows.create({
            type: "detached_panel",
            url: url,
            height: 1080,
            width: 1440
        });
    }
}

async function redirectDoi(details) {
    if (details.requestHeaders.find((header) => header.name === "Accept" && header.value === "application/vnd.citationstyles.csl+json")) {
        return;
    }
    const doi = details.url.replace("https://doi.org/", "").replace("https://dx.doi.org/", "");
    await redirectId({ type: "doi", value: doi })
    return;
}

async function redirectArxiv(details) {
    const full = details.url.replace("https://arxiv.org/abs/", "")
    const version = full.match(/v\d+$/)
    let arxiv = full
    if (version) {
        arxiv = arxiv.replace(version[0], "")
    }
    await redirectId({ type: "arxiv", value: arxiv })
    return;
}

browser.webRequest.onBeforeSendHeaders.addListener(async (details) => {
    try {
        await redirectDoi(details)
    } catch (e) {
        console.log(e.message);
    }
}, { urls: ["https://doi.org/*"] }, ["blocking", "requestHeaders"]);

browser.webRequest.onBeforeSendHeaders.addListener(async (details) => {
    try {
        await redirectDoi(details)
    } catch (e) {
        console.log(e.message);
    }
}, { urls: ["https://dx.doi.org/*"] }, ["blocking", "requestHeaders"]);

browser.webRequest.onBeforeSendHeaders.addListener(async (details) => {
    try {
        await redirectArxiv(details)
    } catch (e) {
        console.log(e.message);
    }
}, { urls: ["https://arxiv.org/abs/*"] }, ["blocking"]);

browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
})