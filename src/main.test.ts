import * as informationViewModule from "./informationView";

jest.mock("./informationView");
jest.mock("./dependencyManagement");

jest.useFakeTimers();

(global as any).fetch = jest.fn(() =>
  Promise.resolve({
    json: jest.fn(() => Promise.resolve({ schemas: [] })),
  })
);

(global as any).nova = Object.assign(nova, {
  commands: {
    register: jest.fn(),
  },
  workspace: {},
  extension: {
    path: "/extension",
  },
  fs: {},
  path: {
    join(...args: string[]) {
      return args.join("/");
    },
  },
});

const originalLog = global.console.log;
global.console.log = jest.fn((...args) => {
  if (
    args[0] === "activating..." ||
    args[0] === "activated" ||
    args[0] === "reloading..." ||
    args[0] === "registered schemas"
  ) {
    return;
  }
  originalLog(...args);
});
global.console.info = jest.fn();

const CompositeDisposableMock: jest.Mock<Partial<
  CompositeDisposable
>> = jest
  .fn()
  .mockImplementation(() => ({ add: jest.fn(), dispose: jest.fn() }));
(global as any).CompositeDisposable = CompositeDisposableMock;
const ProcessMock: jest.Mock<Partial<Process>> = jest.fn();
(global as any).Process = ProcessMock;
const LanguageClientMock: jest.Mock<Partial<LanguageClient>> = jest.fn();
(global as any).LanguageClient = LanguageClientMock;

describe("test suite", () => {
  // dynamically require so global mocks are setup before top level code execution
  const { activate, deactivate } = require("./main");

  function resetMocks() {
    nova.fs.access = jest.fn().mockReturnValue(true);
    (nova.commands.register as jest.Mock).mockReset();
    LanguageClientMock.mockReset().mockImplementation(() => ({
      onRequest: jest.fn(),
      onNotification: jest.fn(),
      sendNotification: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    }));
    ProcessMock.mockReset().mockImplementation(() => ({
      onStdout: jest.fn(),
      onStderr: jest.fn(),
      onDidExit: jest.fn((cb) => {
        cb(0);
        return { dispose: jest.fn() };
      }),
      start: jest.fn(),
    }));
    (informationViewModule.InformationView as jest.Mock).mockReset();
  }

  const reload = (nova.commands.register as jest.Mock).mock.calls.find(
    ([command]) => command == "apexskier.json.reload"
  )[1];

  test("global behavior", () => {
    expect(nova.commands.register).toBeCalledTimes(2);
    expect(nova.commands.register).toBeCalledWith(
      "apexskier.json.reload",
      expect.any(Function)
    );

    expect(CompositeDisposable).toBeCalledTimes(1);
  });

  function assertActivationBehavior() {
    expect(nova.commands.register).toBeCalledTimes(2);
    expect(nova.commands.register).toBeCalledWith(
      "apexskier.json.goToDefinition",
      expect.any(Function)
    );
    expect(nova.commands.register).toBeCalledWith(
      "apexskier.json.autoSuggest",
      expect.any(Function)
    );

    expect(Process).toBeCalledTimes(1);
    // makes the run script executable
    expect(Process).toHaveBeenCalledWith("/usr/bin/env", {
      args: ["chmod", "u+x", "/extension/run.sh"],
    });

    expect(LanguageClientMock).toBeCalledTimes(1);
    const languageClient: LanguageClient =
      LanguageClientMock.mock.results[0].value;
    expect(languageClient.start).toBeCalledTimes(1);

    expect(languageClient.onRequest).toBeCalledTimes(2);
    expect(languageClient.onRequest).toBeCalledWith(
      "workspace/applyEdit",
      expect.any(Function)
    );
    expect(languageClient.onRequest).toBeCalledWith(
      "vscode/content",
      expect.any(Function)
    );

    expect(informationViewModule.InformationView).toBeCalledTimes(1);
    const informationView = (informationViewModule.InformationView as jest.Mock<
      informationViewModule.InformationView
    >).mock.instances[0];
    expect(informationView.status).toBe("Running");
    expect(informationView.reload).toBeCalledTimes(1);
  }

  describe("activate and deactivate", () => {
    it("installs dependencies, runs the server, fetches schemas", async () => {
      resetMocks();
      const remoteSchemaMapping = Symbol("remote schema mapping");
      ((global as any).fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          json: jest.fn(() =>
            Promise.resolve({ schemas: [remoteSchemaMapping] })
          ),
        })
      );
      (ProcessMock as jest.Mock<Partial<Process>>)
        .mockImplementationOnce(() => ({
          onStdout: jest.fn(),
          onStderr: jest.fn(),
          onDidExit: jest.fn((cb) => {
            cb(0);
            return { dispose: jest.fn() };
          }),
          start: jest.fn(),
        }))
        .mockImplementationOnce(() => ({
          onStdout: jest.fn(),
          onStderr: jest.fn(),
          onDidExit: jest.fn((cb) => {
            cb(0);
            return { dispose: jest.fn() };
          }),
          start: jest.fn(),
        }));

      await activate();

      assertActivationBehavior();

      deactivate();

      const languageClient: LanguageClient =
        LanguageClientMock.mock.results[0].value;
      expect(languageClient.stop).toBeCalledTimes(1);
      expect(languageClient.sendNotification).toBeCalledTimes(1);
      expect(languageClient.sendNotification).toBeCalledWith(
        "workspace/didChangeConfiguration",
        {
          settings: {
            json: {
              schemas: [
                {
                  description: "Nova extension manifest file",
                  fileMatch: ["*.novaextension/extension.json"],
                  name: "Nova Extension",
                  url: "file:///extension/nova-extension-schema.json",
                },
                remoteSchemaMapping,
              ],
            },
          },
        }
      );
      const compositeDisposable: CompositeDisposable =
        CompositeDisposableMock.mock.results[0].value;
      expect(compositeDisposable.dispose).toBeCalledTimes(1);
    });

    it("shows an error if activation fails", async () => {
      resetMocks();
      global.console.error = jest.fn();
      global.console.warn = jest.fn();
      nova.workspace.showErrorMessage = jest.fn();
      const dependencyManagementModule = require("./dependencyManagement");
      (dependencyManagementModule.installWrappedDependencies as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error("an error");
        }
      );

      await activate();

      expect(nova.workspace.showErrorMessage).toBeCalledWith(
        new Error("an error")
      );
    });

    test("reload", async () => {
      resetMocks();

      await reload();

      const compositeDisposable: CompositeDisposable =
        CompositeDisposableMock.mock.results[0].value;
      expect(compositeDisposable.dispose).toBeCalledTimes(2);

      assertActivationBehavior();
    });
  });
});
