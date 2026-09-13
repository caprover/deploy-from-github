import { access } from "node:fs/promises";
import path from "node:path";
import { createGitArchive } from "./archive.js";
import { CapRoverClient } from "./caprover.js";
import { info } from "./github.js";
import { Inputs } from "./inputs.js";

export async function deploy(inputs: Inputs): Promise<void> {
  const client = new CapRoverClient(inputs.server, inputs.token);

  if (inputs.image) {
    info(`Deploying image ${inputs.image} to ${inputs.app}...`);
    await client.deployImage(inputs.app, inputs.image);
    return;
  }

  if (inputs.branch) {
    const archive = await createGitArchive(inputs.branch);
    try {
      info(`Deploying Git ref ${inputs.branch} to ${inputs.app}...`);
      await client.uploadArchive(inputs.app, archive.path, archive.gitHash);
    } finally {
      await archive.cleanup();
    }
    return;
  }

  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const tarPath = path.resolve(workspace, "deploy.tar");
  try {
    await access(tarPath);
  } catch {
    throw new Error(`Deployment archive was not found: ${tarPath}`);
  }
  info(`Deploying ${tarPath} to ${inputs.app}...`);
  await client.uploadArchive(inputs.app, tarPath, "");
}
