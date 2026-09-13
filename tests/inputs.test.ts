import { beforeEach, describe, expect, it, vi } from "vitest";
import * as github from "../src/github.js";
import { getInputs } from "../src/inputs.js";

vi.mock("../src/github.js", () => ({
  getInput: vi.fn(),
  setSecret: vi.fn(),
}));

const getInput = vi.mocked(github.getInput);

describe("getInputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInput.mockImplementation((name) => {
      const values: Record<string, string> = {
        server: " https://captain.example.com/ ",
        app: " my-api ",
        token: " secret-token ",
        image: "",
        "tar-file": "",
        "working-directory": " apps/api ",
      };
      return values[name] || "";
    });
  });

  it("trims inputs and masks the token", () => {
    expect(getInputs()).toEqual({
      server: "https://captain.example.com/",
      app: "my-api",
      token: "secret-token",
      image: "",
      tarFile: "",
      workingDirectory: "apps/api",
    });
    expect(github.setSecret).toHaveBeenCalledWith("secret-token");
  });

  it.each(["server", "app", "token"] as const)(
    "identifies a missing %s input",
    (missing) => {
      getInput.mockImplementation((name) => {
        if (name === missing) return " ";
        if (name === "server") return "https://captain.example.com";
        if (["app", "token"].includes(name)) return "value";
        return name === "working-directory" ? "." : "";
      });
      expect(() => getInputs()).toThrow(`Input \"${missing}\" is required`);
    },
  );

  it('rejects "image" with "tar-file"', () => {
    getInput.mockImplementation((name) => {
      if (name === "image") return "image:sha";
      if (name === "tar-file") return "deploy.tar";
      if (name === "working-directory") return ".";
      return name === "server" ? "https://captain.example.com" : "value";
    });
    expect(() => getInputs()).toThrow(
      'Inputs "image" and "tar-file" cannot be used together',
    );
  });

  it.each(["image", "tar-file"])(
    'rejects "working-directory" with %s mode',
    (mode) => {
      getInput.mockImplementation((name) => {
        if (name === mode) return "value";
        if (name === "working-directory") return "apps/api";
        if (name === "server") return "https://captain.example.com";
        return ["app", "token"].includes(name) ? "value" : "";
      });
      expect(() => getInputs()).toThrow(
        'Input "working-directory" can only be used for source deployment',
      );
    },
  );

  it('identifies an invalid "server" URL', () => {
    getInput.mockImplementation((name) => {
      if (name === "server") return "captain.example.com";
      if (["app", "token"].includes(name)) return "value";
      return name === "working-directory" ? "." : "";
    });
    expect(() => getInputs()).toThrow(
      'Input "server" must be a valid HTTP or HTTPS URL',
    );
  });
});
