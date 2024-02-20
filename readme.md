# Reference Manager
A DOI and arXiv ID based Reference Manager for Firefox.

## Usage
1. Run `setup.py`:
```
$ python setup.py
```

2. Move `refer_mklib.json` to the location listed [here](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests#manifest_location "Mozilla documentation"). For example, for macOS:
```
$ mv ./library/refer_mklib.json "/Library/Application Support/Mozilla/NativeMessagingHosts/refer_mklib.json"
```

3. Open [about:debugging](about:debugging "open"), click "This Firefox", click the Load Temporary Add-on button, then select `manifest.json` in your cloned repository.

## Features


## Acknowledgement
Thank you to arXiv for use of its open access interoperability.