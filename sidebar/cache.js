function idToLabel(id) {
    return id.type + ":" + id.value
}

async function getCache(id) {
    const storage = await browser.storage.local.get();
    return storage[idToLabel(id)]
}

async function setCache(id, content) {
    let body = {}
    body[idToLabel(id)] = content
    await browser.storage.local.set(body)
    return;
}

async function updateCache(id, changes) {
    const saved = await getCache(id);
    let body = saved ? saved : {}
    for (const key of Object.keys(changes)) {
        body[key] = changes[key]
    }
    await setCache(id, body);
    return;
}

export { getCache, setCache, updateCache }