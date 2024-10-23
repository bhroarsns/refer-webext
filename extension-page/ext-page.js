let data = []
let heads = {}
let currentSort = { key: "year", descend: false }
let filters = {}

function changeSortAppearance() {
    Object.entries(heads).forEach(([key, node]) => {
        if (key === currentSort.key) {
            node.setAttribute("class", currentSort.descend ? "table-primary" : "table-danger")
        } else {
            node.setAttribute("class", "table-dark")
        }
    })
    return;
}

function formatAuthor(entry) {
    if (entry["author"]) {
        if (entry["author"].length > 3) {
            const sliced = entry["author"].slice(0, 3)
            return sliced.map((author) => {
                return author["given"].split(/\s+/g).map((str) => { return str[0] + "." }).join(" ") + " " + author["family"]
            }).join(",</br>") + ", et al."
        } else {
            return entry["author"].map((author) => {
                return author["given"].split(/\s+/g).map((str) => { return str[0] + "." }).join(" ") + " " + author["family"]
            }).join("</br>")
        }
    } else {
        return ""
    }
}

function matchArr(array, fn) {
    return array.every((varr) => {
        return varr.some((v) => fn(v))
    })
}

function currentFilter(entry) {
    let show = true
    for (const [key, filter] of Object.entries(filters)) {
        const value = filter.value
        if (show) {
            if (value && value !== "") {
                const valueArr = value.split(",").map((str) => { return str.trim().split('|').map((v) => { return v.trim() }) })
                switch (key) {
                    case "author":
                        show = entry[key] && Array.isArray(entry[key]) && matchArr(valueArr, (v) => entry[key].map((aut) => { return aut["given"] + " " + aut["family"] }).join(", ").includes(v))
                        break;
                    case "year":
                        show = entry["date"] && matchArr(valueArr, (v) => String(entry["date"][0]).includes(v))
                        break;
                    default:
                        show = entry[key] && matchArr(valueArr, (v) => entry[key].includes(v))
                        break;
                }
            }
        }
    }
    return show
}

function setTable() {
    const content = document.getElementById("content");
    content.innerHTML = ""
    const display = data.filter((entry) => { return currentFilter(entry) })
    for (let i = 0; i < display.length; i++) {
        let row = content.appendChild(document.createElement("tr"))
        row.setAttribute("id", display[i]["library"])
        row.addEventListener('click', async () => {
            await browser.sidebarAction.open().then(() => {
                return new Promise((resolve, reject) => { return setTimeout(resolve, 100) })
            })
            await browser.runtime.sendMessage({
                id: {
                    "doi": display[i]["doi"] || "",
                    "arxiv": display[i]["arxiv"] || "",
                    "url": display[i]["url"] || ""
                }
            });
        })
        let author = row.appendChild(document.createElement("td"))
        author.innerHTML = formatAuthor(display[i])
        let date = row.appendChild(document.createElement("td"))
        date.innerHTML = display[i]["date"] ? display[i]["date"][0] : ""
        let title = row.appendChild(document.createElement("td"))
        title.innerHTML = display[i]["title"] ? "<a href='" + browser.runtime.getURL("extension-page/library.html") + "?index=" + display[i]["library"] + "' target='_blank' rel='noreferrer noopener'>" + display[i]["title"] + "</a>" : ""
        let abstract = row.appendChild(document.createElement("td"))
        abstract.innerHTML = display[i]["abstract"] ? display[i]["abstract"] : ""
        let journal = row.appendChild(document.createElement("td"))
        journal.innerHTML = display[i]["journal"] ? display[i]["journal"] : ""
        let doi = row.appendChild(document.createElement("td"))
        doi.innerHTML = display[i]["doi"] ? "<a href='https://doi.org/" + display[i]["doi"] + "' target='_blank' rel='noreferrer noopener'>" + display[i]["doi"] + "</a>" : ""
        let arxiv = row.appendChild(document.createElement("td"))
        arxiv.innerHTML = display[i]["arxiv"] ? "<a href='https://arxiv.org/abs/" + display[i]["arxiv"] + "' target='_blank' rel='noreferrer noopener'>" + display[i]["arxiv"] + "</a>" : ""
        let file = row.appendChild(document.createElement("td"))
        file.innerHTML = display[i]["file"] ? "<a href='" + browser.runtime.getURL("files/" + display[i]["file"]) + "' target='_blank' rel='noreferrer noopener'>" + display[i]["file"] + "</a>" : ""
        let tag = row.appendChild(document.createElement("td"))
        tag.innerHTML = display[i]["tag"] ? display[i]["tag"].join(", ") : ""
        let note = row.appendChild(document.createElement("td"))
        note.innerHTML = display[i]["note"] ? display[i]["note"].replaceAll(/\s+/g, " ") : ""
    }
    return;
}

