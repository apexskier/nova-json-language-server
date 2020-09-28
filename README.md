# JSON support for Nova

This is a plugin providing advanced JSON language support for the new [Nova editor from Panic](https://panic.com/nova/).

This uses [vscode-json-languageserver](https://www.npmjs.com/package/vscode-json-languageserver) internally.

[Extension README](./json.novaextension/README.md)

WIP - there are some major crashing bugs in Nova with language servers preventing
great development on this.

## TODOs

- Schemas support yaml, could this? https://github.com/adamvoss/vscode-yaml-languageservice
- Auto-match with [schemastore catalog](https://github.com/SchemaStore/schemastore/blob/master/src/api/json/catalog.json)
