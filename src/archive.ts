import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm, stat } from "node:fs/promises";
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
  workingDirectory: string,
  workspace = process.env.GITHUB_WORKSPACE || process.cwd(),
): Promise<TemporaryArchive> {
  const directory = await mkdtemp(path.join(tmpdir(), "caprover-deploy-"));
  const archivePath = path.join(directory, "deploy.tar");

  try {
    const workspacePath = await realpath(workspace);
    const sourcePath = await realpath(
      path.resolve(workspacePath, workingDirectory),
    );
    const sourceStat = await stat(sourcePath);
    const relativeSource = path.relative(workspacePath, sourcePath);
    if (
      !sourceStat.isDirectory() ||
      relativeSource === ".." ||
      relativeSource.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeSource)
    ) {
      throw new Error(
        "must resolve to a directory inside the GitHub workspace",
      );
    }

    const treeRef = relativeSource
      ? `HEAD:${relativeSource.split(path.sep).join("/")}`
      : "HEAD";
    await execFileAsync(
      "git",
      ["archive", "--format=tar", "--output", archivePath, treeRef],
      { cwd: workspacePath },
    );
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: workspacePath,
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
    throw new Error(
      `Failed to archive input "working-directory" (${workingDirectory}): ${message}`,
    );
  }
}
