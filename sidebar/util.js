import { namingConvention } from "../customize-naming.js";

function authorObj(str) {
    let arr = str.split(" ");
    const family = arr.pop()
    const given = arr.join(" ");
    return {
        "given": given,
        "family": family
    }
}

function authorStr(obj) {
    return obj["given"] + " " + obj["family"]
}

function confirmPromise(message, errorMsg) {
    if (window.confirm(message)) {
        return Promise.resolve();
    }
    return Promise.reject(errorMsg);
}

function formatFileLink(link, filename) {
    return "<a href='" + link + "' target='_blank' rel='noreferrer noopener'>" + filename + "</a>"
}

function formatFilename(input) {
    return namingConvention(
        input["date"],
        input["author"],
        input["title"],
        input["container-title"],
        input["container-title-short"],
        input["volume"],
        input["issue"],
        input["page"],
        input["article-number"]
    );
}

function formatString(obj, fn) {
    return obj ? (fn ? fn(obj) : obj) : ""
}

function idToLabel(id) {
    return id.type + ":" + id.value
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
    authorObj,
    authorStr,
    confirmPromise,
    formatFileLink,
    formatFilename,
    formatString,
    idToLabel,
    setValue
}