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
        branch: " main ",
        image: "",
      };
      return values[name] || "";
    });
  });

  it("trims inputs and masks the token", () => {
    expect(getInputs()).toEqual({
      server: "https://captain.example.com/",
      app: "my-api",
      token: "secret-token",
      branch: "main",
      image: "",
    });
    expect(github.setSecret).toHaveBeenCalledWith("secret-token");
  });

  it.each(["server", "app", "token"] as const)(
    "identifies a missing %s input",
    (missing) => {
      getInput.mockImplementation((name) => (name === missing ? " " : "value"));
      expect(() => getInputs()).toThrow(`Input \"${missing}\" is required`);
    },
  );
});
