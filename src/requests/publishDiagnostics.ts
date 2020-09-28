// eslint-disable-next-line no-unused-vars
import type * as lspTypes from "vscode-languageserver-protocol";

// @Panic: this is totally decoupled from typescript, so it could totally be native to Nova

// NOTE: this doesn't work. The Nova language editor intercepts these

export function registerPublishDiagnostics(client: LanguageClient) {
  client.onRequest(
    "textDocument/publishDiagnostics",
    async (params: lspTypes.PublishDiagnosticsParams) => {
      console.log("textDocument/publishDiagnostics");
      console.log(JSON.stringify(params));
    }
  );
}
