#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# note: any output from this script will be used by nova's language server thing, so it'll break functionality

cd "$WORKSPACE_DIR"

# path is stripped in the extension execution environment somehow
# symlinks have issues when the extension is submitted to the library, so we don't use node_modules/.bin
node \
	"$DIR/node_modules/vscode-json-languageserver/bin/vscode-json-languageserver" \
	--stdio

# use this for debugging
# node \
# 	--inspect-brk \
# 	"$DIR/node_modules/vscode-json-languageserver/bin/vscode-json-languageserver" \
# 	--stdio
