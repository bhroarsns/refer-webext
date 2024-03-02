import { getQueryScript, queryType } from "./dom-query.js"

async function getCurrentTabId(windowId) {
    let options = { active: true };
    if (windowId) {
        options["windowId"] = windowId
    } else {
        options["currentWindow"] = true
    }
    const curTab = await browser.tabs.query(options);
    return curTab[0].id;
}

async function executeTabQuery(type, returnAttribute, tabId) {
    const content = await browser.tabs.executeScript(tabId ? tabId : await getCurrentTabId(), { code: getQueryScript(type, returnAttribute) });
    if (content && content[0]) {
        return content[0]
    }
    throw new Error(queryType[type] + " not found for this tab.");
}

async function getId(tabId, type) {
    if (type === "url") {
        const tab = await browser.tabs.get(tabId);
        return tab.url.replace("https://", "").replace("http://", "");
    }
    let value = await executeTabQuery(type, "content", tabId);
    if (type === "doi" && value.startsWith("doi:")) { value = value.replace("doi:", "") }
    return value;
}

export {
    executeTabQuery,
    getCurrentTabId,
    getId
}