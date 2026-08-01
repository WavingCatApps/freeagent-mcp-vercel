import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { Response as ExpressResponse } from "express";
import jwt from "jsonwebtoken";
import {
  createFreeAgentJWTOAuthProvider,
  resolveJwtSecret,
  type AuthCodePayload,
  type AuthRequestPayload,
} from "./oauth-jwt.js";

const TEST_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-vitest";

function mockClient(id = "cursor-client"): OAuthClientInformationFull {
  return {
    client_id: id,
    client_name: "Cursor",
    redirect_uris: ["cursor://oauth/callback"],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

describe("resolveJwtSecret", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalVercel = process.env.VERCEL;
  const originalVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("returns JWT_SECRET when set", () => {
    process.env.JWT_SECRET = "explicit-secret";
    expect(resolveJwtSecret()).toBe("explicit-secret");
  });

  it("throws on Vercel when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    process.env.VERCEL = "1";
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET environment variable is required on Vercel/);
  });
});

describe("stateless OAuth auth codes", () => {
  const provider = createFreeAgentJWTOAuthProvider();
  const client = mockClient();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("survives authorize → callback → challenge without shared memory", async () => {
    let redirectLocation = "";
    const deployHost = "freeagent-mcp-vercel-a3vcrtaem-simonrices-projects.vercel.app";
    const res = {
      req: {
        headers: {
          "x-forwarded-host": deployHost,
          "x-forwarded-proto": "https",
        },
        protocol: "https",
      },
      redirect: (url: string) => {
        redirectLocation = url;
      },
    };

    const params: AuthorizationParams = {
      codeChallenge: "pkce-challenge-abc",
      redirectUri: "cursor://oauth/callback",
      state: "client-state-xyz",
    };
    await provider.authorize(client, params, res as unknown as ExpressResponse);

    const freeagentUrl = new URL(redirectLocation);
    expect(freeagentUrl.searchParams.get("redirect_uri")).toBe(
      `https://${deployHost}/oauth/callback`
    );
    const authRequestJwt = freeagentUrl.searchParams.get("state");
    expect(authRequestJwt).toBeTruthy();

    const authRequest = jwt.verify(authRequestJwt!, TEST_SECRET) as AuthRequestPayload;
    expect(authRequest.typ).toBe("auth_req");
    expect(authRequest.codeChallenge).toBe("pkce-challenge-abc");
    expect(authRequest.clientId).toBe("cursor-client");
    expect(authRequest.serverBaseUrl).toBe(`https://${deployHost}`);

    // Simulate a different serverless instance: only the JWT is available
    const callback = await provider.handleFreeAgentCallback(
      authRequestJwt!,
      "freeagent-auth-code-123"
    );

    expect(callback.redirectUri).toBe("cursor://oauth/callback");
    expect(callback.state).toBe("client-state-xyz");

    const authCode = jwt.verify(callback.code, TEST_SECRET) as AuthCodePayload;
    expect(authCode.typ).toBe("auth_code");
    expect(authCode.freeagentCode).toBe("freeagent-auth-code-123");
    expect(authCode.codeChallenge).toBe("pkce-challenge-abc");
    expect(authCode.serverBaseUrl).toBe(`https://${deployHost}`);

    await expect(
      provider.challengeForAuthorizationCode(client, callback.code)
    ).resolves.toBe("pkce-challenge-abc");
  });

  it("rejects garbage callback state with Invalid authorization code", async () => {
    await expect(
      provider.handleFreeAgentCallback("not-a-jwt", "freeagent-code")
    ).rejects.toThrow("Invalid authorization code");
  });

  it("exchanges a signed auth_code JWT for MCP tokens", async () => {
    const serverBaseUrl = "https://freeagent-mcp-vercel-a3vcrtaem-simonrices-projects.vercel.app";
    const authCodeJwt = jwt.sign(
      {
        typ: "auth_code",
        codeChallenge: "challenge",
        clientId: client.client_id,
        redirectUri: client.redirect_uris[0],
        serverBaseUrl,
        freeagentCode: "fa-code",
      } satisfies AuthCodePayload,
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: "10m" }
    );

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "fa-access",
        refresh_token: "fa-refresh",
        expires_in: 3600,
        refresh_token_expires_in: 7200,
      }),
    } as globalThis.Response);

    const tokens = await provider.exchangeAuthorizationCode(client, authCodeJwt);

    expect(fetchMock).toHaveBeenCalledOnce();
    const tokenBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(String(tokenBody)).toContain(
      encodeURIComponent(`${serverBaseUrl}/oauth/callback`)
    );
    expect(tokens.token_type).toBe("bearer");
    expect(tokens.expires_in).toBe(3600);
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();

    const access = jwt.verify(tokens.access_token, TEST_SECRET) as {
      freeagentAccessToken: string;
      clientId: string;
    };
    expect(access.freeagentAccessToken).toBe("fa-access");
    expect(access.clientId).toBe(client.client_id);
  });

  it("rejects auth codes issued for a different client", async () => {
    const authCodeJwt = jwt.sign(
      {
        typ: "auth_code",
        codeChallenge: "challenge",
        clientId: "other-client",
        redirectUri: "https://example.com/cb",
        serverBaseUrl: "https://example.vercel.app",
        freeagentCode: "fa-code",
      } satisfies AuthCodePayload,
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: "10m" }
    );

    await expect(
      provider.exchangeAuthorizationCode(client, authCodeJwt)
    ).rejects.toThrow("Invalid or expired authorization code");
  });
});
