function expandObject(parent, obj, id) {
    for (const key in obj) {
        const field = parent.appendChild(document.createElement("div"))
        field.setAttribute("id", (id ? id + "_" : "") + key)
        field.setAttribute("class", "row")
        if (typeof obj[key] === "string") {
            const title = field.appendChild(document.createElement("div"))
            const desc = field.appendChild(document.createElement("div"))
            title.setAttribute("class", "fw-bold")
            title.setAttribute("id", (id ? id + "_" : "") + key + "_title")
            title.innerHTML = key
            desc.innerHTML = "\"" + obj[key] + "\""
            title.setAttribute("class", title.getAttribute("class") + " col-4")
            desc.setAttribute("class", "col-8")
            continue;
        } else if (typeof obj[key] === "number") {
            const title = field.appendChild(document.createElement("div"))
            const desc = field.appendChild(document.createElement("div"))
            title.setAttribute("class", "fw-bold")
            title.setAttribute("id", (id ? id + "_" : "") + key + "_title")
            title.innerHTML = key
            desc.innerHTML = obj[key]
            title.setAttribute("class", title.getAttribute("class") + " col-4")
            desc.setAttribute("class", "col-8")
            continue;
        } else if (Array.isArray(obj[key])) {
            const title = field.appendChild(document.createElement("a"))
            const desc = field.appendChild(document.createElement("div"))
            title.setAttribute("class", "fw-bold")
            title.setAttribute("id", (id ? id + "_" : "") + key + "_title")
            title.innerHTML = key
            title.innerHTML = title.innerHTML + "[]"
            title.addEventListener('click', () => { desc.hidden = !desc.hidden })
            desc.hidden = true
            desc.setAttribute("class", "ms-4")
            expandObject(desc, obj[key], field.id)
            continue;
        } else {
            const title = field.appendChild(document.createElement("a"))
            const desc = field.appendChild(document.createElement("div"))
            title.setAttribute("class", "fw-bold")
            title.setAttribute("id", (id ? id + "_" : "") + key + "_title")
            title.innerHTML = key
            title.addEventListener('click', () => { desc.hidden = !desc.hidden })
            desc.hidden = true
            desc.setAttribute("class", "ms-4")
            expandObject(desc, obj[key], field.id)
            continue;
        }
    }
    return;
}

window.addEventListener('load', async (event) => {
    const url = new URL(event.target.URL)
    try {
        const index = url.searchParams.get("index");
        document.getElementById("lib-index").innerHTML = index
        const response = await fetch(browser.runtime.getURL("library/" + index + ".json"));
        if (!response.ok) {
            throw new Error("Request failed.")
        }
        const meta = document.head.appendChild(document.createElement("meta"));
        if (index.startsWith("doi/")) {
            meta.setAttribute("name", "dc.Identifier")
            meta.setAttribute("scheme", "doi")
            meta.setAttribute("content", index.replace("doi/", ""))
        } else if (index.startsWith("arxiv/")) {
            meta.setAttribute("name", "citation_arxiv_id")
            meta.setAttribute("content", index.replace("arxiv/", ""))
        }
        const data = await response.json();
        const display = document.getElementById("content");
        expandObject(display, data)
    } catch (e) {
        console.error(e)
    }
})

browser.runtime.onMessage.addListener(async (msg) => {
    if (msg) {
        switch (msg["method"]) {
            case "reload":
                window.location.reload();
                break;
        }
    }
})