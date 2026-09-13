import { createReadStream } from "node:fs";
import http from "node:http";
import https from "node:https";
import FormData from "form-data";

const SUCCESS = new Set([100, 101]);
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

interface ApiResponse {
  status?: number;
  description?: string;
  data?: unknown;
}

export class CapRoverClient {
  private readonly baseUrl: string;

  constructor(
    server: string,
    private readonly token: string,
  ) {
    this.baseUrl = `${server.replace(/\/+$/, "")}/api/v2`;
  }

  async uploadArchive(
    app: string,
    archivePath: string,
    gitHash: string,
  ): Promise<void> {
    const form = new FormData();
    form.append("sourceFile", createReadStream(archivePath));
    form.append("gitHash", gitHash);
    await this.request(app, form, form.getHeaders());
  }

  async deployImage(app: string, imageName: string): Promise<void> {
    const body = JSON.stringify({
      captainDefinitionContent: JSON.stringify({
        schemaVersion: 2,
        imageName,
      }),
      gitHash: "",
    });
    await this.request(app, body, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body).toString(),
    });
  }

  private request(
    app: string,
    body: FormData | string,
    bodyHeaders: Record<string, string>,
  ): Promise<void> {
    const url = new URL(
      `${this.baseUrl}/user/apps/appData/${encodeURIComponent(app)}?detached=1`,
    );
    const transport = url.protocol === "https:" ? https : http;

    return new Promise((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method: "POST",
          headers: {
            "x-captain-app-token": this.token,
            "x-namespace": "captain",
            ...bodyHeaders,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("error", (error) =>
            reject(new Error(`CapRover response failed: ${error.message}`)),
          );
          response.on("aborted", () =>
            reject(new Error("CapRover response was aborted")),
          );
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          response.on("end", () => {
            const responseBody = Buffer.concat(chunks).toString("utf8");
            let parsed: ApiResponse;
            try {
              parsed = responseBody ? JSON.parse(responseBody) : {};
            } catch {
              reject(
                new Error(
                  `CapRover returned an invalid response (HTTP ${response.statusCode}): ${responseBody.slice(0, 500)}`,
                ),
              );
              return;
            }

            if (
              response.statusCode === undefined ||
              response.statusCode < 200 ||
              response.statusCode >= 300
            ) {
              reject(
                new Error(
                  `CapRover request failed (HTTP ${response.statusCode}): ${parsed.description || responseBody || "No response body"}`,
                ),
              );
              return;
            }

            if (!parsed.status || !SUCCESS.has(parsed.status)) {
              reject(
                new Error(
                  `CapRover rejected the deployment (status ${parsed.status ?? "unknown"}): ${parsed.description || "No description provided"}`,
                ),
              );
              return;
            }
            resolve();
          });
        },
      );
      request.on("error", (error) =>
        reject(new Error(`Unable to reach CapRover: ${error.message}`)),
      );
      request.setTimeout(REQUEST_TIMEOUT_MS, () =>
        request.destroy(
          new Error("CapRover request timed out after 5 minutes"),
        ),
      );

      if (typeof body === "string") {
        request.end(body);
      } else {
        body.on("error", (error) => request.destroy(error));
        body.pipe(request);
      }
    });
  }
}
