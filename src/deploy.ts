import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createGitArchive, getHeadCommit } from "./archive.js";
import { CapRoverClient } from "./caprover.js";
import { info } from "./github.js";
import { Inputs } from "./inputs.js";

export async function deploy(inputs: Inputs): Promise<void> {
  const client = new CapRoverClient(inputs.server, inputs.token);

  info("Deploying to CapRover");
  info("");
  info(`App:       ${inputs.app}`);
  info(`Server:    ${inputs.server}`);

  if (inputs.image) {
    let gitHash = "";
    try {
      gitHash = await getHeadCommit();
    } catch {
      const candidateGitHash = (process.env.GITHUB_SHA || "").trim();
      if (/^[a-f0-9]{40}$/i.test(candidateGitHash)) gitHash = candidateGitHash;
    }
    info(`Image:     ${inputs.image}`);
    if (gitHash) info(`Commit:    ${gitHash.slice(0, 7)}`);
    info("");
    await client.deployImage(inputs.app, inputs.image, gitHash);
    return;
  }

  if (!inputs.tarFile) {
    const archive = await createGitArchive(inputs.workingDirectory);
    try {
      info("Source:    Git commit");
      info(`Commit:    ${archive.gitHash.slice(0, 7)}`);
      if (inputs.workingDirectory !== ".") {
        info(`Directory: ${inputs.workingDirectory}`);
      }
      info("");
      info("✓ Source packaged");
      await client.uploadArchive(inputs.app, archive.path, archive.gitHash);
    } finally {
      await archive.cleanup();
    }
    return;
  }

  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const workspacePath = await realpath(workspace);
  const requestedTarPath = path.resolve(workspacePath, inputs.tarFile);
  let tarPath: string;
  try {
    tarPath = await realpath(requestedTarPath);
    const relativeTarPath = path.relative(workspacePath, tarPath);
    if (
      relativeTarPath === ".." ||
      relativeTarPath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeTarPath)
    ) {
      throw new Error("path is outside the workspace");
    }
    const tarStat = await stat(tarPath);
    if (!tarStat.isFile()) throw new Error("path is not a file");
  } catch {
    throw new Error(
      `Input "tar-file" does not point to a file inside the GitHub workspace: ${requestedTarPath}`,
    );
  }
  info(`Source:    Prepared tar`);
  info(`Tar file:  ${inputs.tarFile}`);
  info("");
  await client.uploadArchive(inputs.app, tarPath, "");
}
