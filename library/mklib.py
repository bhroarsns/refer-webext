#!/usr/bin/python3

import sys
import struct
import json
import os

def getMessage():
    rawLength = sys.stdin.buffer.read(4)
    if len(rawLength) == 0:
        sys.exit(0)
    messageLength = struct.unpack('@I', rawLength)[0]
    message = sys.stdin.buffer.read(messageLength).decode('utf-8')
    return json.loads(message)

def encodeMessage(messageContent):
    encodedContent = json.dumps(messageContent, separators=(',', ':')).encode('utf-8')
    encodedLength = struct.pack('@I', len(encodedContent))
    return {'length': encodedLength, 'content': encodedContent}

# Send an encoded message to stdout
def sendMessage(encodedMessage):
    sys.stdout.buffer.write(encodedMessage['length'])
    sys.stdout.buffer.write(encodedMessage['content'])
    sys.stdout.buffer.flush()

def publishedDate(data):
    candidates = []
    propertyNames = ["published", "published-online", "published-print", "issued", "created", "deposited"]
    for propertyName in propertyNames:
        if propertyName in data:
            if "date-parts" in data[propertyName]:
                if not data[propertyName]["date-parts"][0] is None:
                    candidates.append(data[propertyName]["date-parts"][0])
    if len(candidates) == 0:
        return []
    else:
        candidates.sort(key=toJoined)
        for _ in range(3-len(candidates[0])):
            candidates[0].append(1)
        return candidates[0]
    
def toJoined(arr):
    value = ""
    for i in range(len(arr)):
        if not arr[i] is None:
            value += "0" + str(arr[i]) if arr[i] < 10 else str(arr[i])
    return value

def formatLibrary(data, idType, value):
    entry = {}
    entry["date"] = data["date"]
    entry["author"] = data["author"] if ("author" in data) else ""
    entry["title"] = data["title"] if ("title" in data) else ""
    entry["abstract"] = data["abstract"] if ("abstract" in data) else ""
    entry["journal"] = data["container-title"] if ("container-title" in data) else ""
    entry["library"] = idType + "/" + value
    entry[idType] = value
    entry["file"] = data["localfile"] if ("localfile" in data) else ""
    entry["tag"] = data["tag"] if ("tag" in data) else []
    entry["note"] = data["note"] if ("note" in data) else ""
    if idType == "doi" and "arxiv" in data and data["arxiv"] != "":
        arxiv = data["arxiv"]
        entry["arxiv"] = arxiv
        arxivfile = "arxiv/"+arxiv+".json"
        redirect = json.load(open(arxivfile)) if os.path.isfile(arxivfile) else {}
        redirect["redirect"] = "doi/" + value
        redirect["doi"] = value
        if "localfile" in data:
            redirect["localfile"] = data["localfile"]
        else:
            if "localfile" in redirect:
                entry["file"] = redirect["localfile"]
        if not os.path.isdir(os.path.dirname(arxivfile)):
            os.makedirs(os.path.dirname(arxivfile))
        with open(arxivfile, "w") as w:
            w.write(json.dumps(redirect, indent=4))
    return entry

def parseLibrary(path):
    data = json.load(open(path))
    pathar = path.replace("./", "").replace(".json", "").split('/', 1)
    if not "date" in data:
        data["date"] = publishedDate(data)
        with open(path, "w") as w:
            w.write(json.dumps(data, indent=4))
    else:
        for i in range(len(data["date"])):
            if data["date"][i] == 0:
                data["date"][i] = 1
    if "redirect" in data:
        redir = json.load(open(data["redirect"]+".json"))
        if "arxiv" in redir:
            if redir["arxiv"] == pathar[1]:
                return None, None, None
        del data["redirect"]
        with open(path, "w") as w:
            w.write(json.dumps(data, indent=4))
        return pathar[0], pathar[1], formatLibrary(data, pathar[0], pathar[1])
    else:
        return pathar[0], pathar[1], formatLibrary(data, pathar[0], pathar[1])

while True:
    data = getMessage()
    try:
        message = ""
        if "type" in data:
            t = data["type"]
            if "value" in data:
                v = data["value"]
                filename = t+"/"+v+".json"
                if "content" in data:
                    if data["content"] == "delete":
                        if os.path.isfile(filename):
                            os.remove(filename)
                        message += "Library of "+ t + ":" + v + " successfully deleted."
                        curList = json.load(open("index.json"))
                        del curList[t + "/" + v]
                        with open("index.json", "w") as ind:
                            ind.write(json.dumps(curList, indent=4))
                        message += "</br>Index updated."
                    else:
                        if not os.path.isdir(os.path.dirname(filename)):
                            os.makedirs(os.path.dirname(filename))
                        with open(filename, "w") as w:
                            w.write(json.dumps(data["content"], indent=4))
                        message += "Library of "+ t + ":" + v + " successfully updated."
                        curList = json.load(open("index.json"))
                        curList[t + "/" + v] = formatLibrary(data["content"], t, v)
                        with open("index.json", "w") as ind:
                            ind.write(json.dumps(curList, indent=4))
                        message += "</br>Index updated."
        else:
            body = {}
            for dir in os.scandir('.'):
                if dir.is_dir():
                    for root, _, files in os.walk(top=dir.path):
                        for file in files:
                            if file.endswith(".json") and file != "index.json":
                                idType, val, entry = parseLibrary(os.path.join(root, file))
                                if not entry is None:
                                    body[idType + "/" + val] = entry
            with open("index.json", "w") as w:
                w.write(json.dumps(body, indent=4))
            message += "Index refreshed."
        sendMessage(encodeMessage(message))
    except Exception as e:
        sendMessage(encodeMessage(str(e)))
