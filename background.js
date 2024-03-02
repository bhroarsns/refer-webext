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
        console.warn("File not found in the storage.")
        return false;
    }
}

async function getAccessibleStorageURL(filename) {
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
        const url = await getAccessibleStorageURL(data["localfile"]);
        await browser.runtime.sendMessage({ id: { [id.type]: id.value } }).finally(() => {
            return browser.tabs.create({ url: url });
        })
    }
}

async function redirectDoi(details) {
    if (details.requestHeaders && details.requestHeaders.find((header) => header.name.toLowerCase() === "user-agent" && header.value === "refer-webext")) {
        return;
    }
    const doi = details.url.replace("https://doi.org/", "").replace("https://dx.doi.org/", "");
    await redirectId({ type: "doi", value: doi })
    return;
}

async function redirectArxiv(details) {
    console.log(details)
    if (details.requestHeaders && details.requestHeaders.find((header) => header.name.toLowerCase() === "user-agent" && header.value === "refer-webext")) {
        return;
    }
    const arxiv = details.url.replace("https://arxiv.org/abs/", "").replace(/v\d+$/g, "")
    await redirectId({ type: "arxiv", value: arxiv })
    return;
}

browser.webRequest.onBeforeSendHeaders.addListener(async (details) => {
    try {
        await redirectDoi(details)
    } catch (e) {
        console.error("On redirect DOI: " + e.message);
    }
}, { urls: ["https://doi.org/*"] }, ["blocking", "requestHeaders"]);

browser.webRequest.onBeforeSendHeaders.addListener(async (details) => {
    try {
        await redirectDoi(details)
    } catch (e) {
        console.error("On redirect DOI: " + e.message);
    }
}, { urls: ["https://dx.doi.org/*"] }, ["blocking", "requestHeaders"]);

browser.webRequest.onBeforeSendHeaders.addListener(async (details) => {
    try {
        await redirectArxiv(details)
    } catch (e) {
        console.error("On redirect arXiv: " + e.message);
    }
}, { urls: ["https://arxiv.org/abs/*"] }, ["blocking"]);

browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open()
})

browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
        contexts: ["link"],
        title: "Analyze link",
        id: "link_analyze",
        onclick: async (target) => {
            await browser.sidebarAction.open().then(() => {
                return new Promise((resolve, reject) => { setTimeout(resolve, 100) });
            });
            const linkUrl = target["linkUrl"];
            if (linkUrl) {
                if (linkUrl.startsWith("https://doi.org/")) {
                    const doi = linkUrl.replace("https://doi.org/", "");
                    await browser.runtime.sendMessage({ id: { doi: doi } });
                    return;
                } else if (linkUrl.startsWith("https://dx.doi.org/")) {
                    const doi = linkUrl.replace("https://dx.doi.org/", "");
                    await browser.runtime.sendMessage({ id: { doi: doi } });
                    return;
                } else if (linkUrl.startsWith("http://doi.org/")) {
                    const doi = linkUrl.replace("http://doi.org/", "");
                    await browser.runtime.sendMessage({ id: { doi: doi } });
                    return;
                } else if (linkUrl.startsWith("http://dx.doi.org/")) {
                    const doi = linkUrl.replace("http://dx.doi.org/", "");
                    await browser.runtime.sendMessage({ id: { doi: doi } });
                    return;
                } else if (linkUrl.startsWith("https://arxiv.org/abs/")) {
                    const arxiv = linkUrl.replace("https://arxiv.org/abs/", "");
                    await browser.runtime.sendMessage({ id: { arxiv: arxiv } });
                    return;
                } else if (linkUrl.startsWith("http://arxiv.org/abs/")) {
                    const arxiv = linkUrl.replace("http://arxiv.org/abs/", "");
                    await browser.runtime.sendMessage({ id: { arxiv: arxiv } });
                    return;
                } else {
                    const response = await fetch(linkUrl, { headers: { "User-Agent": "refer-webext" } });
                    const body = await response.text();
                    const parser = new DOMParser();
                    const page = parser.parseFromString(body, "text/html");
                    const doiMeta = page.querySelector("meta[name=\"citation_doi\" i]") || page.querySelector("meta[name=\"dc.identifier\" i][scheme=\"doi\" i]") || page.querySelector("meta[name=\"dc.identifier\" i]:not([scheme])")
                    if (doiMeta) {
                        const doi = doiMeta.getAttribute("content")
                        if (doi) {
                            await browser.runtime.sendMessage({ id: { doi: doi } });
                            return;
                        }
                    }
                    console.warn("DOI not found.")
                    const arxivMeta = page.querySelector("meta[name=\"citation_arxiv_id\" i]")
                    if (arxivMeta) {
                        const arxiv = arxivMeta.getAttribute("content")
                        if (arxiv) {
                            await browser.runtime.sendMessage({ id: { arxiv: arxiv } });
                            return;
                        }
                    }
                    console.warn("arXiv ID not found.")
                    await browser.runtime.sendMessage({ id: { url: linkUrl } });
                    return;
                }
            }
        }
    });

    browser.contextMenus.create({
        contexts: ["selection"],
        title: "Treat selection as DOI",
        id: "selection_doi",
    });
    browser.contextMenus.create({
        contexts: ["selection"],
        title: "Treat selection as arXiv ID",
        id: "selection_arxiv",
    })
    browser.contextMenus.onClicked.addListener(async (info) => {
        console.log(info)
        if (info.menuItemId === "selection_doi") {
            await browser.runtime.sendMessage({ id: { doi: info.selectionText } });
            return;
        }
        if (info.menuItemId === "selection_arxiv") {
            await browser.runtime.sendMessage({ id: { arxiv: info.selectionText } });
            return;
        }
    })
})