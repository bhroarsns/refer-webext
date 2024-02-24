function idToLabel(id) {
    return id.type + ":" + id.value
}

async function getCache(id) {
    const storage = await browser.storage.local.get();
    return storage[idToLabel(id)]
}

async function setCache(id, content) {
    await browser.storage.local.set({ [idToLabel(id)]: content })
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

async function clearCache() {
    const sort = await browser.storage.local.get().then((data) => { return data["sort"]; });
    await browser.storage.local.clear();
    await browser.storage.local.set({ "sort": sort });
    return;
}

export {
    clearCache,
    getCache,
    setCache,
    updateCache
}