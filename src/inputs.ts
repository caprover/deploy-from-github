import { getInput, setSecret } from "./github.js";
import path from "node:path";

export interface Inputs {
  server: string;
  app: string;
  token: string;
  image: string;
  tarFile: string;
  workingDirectory: string;
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

  const server = readRequiredInput("server");
  try {
    const url = new URL(server);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error();
  } catch {
    throw new Error('Input "server" must be a valid HTTP or HTTPS URL');
  }

  const image = getInput("image").trim();
  const tarFile = getInput("tar-file").trim();
  const normalizedWorkingDirectory = path.normalize(
    getInput("working-directory").trim() || ".",
  );
  const workingDirectory =
    normalizedWorkingDirectory === `.${path.sep}`
      ? "."
      : normalizedWorkingDirectory;

  if (image && tarFile) {
    throw new Error('Inputs "image" and "tar-file" cannot be used together');
  }
  if ((image || tarFile) && workingDirectory !== ".") {
    throw new Error(
      'Input "working-directory" can only be used for source deployment',
    );
  }

  return {
    server,
    app: readRequiredInput("app"),
    token,
    image,
    tarFile,
    workingDirectory,
  };
}
