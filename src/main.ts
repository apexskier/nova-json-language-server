import type * as lspTypes from "vscode-languageserver-protocol";
// import { registerAutoSuggest } from "./commands/autoSuggest";
// import { registerCodeAction } from "./commands/codeAction";
// import { registerFindReferences } from "./commands/findReferences";
// import { registerFindSymbol } from "./commands/findSymbol";
// import { registerGoToDefinition } from "./commands/goToDefinition";
// import { registerRename } from "./commands/rename";
// import { registerSignatureHelp } from "./commands/signatureHelp";
// import { registerApplyEdit } from "./requests/applyEdit";
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
  if (nova.inDevMode() && nova.workspace.path) {
    const logDir = nova.path.join(nova.workspace.path, ".log");
    console.log("logging to", logDir);

    // this breaks functionality
    const inLog = nova.path.join(logDir, "languageClient-in.log");
    const outLog = nova.path.join(logDir, "languageClient-out.log");
    serviceArgs = {
      // path: runFile,
      path: "/usr/bin/env",
      args: ["bash", "-c", `tee "${inLog}" | "${runFile}" | tee "${outLog}"`],
      // args: ["bash", "-c", `"${runFile}" | tee "${outLog}"`],
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
    },
    {
      syntaxes: ["json"],
    }
  );

  // register nova commands
  // compositeDisposable.add(registerAutoSuggest(client));
  // compositeDisposable.add(registerCodeAction(client));
  // compositeDisposable.add(registerFindReferences(client));
  // compositeDisposable.add(registerFindSymbol(client));
  // compositeDisposable.add(registerGoToDefinition(client));
  // compositeDisposable.add(registerRename(client));
  // if (nova.inDevMode()) {
  //   compositeDisposable.add(registerSignatureHelp(client));
  // }

  // register server-pushed commands
  // registerApplyEdit(client);

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

  const params: lspTypes.DidChangeConfigurationParams = {
    settings: {
      json: {
        format: {
          enable: false, // TODO
        },
        schemas: [
          {
            fileMatch: ["tsconfig.json", "*.tsconfig.json"],
            url: "https://json.schemastore.org/tsconfig",
          },
        ],
        resultLimit: 20, // TODO
      },
    },
  };
  client.sendNotification("workspace/didChangeConfiguration", params);

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
