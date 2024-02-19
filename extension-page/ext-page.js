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

async function getIndex() {
    const response = await fetch(browser.runtime.getURL("library/index.json"));
    const data = await response.json();
    data.sort((a, b) => {
        let aDate = a["published"]
        let bDate = b["published"]
        for (let i = 0; i < 3 - aDate.length; i++) {
            aDate.push(0)
        }
        for (let i = 0; i < 3 - bDate.length; i++) {
            bDate.push(0)
        }
        const aStr = "" + aDate[0] + (aDate[1] > 10 ? aDate[1] : "0" + aDate[1]) + (aDate[2] > 10 ? aDate[2] : "0" + aDate[2])
        const bStr = "" + bDate[0] + (bDate[1] > 10 ? bDate[1] : "0" + bDate[1]) + (bDate[2] > 10 ? bDate[2] : "0" + bDate[2])
        if (aStr < bStr) {
            return -1
        } else if (aStr > bStr) {
            return 1
        } else {
            return 0
        }
    })
    for (let i = 0; i < data.length; i++) {
        let div = document.getElementById("content").appendChild(document.createElement("tr"))
        div.setAttribute("id", data[i]["type"] + ":" + data[i]["value"])
        let author = div.appendChild(document.createElement("td"))
        author.innerHTML = formatAuthor(data[i])
        let date = div.appendChild(document.createElement("td"))
        date.innerHTML = data[i]["published"] ? data[i]["published"][0] : ""
        let title = div.appendChild(document.createElement("td"))
        title.innerHTML = data[i]["title"] ? data[i]["title"] : ""
        let journal = div.appendChild(document.createElement("td"))
        journal.innerHTML = data[i]["journal"] ? data[i]["journal"] : ""
        let doi = div.appendChild(document.createElement("td"))
        doi.innerHTML = data[i]["doi"] ? "<a href='https://doi.org/" + data[i]["doi"] + "' target='_blank' rel='noreferrer noopener'>" + data[i]["doi"] + "</a>" : ""
        let arxiv = div.appendChild(document.createElement("td"))
        arxiv.innerHTML = data[i]["arxiv"] ? "<a href='https://arxiv.org/abs/" + data[i]["arxiv"] + "' target='_blank' rel='noreferrer noopener'>" + data[i]["arxiv"] + "</a>" : ""
        let file = div.appendChild(document.createElement("td"))
        file.innerHTML = data[i]["file"] ? "<a href='" + browser.runtime.getURL("files/" + data[i]["file"]) + "' target='_blank' rel='noreferrer noopener'>" + data[i]["file"] + "</a>" : ""
        let tag = div.appendChild(document.createElement("td"))
        tag.innerHTML = data[i]["tag"] ? data[i]["tag"].join(", ") : ""
        let note = div.appendChild(document.createElement("td"))
        note.innerHTML = data[i]["note"] ? data[i]["note"].replace("\n", "</br>") : ""
    }
}

window.addEventListener('load', async () => {
    const response = await fetch(browser.runtime.getURL("library/index.json"));
    const data = await response.json();
    for (let i = 0; i < data.length; i++) {
        document.getElementById(data[i]["type"] + ":" + data[i]["value"]).addEventListener('click', () => {
            let body = {}
            body[data[i]["type"]] = data[i]["value"];
            browser.runtime.sendMessage(body)
        })
    }
})

getIndex()