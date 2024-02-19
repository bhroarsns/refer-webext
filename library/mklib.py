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

def parseLibrary(path):
    data = json.load(open(path))
    pathar = path.replace("./", "").replace(".json", "").split('/', 1)
    if not "date" in data:
        data["date"] = publishedDate(data)
        with open(path, "w") as w:
            w.write(json.dumps(data, indent=4))
    entry = {}
    entry["published"] = data["date"]
    entry["author"] = data["author"] if ("author" in data) else ""
    entry["title"] = data["title"]
    entry["journal"] = data["container-title"] if ("container-title") else ""
    entry["type"] = pathar[0]
    entry["value"] = pathar[1]
    entry[pathar[0]] = pathar[1]
    entry["file"] = data["localfile"] if ("localfile" in data) else ""
    entry["tag"] = data["tag"] if ("tag" in data) else []
    entry["note"] = data["note"] if ("note" in data) else ""
    return entry

while True:
    data = getMessage()
    try:
        message = ""
        if "type" in data:
            t = data["type"]
            if "value" in data:
                v = data["value"]
                if not os.path.isdir(os.path.dirname(t+"/"+v+".json")):
                    os.makedirs(os.path.dirname(t+"/"+v+".json"))
                with open(t+"/"+v+".json", "w") as w:
                    if "content" in data:
                        w.write(json.dumps(data["content"], indent=4))
                        message += "Library of "+ t + ":" + v + " successfully updated."
        with open("index.json", "w") as w:
            body = []
            for dir in os.scandir('.'):
                if dir.is_dir():
                    for root, _, files in os.walk(top=dir.path):
                        for file in files:
                            if file.endswith(".json") and file != "index.json":
                                entry = parseLibrary(os.path.join(root, file))
                                body.append(entry)
            w.write(json.dumps(body, indent=4))
            if message != "":
                message += "</br>"
            message += "Index updated."
        sendMessage(encodeMessage(message))
    except Exception as e:
        # message = ""
        # message += str(e)
        sendMessage(encodeMessage(str(e)))