async function reloadData() {
    const response = await fetch(browser.runtime.getURL("library/index.json"));
    data = await response.json().then((body) => {
        return Object.values(body)
    });
    return;
}

function generateSortKey(obj, key) {
    switch (key) {
        case "year":
            let date = obj["date"]
            for (let i = 0; i < 3 - date.length; i++) {
                date.push(0)
            }
            return "" + date[0] + (date[1] < 10 ? "0" + date[1] : date[1]) + (date[2] < 10 ? "0" + date[2] : date[2]);
        case "author":
            let author = obj["author"]
            if (author && Array.isArray(author) && author.length > 0) {
                return author[0]["family"]
            } else {
                return ""
            }
        default:
            return obj[key] ? obj[key] : "";
    }
}

function sortData() {
    data.sort((a, b) => {
        const aKey = generateSortKey(a, currentSort.key)
        const bKey = generateSortKey(b, currentSort.key)
        if (aKey < bKey) {
            if (currentSort.descend) {
                return 1
            }
            return -1
        } else if (aKey > bKey) {
            if (currentSort.descend) {
                return -1
            }
            return 1
        } else {
            return 0
        }
    })
    return;
}

function resetFilter() {
    Object.values(filters).forEach((filter) => { filter.value = "" });
}

window.addEventListener('load', async () => {
    for (const node of document.getElementById("table-head").children) {
        if (node.tagName.toLowerCase() === "th") {
            if (node.id && node.id.endsWith("-head")) {
                const headKey = node.id.replace("-head", "")
                heads[headKey] = node
                node.addEventListener('click', () => {
                    if (currentSort.key === headKey) {
                        currentSort.descend = !currentSort.descend
                    } else {
                        currentSort.descend = false
                    }
                    currentSort.key = headKey
                    sortData()
                    changeSortAppearance()
                    setTable()
                    return browser.storage.local.set({ sort: currentSort })
                })
            }
        }
    }

    for (const node of document.getElementById("filters").children) {
        if (node.tagName.toLowerCase() === "th") {
            const filter = node.firstChild;
            if (filter.id && filter.id.endsWith("-filter")) {
                const filterKey = filter.id.replace("-filter", "")
                filters[filterKey] = filter
                filter.addEventListener('change', () => { setTable() })
            }
        }
    }

    const storage = await browser.storage.local.get();
    currentSort = storage["sort"] || currentSort
    await reloadData()
    sortData()
    changeSortAppearance()
    setTable()

    document.getElementById("refresh").addEventListener('click', async () => {
        const msg = await browser.runtime.sendNativeMessage("refer_mklib", {})
        document.getElementById("refresh-log").innerHTML = msg
        await reloadData();
        sortData()
        setTable()
        await new Promise((resolve, reject) => { setTimeout(resolve, 3000) }).then(() => { document.getElementById("refresh-log").innerHTML = "" })
    })

    document.getElementById("reset").addEventListener('click', () => { resetFilter(); setTable(); })
})

browser.runtime.onMessage.addListener(async (msg) => {
    if (msg) {
        switch (msg["method"]) {
            case "reload":
                await reloadData();
                sortData()
                setTable()
                break;
            case "fill":
                resetFilter();
                filters[msg["key"]].value = msg["value"]
                setTable()
                break;
        }
    }
})