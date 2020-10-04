# JSON

This extension provides rich JSON support through a dedicated language server. It provides advanced validation, autocompletion, and documentation through schema.org JSON schemas.

Supports many common json files including node `package.json` files, nova extension manifests, and TypeScript config files. For a more complete list, visit the [JSON Schema Store](https://www.schemastore.org/json/).

## Screenshots

![Demo](https://raw.githubusercontent.com/apexskier/nova-json-language-server/d939824cd32cddbbf3b5dcf5518453a4d5e106c0/.images/demo.gif)

![Auto-completion](https://raw.githubusercontent.com/apexskier/nova-json-language-server/d939824cd32cddbbf3b5dcf5518453a4d5e106c0/.images/auto-completion.png)

![Inline docs](https://raw.githubusercontent.com/apexskier/nova-json-language-server/d939824cd32cddbbf3b5dcf5518453a4d5e106c0/.images/inline-docs.png)

![Validation](https://raw.githubusercontent.com/apexskier/nova-json-language-server/d939824cd32cddbbf3b5dcf5518453a4d5e106c0/.images/inline-validation.png)

## Troubleshooting

Many issues are caused by a missing or improperly configured local node/npm installation.

Check the Extension Console by turning on extension development in Nova in Preferences > General > Extension Development, then Extensions > Show Extension Console, then filter by Source.

- Check for any warnings or errors. They might indicate a problem with your local environment or a bug with the extension.
- If you see
  ```
  activating...
  Already locked
  ```
  and _do not see_
  ```
  activated
  ```
  something may have gone wrong. Try running the "Force Unlock Dependency Installation" command for this extension.
