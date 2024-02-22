function getStorageURL(filename) {
    return browser.runtime.getURL("files/" + filename)
}

async function isAccessible(url) {
    try {
        return await fetch(url).then((response) => {
            return response.body.getReader().read();
        }).then(() => {
            return true;
        })
    } catch (e) {
        console.info("File not found in the storage.")
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

export {
    getAccessibleStorageURL
}