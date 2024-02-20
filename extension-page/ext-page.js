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
                return author["given"] + " " + author["family"]
            }).join(", ") + " et al."
        } else {
            return entry["author"].map((author) => {
                return author["given"] + " " + author["family"]
            }).join(", ")
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
                const valueArr = value.split(",").map((str) => { return str.split('|')})
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
        let div = content.appendChild(document.createElement("tr"))
        div.setAttribute("id", display[i]["library"])
        let author = div.appendChild(document.createElement("td"))
        author.innerHTML = formatAuthor(display[i])
        let date = div.appendChild(document.createElement("td"))
        date.innerHTML = display[i]["date"] ? display[i]["date"][0] : ""
        let title = div.appendChild(document.createElement("td"))
        title.innerHTML = display[i]["title"] ? "<a href='" + browser.runtime.getURL("library/" + display[i]["library"] + ".json") + "' target='_blank' rel='noreferrer noopener'>" + display[i]["title"] + "</a>" : ""
        let journal = div.appendChild(document.createElement("td"))
        journal.innerHTML = display[i]["journal"] ? display[i]["journal"] : ""
        let doi = div.appendChild(document.createElement("td"))
        doi.innerHTML = display[i]["doi"] ? "<a href='https://doi.org/" + display[i]["doi"] + "' target='_blank' rel='noreferrer noopener'>" + display[i]["doi"] + "</a>" : ""
        let arxiv = div.appendChild(document.createElement("td"))
        arxiv.innerHTML = display[i]["arxiv"] ? "<a href='https://arxiv.org/abs/" + display[i]["arxiv"] + "' target='_blank' rel='noreferrer noopener'>" + display[i]["arxiv"] + "</a>" : ""
        let file = div.appendChild(document.createElement("td"))
        file.innerHTML = display[i]["file"] ? "<a href='" + browser.runtime.getURL("files/" + display[i]["file"]) + "' target='_blank' rel='noreferrer noopener'>" + display[i]["file"] + "</a>" : ""
        let tag = div.appendChild(document.createElement("td"))
        tag.innerHTML = display[i]["tag"] ? display[i]["tag"].join(", ") : ""
        let note = div.appendChild(document.createElement("td"))
        note.innerHTML = display[i]["note"] ? display[i]["note"].replace("\n", "</br>") : ""
    }

    for (const node of document.getElementById("content").childNodes) {
        if (node.nodeType === 1 && node.tagName.toLowerCase() === "tr") {
            const full = node.id;
            const regex = full.match(/^[a-z]+?\//)
            if (!regex) {
                break;
            }
            const type = regex[0].replace("/", "")
            const value = full.replace(regex[0], "")
            node.addEventListener('click', async () => {
                let body = {}
                body[type] = value;
                await browser.sidebarAction.open().then(() => {
                    return new Promise(resolve => {setTimeout(resolve, 100)})
                }).finally(() => {
                    return browser.runtime.sendMessage({ mode: "edit", id: body })
                })
            })
        }
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
            return "" + date[0] + (date[1] > 10 ? date[1] : "0" + date[1]) + (date[2] > 10 ? date[2] : "0" + date[2]);
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

window.addEventListener('load', async () => {
    for (const node of document.getElementById("table-head").childNodes) {
        if (node.nodeType === 1 && node.tagName.toLowerCase() === "th") {
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
            })
        }
    }

    for (const node of document.getElementById("filters").childNodes) {
        if (node.nodeType === 1 && node.tagName.toLowerCase() === "th") {
            const filter = node.firstChild;
            const filterKey = filter.id.replace("-filter", "")
            filters[filterKey] = filter
            filter.addEventListener('change', () => { setTable() })
        }
    }

    await reloadData()
    sortData("year")
    changeSortAppearance()
    setTable()

    document.getElementById("refresh").addEventListener('click', async () => {
        const msg = await browser.runtime.sendNativeMessage("refer_mklib", {})
        document.getElementById("refresh-log").innerHTML = msg
        await reloadData();
        sortData()
        setTable()
    })
})