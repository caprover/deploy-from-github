import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitArchive, getHeadCommit } from "../src/archive.js";
import { CapRoverClient } from "../src/caprover.js";
import { deploy } from "../src/deploy.js";
import { Inputs } from "../src/inputs.js";

vi.mock("../src/github.js", () => ({ info: vi.fn() }));
vi.mock("../src/archive.js", () => ({
  createGitArchive: vi.fn(),
  getHeadCommit: vi.fn(),
}));
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
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getHeadCommit).mockRejectedValue(new Error("No checkout"));
});

function client() {
  return vi.mocked(CapRoverClient).mock.results[0].value as {
    uploadArchive: ReturnType<typeof vi.fn>;
    deployImage: ReturnType<typeof vi.fn>;
  };
}

describe("deploy v2 behavior", () => {
  it("deploys an image with commit metadata", async () => {
    vi.stubEnv("GITHUB_SHA", "a".repeat(40));
    vi.mocked(getHeadCommit).mockResolvedValue("b".repeat(40));
    await deploy({ ...base, image: "image:sha" });
    expect(client().deployImage).toHaveBeenCalledWith(
      "my-api",
      "image:sha",
      "b".repeat(40),
    );
    expect(createGitArchive).not.toHaveBeenCalled();
  });

  it("uses GITHUB_SHA for image metadata when source is not checked out", async () => {
    vi.stubEnv("GITHUB_SHA", "a".repeat(40));
    await deploy({ ...base, image: "image:sha" });
    expect(client().deployImage).toHaveBeenCalledWith(
      "my-api",
      "image:sha",
      "a".repeat(40),
    );
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
    vi.stubEnv("GITHUB_WORKSPACE", workspace);
    await deploy({ ...base, tarFile: "dist/deploy file.tar" });
    expect(client().uploadArchive).toHaveBeenCalledWith("my-api", tarPath, "");
  });

  it("fails clearly when the explicit tar is missing", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "empty-workspace-"));
    directories.push(workspace);
    vi.stubEnv("GITHUB_WORKSPACE", workspace);
    await expect(deploy({ ...base, tarFile: "missing.tar" })).rejects.toThrow(
      `Input "tar-file" does not point to a file inside the GitHub workspace: ${path.join(workspace, "missing.tar")}`,
    );
    await expect(access(path.join(workspace, "missing.tar"))).rejects.toThrow();
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
