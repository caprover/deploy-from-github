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
  branch: "",
  image: "",
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

beforeEach(() => vi.clearAllMocks());

function client() {
  return vi.mocked(CapRoverClient).mock.results[0].value as {
    uploadArchive: ReturnType<typeof vi.fn>;
    deployImage: ReturnType<typeof vi.fn>;
  };
}

describe("deploy v1 behavior", () => {
  it("gives image precedence over branch", async () => {
    await deploy({ ...base, image: "image:sha", branch: "main" });
    expect(client().deployImage).toHaveBeenCalledWith("my-api", "image:sha");
    expect(createGitArchive).not.toHaveBeenCalled();
  });

  it("archives and deploys the selected branch, then cleans up", async () => {
    const cleanup = vi.fn();
    vi.mocked(createGitArchive).mockResolvedValue({
      path: "/tmp/deploy.tar",
      gitHash: "a".repeat(40),
      cleanup,
    });
    await deploy({ ...base, branch: "main" });
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
    await expect(deploy({ ...base, branch: "main" })).rejects.toThrow(
      "upload failed",
    );
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("uploads the implicit workspace deploy.tar", async () => {
    const workspace = await mkdtemp(
      path.join(tmpdir(), "workspace with spaces-"),
    );
    directories.push(workspace);
    const tarPath = path.join(workspace, "deploy.tar");
    await writeFile(tarPath, "fixture");
    vi.stubEnv("GITHUB_WORKSPACE", workspace);
    await deploy(base);
    expect(client().uploadArchive).toHaveBeenCalledWith("my-api", tarPath, "");
  });

  it("fails clearly when implicit deploy.tar is missing", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "empty-workspace-"));
    directories.push(workspace);
    vi.stubEnv("GITHUB_WORKSPACE", workspace);
    await expect(deploy(base)).rejects.toThrow(
      `Deployment archive was not found: ${path.join(workspace, "deploy.tar")}`,
    );
    await expect(access(path.join(workspace, "deploy.tar"))).rejects.toThrow();
  });
});
