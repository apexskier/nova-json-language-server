// eslint-disable-next-line no-unused-vars
import type * as lspTypes from "vscode-languageserver-protocol";
import { registerAutoSuggest } from "./commands/autoSuggest";
import { registerApplyEdit } from "./requests/applyEdit";
import { registerGoToDefinition } from "./commands/goToDefinition";
import { wrapCommand } from "./novaUtils";
import { InformationView } from "./informationView";

nova.commands.register(
  "apexskier.json.openWorkspaceConfig",
  wrapCommand(function openWorkspaceConfig(workspace: Workspace) {
    workspace.openConfig("apexskier.json");
  })
);

nova.commands.register("apexskier.json.reload", reload);

let client: LanguageClient | null = null;
const compositeDisposable = new CompositeDisposable();

async function installWrappedDependencies() {
  return new Promise((resolve, reject) => {
    const process = new Process("/usr/bin/env", {
      args: ["npm", "install"],
      cwd: nova.extension.path,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        NO_UPDATE_NOTIFIER: "true",
      },
    });
    let errOutput = "";
    if (nova.inDevMode()) {
      process.onStdout((o) => console.log("installing:", o.trimRight()));
    }
    process.onStderr((e) => {
      console.warn("installing:", e.trimRight());
      errOutput += e;
    });
    process.onDidExit((status) => {
      if (status === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to install:\n\n${errOutput}`));
      }
    });
    process.start();
  });
}

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
    const logDir = nova.path.join(nova.extension.path, "logs");
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

  console.log(serviceArgs.args?.join(" "));

  client = new LanguageClient(
    "apexskier.json",
    "JSON Language Server",
    {
      type: "stdio",
      ...serviceArgs,
    },
    {
      syntaxes: ["json", "jsonc"],
    }
  );

  // register nova commands
  compositeDisposable.add(registerAutoSuggest(client));
  compositeDisposable.add(registerGoToDefinition(client));

  void (async () => {
    const response = await fetch(
      "https://schemastore.azurewebsites.net/api/json/catalog.json"
    );
    const catalog = await response.json();

    const params: lspTypes.DidChangeConfigurationParams = {
      settings: {
        json: {
          format: {
            enable: false, // TODO
          },
          schemas: catalog.schemas,
          resultLimit: 20, // TODO
        },
      },
    };
    client.sendNotification("workspace/didChangeConfiguration", params);
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
