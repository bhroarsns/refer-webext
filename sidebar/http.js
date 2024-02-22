async function httpRequest(key, value, format) {
    const prefix = {
        "doi": "https://doi.org/",
        "arxiv_api": "https://export.arxiv.org/api/query?",
        "none": ""
    }
    let headers = { "User-Agent": "refer-webext" }
    switch (format) {
        case "csl":
            headers["Accept"] = "application/vnd.citationstyles.csl+json"
            break;
        case "json":
            headers["Accept"] = "application/json"
            break;
        case "xml":
            headers["Accept"] = "application/xml"
            break;
    }

    const response = await fetch(prefix[key] + value, { headers: headers });
    if (!response.ok) {
        throw new Error("Request failed.")
    }

    const type = { "xml": "application/xml", "html": "text/html" }
    switch (format) {
        case "csl":
        case "json":
            return await response.json();
        case "xml":
        case "html":
            const text = await response.text();
            const parser = new DOMParser();
            const content = parser.parseFromString(text, type[format])
            if (content.querySelector("parseerror")) {
                throw new Error("Error on parse.");
            }
            return content;
        default:
            return await response.text();
    }
}

async function queryArxivAPI(method, parameter) {
    let text = ""
    if (method === "id_list") {
        text = parameter.join(",")
    } else {
        text = Object.entries(parameter).map(([prefix, value]) => {
            if (value) {
                return value.toLowerCase().split(" ").map((v) => { return prefix + ":" + v }).join("+AND+");
            } else {
                return "";
            }
        }).join("+AND+")
    }
    console.debug(text)
    const content = await httpRequest("arxiv_api", method + "=" + text, "xml").then((dom) => { return dom.documentElement.querySelector("entry"); });
    if (content) {
        return content
    }
    throw new Error("arXiv ID not found.")
}

export {
    httpRequest,
    queryArxivAPI
}