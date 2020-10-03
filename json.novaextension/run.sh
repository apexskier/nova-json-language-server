#!/usr/bin/env bash

# note: any output from this script will be used by nova's language server thing, so it'll break functionality

if [ -n "$WORKSPACE_DIR" ]
then
	cd "$WORKSPACE_DIR"
fi

# path is stripped in the extension execution environment somehow
# symlinks have issues when the extension is submitted to the library, so we don't use node_modules/.bin
node \
	"$INSTALL_DIR/node_modules/vscode-json-languageserver/bin/vscode-json-languageserver" \
	--stdio

# use this for debugging
# node \
# 	--inspect \
# 	"$INSTALL_DIR/node_modules/vscode-json-languageserver/bin/vscode-json-languageserver" \
# 	--stdio
