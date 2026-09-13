import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { createGitArchive } from "../src/archive.js";

const execFileAsync = promisify(execFile);
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("createGitArchive", () => {
  it("archives a ref and supports spaces and special characters in paths", async () => {
    const repository = await mkdtemp(path.join(tmpdir(), "repo with spaces-"));
    directories.push(repository);
    await execFileAsync("git", ["init"], { cwd: repository });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], {
      cwd: repository,
    });
    await execFileAsync("git", ["config", "user.name", "Test"], {
      cwd: repository,
    });
    await mkdir(path.join(repository, "dir [special]"));
    await writeFile(
      path.join(repository, "dir [special]", "hello world.txt"),
      "hello",
    );
    await execFileAsync("git", ["add", "."], { cwd: repository });
    await execFileAsync("git", ["commit", "-m", "fixture"], {
      cwd: repository,
    });

    const archive = await createGitArchive("HEAD", repository);
    expect(archive.gitHash).toMatch(/^[a-f0-9]{40}$/);
    await expect(access(archive.path)).resolves.toBeUndefined();

    const { stdout } = await execFileAsync("tar", ["-tf", archive.path]);
    expect(stdout).toContain("dir [special]/hello world.txt");

    await archive.cleanup();
    await expect(access(archive.path)).rejects.toThrow();
  });

  it("cleans its temporary directory when archiving fails", async () => {
    const repository = await mkdtemp(path.join(tmpdir(), "bad-repo-"));
    directories.push(repository);
    await execFileAsync("git", ["init"], { cwd: repository });
    await expect(createGitArchive("missing", repository)).rejects.toThrow(
      'Failed to archive Git ref "missing"',
    );
    expect(
      await readFile(path.join(repository, ".git", "HEAD"), "utf8"),
    ).toBeTruthy();
  });
});
