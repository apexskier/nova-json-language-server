// eslint-disable-next-line no-unused-vars
import type * as lspTypes from "vscode-languageserver-protocol";

nova.commands.register("apexskier.json.forceClearLock", clearLock);

async function clearLock() {
  const installDir = nova.extension.globalStoragePath;
  const lockFilePath = nova.path.join(installDir, "LOCK");
  nova.fs.remove(lockFilePath);
}

export async function installWrappedDependencies(
  compositeDisposable: CompositeDisposable
) {
  let done = false;
  const installDir = nova.extension.globalStoragePath;
  nova.fs.mkdir(installDir);

  // since this extension can run from multiple workspaces, we need to lock this directory to avoid
  // multiple workspace processes writing at the same time
  const lockFilePath = nova.path.join(installDir, "LOCK");
  let lockFile: File;
  try {
    // claim a lock
    lockFile = nova.fs.open(lockFilePath, "x");
    console.log("Claimed lock");
  } catch (err) {
    console.log("Already locked");
    // expected error if file is already present, aka a lock has been acquired
    // wait until it's gone. That indicates another workspace has completed the install
    // note: can't use file watcher here since it's workspace relative
    return new Promise((resolve) =>
      setInterval(() => {
        if (!nova.fs.access(lockFilePath, nova.fs.constants.F_OK)) {
          resolve();
        }
      }, 500)
    );
  }
  lockFile.close();

  function copyForInstall(file: string) {
    try {
      const src = nova.path.join(nova.extension.path, file);
      const dst = nova.path.join(installDir, file);
      if (nova.fs.access(dst, nova.fs.constants.F_OK)) {
        nova.fs.remove(dst);
      }
      nova.fs.copy(src, dst);
    } catch (err) {
      console.warn(err);
    }
  }

  copyForInstall("npm-shrinkwrap.json");
  copyForInstall("package.json");

  await new Promise((resolve, reject) => {
    const process = new Process("/usr/bin/env", {
      args: ["npm", "install"],
      cwd: installDir,
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
    compositeDisposable.add({
      dispose() {
        if (!done) {
          clearLock();
          process.terminate();
        }
      },
    });
    process.start();
  });

  clearLock();
  done = true;
}
