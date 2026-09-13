import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitArchive } from "../src/archive.js";
import { CapRoverClient } from "../src/caprover.js";
import { deploy } from "../src/deploy.js";
import { Inputs } from "../src/inputs.js";

vi.mock("../src/github.js", () => ({ info: vi.fn() }));
vi.mock("../src/archive.js", () => ({ createGitArchive: vi.fn() }));
vi.mock("../src/caprover.js", () => ({
  CapRoverClient: vi.fn(function () {
    return { uploadArchive: vi.fn(), deployImage: vi.fn() };
  }),
}));

const base: Inputs = {
  server: "https://captain.example.com",
  app: "my-api",
  token: "token",
  image: "",
  tarFile: "",
  workingDirectory: ".",
};

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

beforeEach(() => vi.clearAllMocks());

function client() {
  return vi.mocked(CapRoverClient).mock.results[0].value as {
    uploadArchive: ReturnType<typeof vi.fn>;
    deployImage: ReturnType<typeof vi.fn>;
  };
}

describe("deploy v2 behavior", () => {
  it("deploys an image with commit metadata", async () => {
    process.env.GITHUB_SHA = "a".repeat(40);
    await deploy({ ...base, image: "image:sha" });
    expect(client().deployImage).toHaveBeenCalledWith(
      "my-api",
      "image:sha",
      "a".repeat(40),
    );
    expect(createGitArchive).not.toHaveBeenCalled();
    delete process.env.GITHUB_SHA;
  });

  it("archives and deploys checked-out HEAD, then cleans up", async () => {
    const cleanup = vi.fn();
    vi.mocked(createGitArchive).mockResolvedValue({
      path: "/tmp/deploy.tar",
      gitHash: "a".repeat(40),
      cleanup,
    });
    await deploy(base);
    expect(createGitArchive).toHaveBeenCalledWith(".");
    expect(client().uploadArchive).toHaveBeenCalledWith(
      "my-api",
      "/tmp/deploy.tar",
      "a".repeat(40),
    );
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("cleans a branch archive after an upload failure", async () => {
    const cleanup = vi.fn();
    vi.mocked(createGitArchive).mockResolvedValue({
      path: "/tmp/deploy.tar",
      gitHash: "a".repeat(40),
      cleanup,
    });
    vi.mocked(CapRoverClient).mockImplementationOnce(function () {
      return {
        uploadArchive: vi.fn().mockRejectedValue(new Error("upload failed")),
        deployImage: vi.fn(),
      } as never;
    });
    await expect(deploy(base)).rejects.toThrow("upload failed");
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("uploads an explicit tar relative to the workspace", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "workspace with spaces-"),
    );
    directories.push(workspace);
    const tarPath = path.join(workspace, "dist", "deploy file.tar");
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(path.dirname(tarPath), { recursive: true }),
    );
    await writeFile(tarPath, "fixture");
    process.env.GITHUB_WORKSPACE = workspace;
    await deploy({ ...base, tarFile: "dist/deploy file.tar" });
    expect(client().uploadArchive).toHaveBeenCalledWith("my-api", tarPath, "");
    delete process.env.GITHUB_WORKSPACE;
  });

  it("fails clearly when the explicit tar is missing", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "empty-workspace-"));
    directories.push(workspace);
    process.env.GITHUB_WORKSPACE = workspace;
    await expect(deploy({ ...base, tarFile: "missing.tar" })).rejects.toThrow(
      `Input "tar-file" does not point to a file inside the GitHub workspace: ${path.join(workspace, "missing.tar")}`,
    );
    await expect(access(path.join(workspace, "missing.tar"))).rejects.toThrow();
    delete process.env.GITHUB_WORKSPACE;
  });

  it("passes working-directory to source packaging", async () => {
    vi.mocked(createGitArchive).mockResolvedValue({
      path: "/tmp/deploy.tar",
      gitHash: "b".repeat(40),
      cleanup: vi.fn(),
    });
    await deploy({ ...base, workingDirectory: "apps/api" });
    expect(createGitArchive).toHaveBeenCalledWith("apps/api");
  });
});
