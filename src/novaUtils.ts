export function wrapCommand(
  command: (...args: any[]) => void | Promise<void>
): (...args: any[]) => void {
  return async function wrapped(...args: any[]) {
    try {
      await command(...args);
    } catch (err: any) {
      nova.workspace.showErrorMessage(err);
    }
  };
}

export async function openFile(uri: string) {
  const newEditor = await nova.workspace.openFile(uri);
  if (newEditor) {
    return newEditor;
  }
  console.warn("failed first open attempt, retrying once", uri);
  // try one more time, this doesn't resolve if the file isn't already open. Need to file a bug
  return await nova.workspace.openFile(uri);
}
