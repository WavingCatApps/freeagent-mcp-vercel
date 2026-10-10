import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { TokenRefresher, readTokenCache } from "./token-refresher.js";

function tokenResponse(body: Record<string, string>) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("TokenRefresher", () => {
  let dir: string;
  let cachePath: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "freeagent-mcp-test-"));
    cachePath = path.join(dir, "nested", "tokens.json");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(dir, { recursive: true, force: true });
  });

  function makeRefresher(cachedRefreshToken?: string) {
    return new TokenRefresher({
      baseURL: "https://api.sandbox.freeagent.com",
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "env-refresh",
      cachePath,
    }, cachedRefreshToken);
  }

  it("exchanges the refresh token and caches the new tokens", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse({ access_token: "new-access", refresh_token: "new-refresh" }));

    await expect(makeRefresher().refresh()).resolves.toBe("new-access");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sandbox.freeagent.com/v2/token_endpoint");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("id:secret").toString("base64")}`);
    expect(init.body.get("grant_type")).toBe("refresh_token");
    expect(init.body.get("refresh_token")).toBe("env-refresh");

    await expect(readTokenCache(cachePath)).resolves.toEqual({ access_token: "new-access", refresh_token: "new-refresh" });
    expect((await fs.stat(cachePath)).mode & 0o777).toBe(0o600);
  });

  it("keeps the old refresh token when none is returned", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse({ access_token: "new-access" }));

    await makeRefresher().refresh();

    await expect(readTokenCache(cachePath)).resolves.toEqual({ access_token: "new-access", refresh_token: "env-refresh" });
  });

  it("falls back to the environment refresh token when the cached one is rejected", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("invalid_grant", { status: 400 }))
      .mockResolvedValueOnce(tokenResponse({ access_token: "new-access" }));

    await expect(makeRefresher("cached-refresh").refresh()).resolves.toBe("new-access");

    expect(fetchMock.mock.calls[0][1].body.get("refresh_token")).toBe("cached-refresh");
    expect(fetchMock.mock.calls[1][1].body.get("refresh_token")).toBe("env-refresh");
  });

  it("throws when every refresh token is rejected", async () => {
    fetchMock.mockImplementation(async () => new Response("invalid_grant", { status: 400 }));

    await expect(makeRefresher("cached-refresh").refresh()).rejects.toThrow("FreeAgent token refresh failed: 400 invalid_grant; 400 invalid_grant");
  });

  it("shares one request between concurrent callers", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse({ access_token: "new-access" }));
    const refresher = makeRefresher();

    const results = await Promise.all([refresher.refresh(), refresher.refresh()]);

    expect(results).toEqual(["new-access", "new-access"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("readTokenCache", () => {
  it("returns undefined when the file is missing", async () => {
    await expect(readTokenCache(path.join(os.tmpdir(), "does-not-exist", "tokens.json"))).resolves.toBeUndefined();
  });
});
