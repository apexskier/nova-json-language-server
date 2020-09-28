#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

# env > /dev/stderr
# echo $PATH > /dev/stderr
# dirname $(command -v node) > /dev/stderr
# note: any output from this script will be used by nova's language server thing, so it'll break functionality

cd "$WORKSPACE_DIR"

# note: --tsserver-path=".../tsserver.js" doesn't support debugging since it tries to fork and bind two processes to the same port

# path is stripped in the extension execution environment somehow
# symlinks have issues when the extension is submitted to the library, so we don't use node_modules/.bin
# PATH=$(dirname $(command -v node)) node \
# 	"$DIR/node_modules/.bin/vscode-json-languageserver" \
# 	--stdio

# use this for debugging
PATH=$(dirname $(command -v node)) node \
	--inspect \
	"$DIR/../node_modules/.bin/vscode-json-languageserver" \
	--stdio
