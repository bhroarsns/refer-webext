import { authorObj } from "./util.js"

const querySelectors = {
    "doi": [
        'meta[name=\"citation_doi\" i]',
        'meta[name=\"dc.Identifier\" i][scheme=\"doi\" i]',
        'meta[name=\"dc.Identifier\" i]:not([scheme])'
    ],
    "arxiv": [
        'meta[name=\"citation_arxiv_id\" i]'
    ],
    "abstract": [
        'meta[property=\"og:description\" i]',
        'meta[name=\"description\" i]',
        'meta[name=\"dc.description\" i]'
    ]
}

const queryType = { "doi": "DOI", "arxiv": "arXiv ID", "abstract": "Abstract" }

//for browser.tabs.executeScript
function getQueryScript(type, returnAttribute) {
    return "var elem = "
        + querySelectors[type].map((selector) => { return "document.querySelector('" + selector + "')" }).join(" || ") + ";"
        + "elem ? elem.getAttribute('" + returnAttribute + "') : elem"
}

async function queryElementAttribute(dom, type, returnAttribute) {
    let target
    for (const selector of querySelectors[type]) {
        target = target || dom.querySelector(selector)
    }
    if (target) {
        const content = target.getAttribute(returnAttribute)
        if (content) {
            return content
        }
    }
    throw new Error(queryType[type] + " not found.")
}

function formatValue(key, node) {
    switch (key) {
        case "author":
            return authorObj(node.querySelector("name").innerHTML);
        case "link":
            let value = {}
            for (const attr of node.attributes) {
                value[attr.name] = attr.value
            }
            return value;
        case "category":
            return node.getAttribute("term");
        case "date":
            return node.innerHTML.slice(0, 10).split("-").map((str) => { return Number(str) })
        case "updated":
            return { "date-parts": [node.innerHTML.slice(0, 10).split("-").map((str) => { return Number(str) })] }
        case "arxiv":
            return node.innerHTML.toLowerCase().replace("http://arxiv.org/abs/", "").replace("https://arxiv.org/abs/", "").replace(/v\d+$/g, "")
        case "title":
        case "abstract":
            return node.innerHTML.replaceAll(/\s+/g, " ")
        default:
            return node.innerHTML;
    }
}

function parseArxivEntry(entry) {
    const dataKey = {
        "id": "arxiv",
        "summary": "abstract",
        "published": "date",
        "arxiv:doi": "doi",
        "arxiv:comment": "comment",
        "arxiv:journal_ref": "journal_ref",
        "arxiv:primary_category": "category",
    }

    let content = {}
    for (const node of entry.children) {
        const key = dataKey[node.tagName] || node.tagName
        const value = formatValue(key, node)
        switch (key) {
            case "author":
            case "category":
            case "link":
                if (content[key]) {
                    content[key].push(value)
                } else {
                    content[key] = [value]
                }
                continue;
            default:
                content[key] = value
        }
    }
    content["article-number"] = content["arxiv"]
    content["container-title"] = "arXiv"
    return content
}

export {
    getQueryScript,
    parseArxivEntry,
    queryElementAttribute,
    queryType
}