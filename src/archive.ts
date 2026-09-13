import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface TemporaryArchive {
  path: string;
  gitHash: string;
  cleanup: () => Promise<void>;
}

export async function createGitArchive(
  ref: string,
  cwd = process.env.GITHUB_WORKSPACE || process.cwd(),
): Promise<TemporaryArchive> {
  const directory = await mkdtemp(path.join(tmpdir(), "caprover-deploy-"));
  const archivePath = path.join(directory, "deploy.tar");

  try {
    await execFileAsync(
      "git",
      ["archive", "--format=tar", "--output", archivePath, ref],
      { cwd },
    );
    const { stdout } = await execFileAsync("git", ["rev-parse", ref], {
      cwd,
    });
    const gitHash = stdout.trim();
    if (!/^[a-f0-9]{40}$/.test(gitHash)) {
      throw new Error(`git rev-parse returned an invalid commit: ${gitHash}`);
    }

    return {
      path: archivePath,
      gitHash,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to archive Git ref \"${ref}\": ${message}`);
  }
}
