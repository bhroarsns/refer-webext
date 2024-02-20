import os
import json

data = {}
if os.path.isfile("./config.json"):
    data = json.load(open("./config.json"))
data["dir"] = os.getcwd()
data["name"] = "Reference Manager"
with open("./config.json", "w") as w:
    w.write(json.dumps(data, indent=4))

nativeMessaging = {}
nativeMessaging["name"] = "refer_mklib"
nativeMessaging["description"] = "Library updator"
nativeMessaging["path"] = os.getcwd() + "/library/mklib.py"
nativeMessaging["type"] = "stdio"
nativeMessaging["allowed_extensions"] = ["refer_extension@example.org"]
with open("./library/refer_mklib.json", "w") as w:
    w.write(json.dumps(nativeMessaging, indent=4))