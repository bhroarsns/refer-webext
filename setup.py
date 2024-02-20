import os
import json

data = {}
if os.path.isfile("./config.json"):
    data = json.load(open("./config.json"))
data["dir"] = os.getcwd()
data["name"] = "Reference Manager"
with open("./config.json", "w") as w:
    w.write(json.dumps(data, indent=4))