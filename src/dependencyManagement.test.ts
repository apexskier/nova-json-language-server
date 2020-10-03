const F_OK = Symbol("F_OK");
(global as any).nova = Object.assign(nova, {
  commands: {
    register: jest.fn(),
  },
  extension: {
    globalStoragePath: "/globalStorage",
    path: "/extension",
  },
  fs: {
    constants: {
      F_OK,
    },
  },
  path: {
    join(...args: string[]) {
      return args.join("/");
    },
  },
});

jest.useFakeTimers();

describe("dependencyManagement", () => {
  // dynamically require so global mocks are setup before top level code execution
  const { installWrappedDependencies } = require("./dependencyManagement");
  it("registers a lock clearing command", () => {
    expect(nova.commands.register).toBeCalledTimes(1);
    expect(nova.commands.register).toBeCalledWith(
      "apexskier.json.forceClearLock",
      expect.any(Function)
    );
  });

  const mockFile = { close: jest.fn() };
  global.console.log = jest.fn();
  nova.fs.open = jest.fn();
  nova.fs.copy = jest.fn();
  nova.fs.remove = jest.fn();
  nova.fs.mkdir = jest.fn();
  nova.fs.access = jest.fn();
  const ProcessMock: jest.Mock<Partial<
    Process
  >> = jest.fn().mockImplementationOnce(() => ({
    onStdout: jest.fn(),
    onStderr: jest.fn(),
    onDidExit: jest.fn((cb) => {
      cb(0);
      return { dispose: jest.fn() };
    }),
    start: jest.fn(),
  }));
  (global as any).Process = ProcessMock;

  beforeEach(() => {
    (nova.fs.open as jest.Mock)
      .mockReset()
      .mockImplementationOnce(() => mockFile);
    (nova.fs.copy as jest.Mock).mockReset();
    (nova.fs.remove as jest.Mock).mockReset();
    (nova.fs.mkdir as jest.Mock).mockReset();
    (nova.fs.access as jest.Mock).mockReset();
    mockFile.close.mockReset();
    ProcessMock.mockReset();
  });

  it("installs dependencies into extension global storage, and locks globally while doing so", async () => {
    ProcessMock.mockImplementationOnce(() => ({
      onStdout: jest.fn(),
      onStderr: jest.fn(),
      onDidExit: jest.fn((cb) => {
        cb(0);
        return { dispose: jest.fn() };
      }),
      start: jest.fn(),
    }));

    await installWrappedDependencies();

    expect(nova.fs.mkdir).toBeCalledTimes(1);
    expect(nova.fs.mkdir).toBeCalledWith("/globalStorage");
    expect(nova.fs.open).toBeCalledTimes(1);
    expect(nova.fs.open).toBeCalledWith("/globalStorage/LOCK", "x");
    expect(mockFile.close).toBeCalledTimes(1);
    expect(nova.fs.access).toBeCalledTimes(2);
    expect(nova.fs.access).toHaveBeenNthCalledWith(
      1,
      "/globalStorage/npm-shrinkwrap.json",
      F_OK
    );
    expect(nova.fs.access).toHaveBeenNthCalledWith(
      2,
      "/globalStorage/package.json",
      F_OK
    );
    expect(nova.fs.copy).toBeCalledTimes(2);
    expect(nova.fs.copy).toHaveBeenNthCalledWith(
      1,
      "/extension/npm-shrinkwrap.json",
      "/globalStorage/npm-shrinkwrap.json"
    );
    expect(nova.fs.copy).toHaveBeenNthCalledWith(
      2,
      "/extension/package.json",
      "/globalStorage/package.json"
    );
    expect(Process).toBeCalledTimes(1);
    expect(Process).toHaveBeenCalledWith("/usr/bin/env", {
      args: ["npm", "install"],
      cwd: "/globalStorage",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        NO_UPDATE_NOTIFIER: "true",
      },
    });
    expect(nova.fs.remove).toHaveBeenCalledTimes(1);
    expect(nova.fs.remove).toBeCalledWith("/globalStorage/LOCK");
  });

  it("removes npm meta files first before replacing them", async () => {
    (nova.fs.open as jest.Mock).mockReset().mockImplementationOnce(() => {
      throw new Error("locked");
    });
    (nova.fs.access as jest.Mock)
      .mockReset()
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => false);

    const p = installWrappedDependencies();

    expect(nova.fs.open).toBeCalledTimes(1);
    expect(nova.fs.open).toBeCalledWith("/globalStorage/LOCK", "x");
    expect(nova.fs.access).not.toBeCalled();

    // every half second, checks if lock is cleared
    jest.runTimersToTime(500);
    expect(nova.fs.access).toBeCalledTimes(1);
    expect(nova.fs.access).toBeCalledWith("/globalStorage/LOCK", F_OK);
    jest.runTimersToTime(500);
    expect(nova.fs.access).toBeCalledTimes(2);
    jest.runTimersToTime(500);
    expect(nova.fs.access).toBeCalledTimes(3);

    await p;

    expect(mockFile.close).not.toBeCalled();
    expect(nova.fs.copy).not.toBeCalled();
    expect(Process).not.toBeCalled();
    expect(nova.fs.remove).not.toBeCalled();
  });

  it("fails if installation fails", async () => {
    global.console.warn = jest.fn();
    ProcessMock.mockImplementationOnce(() => ({
      onStdout: jest.fn(),
      onStderr: jest.fn((cb) => {
        cb("reason");
      }),
      onDidExit: jest.fn((cb) => {
        cb(1);
        return { dispose: jest.fn() };
      }),
      start: jest.fn(),
    }));

    await expect(installWrappedDependencies()).rejects
      .toThrowErrorMatchingInlineSnapshot(`
            "Failed to install:

            reason"
          `);
  });
});
