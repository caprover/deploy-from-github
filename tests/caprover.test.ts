import { createServer, IncomingMessage } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CapRoverClient } from "../src/caprover.js";

interface CapturedRequest {
  url: string;
  headers: IncomingMessage["headers"];
  body: Buffer;
}

const directories: string[] = [];
const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function startServer(
  response: object = { status: 101, description: "Build started" },
): Promise<{ url: string; request: Promise<CapturedRequest> }> {
  let resolveRequest!: (request: CapturedRequest) => void;
  const captured = new Promise<CapturedRequest>((resolve) => {
    resolveRequest = resolve;
  });
  const server = createServer((request, result) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      resolveRequest({
        url: request.url || "",
        headers: request.headers,
        body: Buffer.concat(chunks),
      });
      result.setHeader("content-type", "application/json");
      result.end(JSON.stringify(response));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  closers.push(
    () => new Promise<void>((resolve) => server.close(() => resolve())),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    request: captured,
  };
}

describe("CapRoverClient", () => {
  it.each(["", "/"])(
    "uploads an archive with a server URL suffix of %j",
    async (suffix) => {
      const fixture = await mkdtemp(path.join(tmpdir(), "caprover archive-"));
      directories.push(fixture);
      const archivePath = path.join(fixture, "deploy file.tar");
      await writeFile(archivePath, "archive-content");
      const server = await startServer();

      await new CapRoverClient(
        `${server.url}${suffix}`,
        "app-token",
      ).uploadArchive("my-api", archivePath, "abc123");
      const request = await server.request;

      expect(request.url).toBe("/api/v2/user/apps/appData/my-api?detached=1");
      expect(request.headers["x-captain-app-token"]).toBe("app-token");
      expect(request.headers["x-namespace"]).toBe("captain");
      expect(request.headers["content-type"]).toContain("multipart/form-data");
      expect(request.body.toString()).toContain("archive-content");
      expect(request.body.toString()).toContain("abc123");
    },
  );

  it("sends the CLI-compatible image payload", async () => {
    const server = await startServer({ status: 100 });
    await new CapRoverClient(server.url, "token").deployImage(
      "my-api",
      "ghcr.io/acme/api:sha",
      "a".repeat(40),
    );
    const request = await server.request;
    const payload = JSON.parse(request.body.toString());
    expect(JSON.parse(payload.captainDefinitionContent)).toEqual({
      schemaVersion: 2,
      imageName: "ghcr.io/acme/api:sha",
    });
    expect(payload.gitHash).toBe("a".repeat(40));
  });

  it("propagates a useful CapRover API error", async () => {
    const server = await startServer({
      status: 1106,
      description: "App token is invalid",
    });
    await expect(
      new CapRoverClient(server.url, "bad-token").deployImage(
        "app",
        "image",
        "",
      ),
    ).rejects.toThrow(
      "CapRover rejected the deployment (status 1106): App token is invalid",
    );
  });
});
