import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { FreeAgentApiClient } from "./api-client.js";
import type { TokenRefresher } from "./token-refresher.js";

interface MockAxiosInstance {
  get: Mock;
  request: Mock;
  defaults: { headers: Record<string, string> };
  interceptors: { response: { use: Mock } };
}

vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    request: vi.fn(),
    defaults: { headers: {} },
    interceptors: { response: { use: vi.fn() } },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      isAxiosError: vi.fn((error: unknown) => (error as Record<string, unknown>).isAxiosError === true),
    },
    __mockInstance: mockAxiosInstance,
  };
});

async function getMockAxios(): Promise<MockAxiosInstance> {
  const mod = await import("axios");
  return (mod as unknown as { __mockInstance: MockAxiosInstance }).__mockInstance;
}

function authError(config: Record<string, unknown>, status = 401) {
  return { isAxiosError: true, response: { status, data: {} }, config };
}

describe("FreeAgentApiClient token refresh", () => {
  let mockAxios: MockAxiosInstance;
  let refresh: Mock;

  beforeEach(async () => {
    mockAxios = await getMockAxios();
    mockAxios.interceptors.response.use.mockClear();
    mockAxios.request.mockReset();
    mockAxios.defaults.headers = {};
    refresh = vi.fn().mockResolvedValue("new-access");
  });

  function onRejected() {
    new FreeAgentApiClient("old-access", true, { refresh } as unknown as TokenRefresher);
    return mockAxios.interceptors.response.use.mock.calls[0][1] as (error: unknown) => Promise<unknown>;
  }

  it("does not install an interceptor without a refresher", async () => {
    new FreeAgentApiClient("old-access", true);
    expect(mockAxios.interceptors.response.use).not.toHaveBeenCalled();
  });

  it("refreshes the token and retries once on a 401", async () => {
    mockAxios.request.mockResolvedValueOnce({ data: "ok" });
    const config = { url: "/company", headers: {} as Record<string, string> };

    await expect(onRejected()(authError(config))).resolves.toEqual({ data: "ok" });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(config.headers.Authorization).toBe("Bearer new-access");
    expect(mockAxios.defaults.headers.Authorization).toBe("Bearer new-access");
    expect(mockAxios.request).toHaveBeenCalledWith(expect.objectContaining({ url: "/company", _retried: true }));
  });

  it("does not retry a request that was already retried", async () => {
    const error = authError({ url: "/company", headers: {}, _retried: true });

    await expect(onRejected()(error)).rejects.toBe(error);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("passes other errors through", async () => {
    const error = authError({ url: "/company", headers: {} }, 403);

    await expect(onRejected()(error)).rejects.toBe(error);
    expect(refresh).not.toHaveBeenCalled();
  });
});
