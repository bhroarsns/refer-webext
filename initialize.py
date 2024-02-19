import os
import json

data = json.load(open("./config.json"))
data["dir"] = os.getcwd()
with open("./config.json", "w") as w:
    w.write(json.dumps(data, indent=4))