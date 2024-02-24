function getLibraryURL(id) {
    return browser.runtime.getURL("library/" + id.type + "/" + id.value + ".json");
}

async function searchLibrary(id) {
    const response = await fetch(getLibraryURL(id));
    if (response.ok) {
        const data = await response.json();
        return data;
    }
}

export {
    searchLibrary
}