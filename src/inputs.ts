import { getInput, setSecret } from "./github.js";

export interface Inputs {
  server: string;
  app: string;
  token: string;
  branch: string;
  image: string;
}

function readRequiredInput(name: "server" | "app" | "token"): string {
  const value = getInput(name).trim();
  if (!value) {
    throw new Error(`Input \"${name}\" is required`);
  }
  return value;
}

export function getInputs(): Inputs {
  const token = readRequiredInput("token");
  setSecret(token);

  return {
    server: readRequiredInput("server"),
    app: readRequiredInput("app"),
    token,
    branch: getInput("branch").trim(),
    image: getInput("image").trim(),
  };
}
