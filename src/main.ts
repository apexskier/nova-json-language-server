// eslint-disable-next-line no-unused-vars
import type * as lspTypes from "vscode-languageserver-protocol";
import { registerAutoSuggest } from "./commands/autoSuggest";
import { registerApplyEdit } from "./requests/applyEdit";
import { registerGoToDefinition } from "./commands/goToDefinition";
import { InformationView } from "./informationView";
import { installWrappedDependencies } from "./dependencyManagement";

nova.commands.register("apexskier.json.reload", reload);

let client: LanguageClient | null = null;
const compositeDisposable = new CompositeDisposable();

async function makeFileExecutable(file: string) {
  return new Promise((resolve, reject) => {
    const process = new Process("/usr/bin/env", {
      args: ["chmod", "u+x", file],
    });
    process.onDidExit((status) => {
      if (status === 0) {
        resolve();
      } else {
        reject(status);
      }
    });
    process.start();
  });
}

async function reload() {
  deactivate();
  console.log("reloading...");
  await asyncActivate();
}

async function asyncActivate() {
  const informationView = new InformationView();
  compositeDisposable.add(informationView);

  informationView.status = "Activating...";

  try {
    await installWrappedDependencies();
  } catch (err) {
    informationView.status = "Failed to install";
    throw err;
  }

  const runFile = nova.path.join(nova.extension.path, "run.sh");

  // Uploading to the extension library makes this file not executable, so fix that
  await makeFileExecutable(runFile);

  let serviceArgs;
  if (nova.inDevMode()) {
    const logDir = nova.path.join(nova.extension.workspaceStoragePath, "logs");
    await new Promise((resolve, reject) => {
      const p = new Process("/usr/bin/env", {
        args: ["mkdir", "-p", logDir],
      });
      p.onDidExit((status) => (status === 0 ? resolve() : reject()));
      p.start();
    });
    console.log("logging to", logDir);
    // passing inLog breaks some requests for an unknown reason
    // const inLog = nova.path.join(logDir, "languageServer-in.log");
    const outLog = nova.path.join(logDir, "languageServer-out.log");
    serviceArgs = {
      path: "/usr/bin/env",
      // args: ["bash", "-c", `tee -a "${inLog}" | "${runFile}" | tee -a "${outLog}"`],
      args: ["bash", "-c", `"${runFile}" | tee -a "${outLog}"`],
    };
  } else {
    serviceArgs = {
      path: runFile,
    };
  }

  client = new LanguageClient(
    "apexskier.json",
    "JSON Language Server",
    {
      type: "stdio",
      ...serviceArgs,
      env: {
        WORKSPACE_DIR: nova.workspace.path ?? "",
        INSTALL_DIR: nova.extension.globalStoragePath,
      },
    },
    {
      syntaxes: ["json", "jsonc"],
    }
  );

  // register nova commands
  compositeDisposable.add(registerAutoSuggest(client));
  compositeDisposable.add(registerGoToDefinition(client));

  const extensionManifestSchema = {
    name: "Nova Extension",
    description: "Nova extension manifest file",
    url: `file://${nova.path.join(
      nova.extension.path,
      "nova-extension-schema.json"
    )}`,
    fileMatch: ["*.novaextension/extension.json"],
  };

  void (async () => {
    const response = await fetch(
      "https://schemastore.azurewebsites.net/api/json/catalog.json"
    );
    const catalog = await response.json();

    const params: lspTypes.DidChangeConfigurationParams = {
      settings: {
        json: {
          schemas: [extensionManifestSchema, ...catalog.schemas],
        },
      },
    };
    client.sendNotification("workspace/didChangeConfiguration", params);
    console.log("registered schemas");
  })();

  // register server-pushed commands
  registerApplyEdit(client);

  client.onNotification("window/showMessage", (params) => {
    console.log("window/showMessage", JSON.stringify(params));
  });
  client.onRequest("vscode/content", (params) => {
    console.log("vscode/content", JSON.stringify(params));
  });
  client.onNotification("json/schemaAssociations", (params) => {
    console.log("json/schemaAssociations", JSON.stringify(params));
  });
  client.onNotification("json/resultLimitReached", (params) => {
    console.log("json/resultLimitReached", JSON.stringify(params));
  });

  client.start();

  informationView.status = "Running";

  informationView.reload(); // this is needed, otherwise the view won't show up properly, possibly a Nova bug
}

export function activate() {
  console.log("activating...");
  if (nova.inDevMode()) {
    const notification = new NotificationRequest("activated");
    notification.body = "JSON extension is loading";
    nova.notifications.add(notification);
  }
  return asyncActivate()
    .catch((err) => {
      console.error("Failed to activate");
      console.error(err);
      nova.workspace.showErrorMessage(err);
    })
    .then(() => {
      console.log("activated");
    });
}

export function deactivate() {
  client?.stop();
  compositeDisposable.dispose();
}
