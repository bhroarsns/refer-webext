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

function formatString(obj, fn) {
    return obj ? (fn ? fn(obj) : obj) : ""
}

function getStorageURL(filename) {
    return browser.runtime.getURL("files/" + filename)
}

function formatFileLink(link, filename) {
    return "<a href='" + link + "' target='_blank' rel='noreferrer noopener'>" + filename + "</a>"
}

function setValue(element, value) {
    if (element.nodeType === 1) {
        switch (element.tagName.toLowerCase()) {
            case "div":
                element.innerHTML = value
                return;
            case "dd":
                element.innerHTML = value
                return;
            default:
                element.value = value
                return;
        }
    }
}

export {
    formatFileLink,
    formatString,
    isAccessibleFile,
    getStorageURL,
    isAccessible,
    setValue
}