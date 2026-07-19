import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import {
  FreeAgentApiClient,
  formatErrorForLLM,
  parseRetryAfterMs,
  RATE_LIMIT_MAX_RETRIES,
  RATE_LIMIT_MAX_WAIT_MS,
  RATE_LIMIT_DEFAULT_WAIT_MS,
} from "./api-client.js";

interface MockAxiosInstance {
  get: Mock;
  post: Mock;
  put: Mock;
  delete: Mock;
  request: Mock;
  interceptors: {
    request: { use: Mock };
    response: { use: Mock };
  };
}

// Mock axios at the module level
vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    // The client registers auth and refresh interceptors in its constructor.
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      post: vi.fn(),
      isAxiosError: vi.fn((error: unknown) => (error as Record<string, unknown>).isAxiosError === true),
    },
    __mockInstance: mockAxiosInstance,
  };
});

// Get the mock instance
async function getMockAxios(): Promise<MockAxiosInstance> {
  const mod = await import("axios");
  return (mod as unknown as { __mockInstance: MockAxiosInstance }).__mockInstance;
}

describe("FreeAgentApiClient", () => {
  let client: FreeAgentApiClient;

  beforeEach(() => {
    client = new FreeAgentApiClient("test-token", true);
  });

  describe("get", () => {
    it("returns data and headers from response", async () => {
      const mockAxios = await getMockAxios();
      mockAxios.get.mockResolvedValueOnce({
        data: { contacts: [{ url: "https://api.freeagent.com/v2/contacts/1" }] },
        headers: { "x-total-count": "42" },
      });

      const result = await client.get<{ contacts: Array<{ url: string }> }>("/contacts");
      expect(result.data.contacts).toHaveLength(1);
      expect(result.headers["x-total-count"]).toBe("42");
    });
  });

  describe("post", () => {
    it("returns data and headers from response", async () => {
      const mockAxios = await getMockAxios();
      mockAxios.post.mockResolvedValueOnce({
        data: { contact: { url: "https://api.freeagent.com/v2/contacts/2" } },
        headers: {},
      });

      const result = await client.post<{ contact: { url: string } }>("/contacts", { contact: {} });
      expect(result.data.contact.url).toContain("/contacts/2");
    });
  });

  describe("parsePaginationHeaders", () => {
    it("parses x-total-count header", () => {
      const result = client.parsePaginationHeaders({ "x-total-count": "42" });
      expect(result.totalCount).toBe(42);
    });

    it("parses Link header with next page", () => {
      const linkHeader = '<https://api.freeagent.com/v2/contacts?page=3>; rel="next", <https://api.freeagent.com/v2/contacts?page=10>; rel="last"';
      const result = client.parsePaginationHeaders({ link: linkHeader });
      expect(result.hasMore).toBe(true);
      expect(result.nextPage).toBe(3);
    });

    it("returns hasMore=false when no Link header", () => {
      const result = client.parsePaginationHeaders({});
      expect(result.hasMore).toBe(false);
      expect(result.nextPage).toBeUndefined();
    });

    it("handles empty headers gracefully", () => {
      const result = client.parsePaginationHeaders({});
      expect(result.totalCount).toBeUndefined();
      expect(result.hasMore).toBe(false);
    });
  });
});

describe("parseRetryAfterMs", () => {
  it("converts delta-seconds to milliseconds", () => {
    expect(parseRetryAfterMs("3")).toBe(3000);
    expect(parseRetryAfterMs(10)).toBe(10_000);
  });

  it("falls back to the default wait when the header is missing or garbage", () => {
    expect(parseRetryAfterMs(undefined)).toBe(RATE_LIMIT_DEFAULT_WAIT_MS);
    expect(parseRetryAfterMs("soon")).toBe(RATE_LIMIT_DEFAULT_WAIT_MS);
  });

  it("clamps to the maximum wait", () => {
    expect(parseRetryAfterMs("999")).toBe(RATE_LIMIT_MAX_WAIT_MS);
  });

  it("clamps tiny values up to one second", () => {
    expect(parseRetryAfterMs("0")).toBe(1000);
  });

  it("accepts an HTTP-date and converts it to a relative wait", () => {
    const inTen = new Date(Date.now() + 10_000).toUTCString();
    const ms = parseRetryAfterMs(inTen);
    expect(ms).toBeGreaterThan(7000);
    expect(ms).toBeLessThanOrEqual(11_000);
  });
});

describe("429 retry with backoff", () => {
  let client: FreeAgentApiClient;
  let mockAxios: MockAxiosInstance;
  let errorHandler: (error: unknown) => Promise<unknown>;
  let sleepSpy: Mock;

  function make429(config: Record<string, unknown>, retryAfter?: string) {
    return {
      isAxiosError: true,
      config,
      response: {
        status: 429,
        headers: retryAfter !== undefined ? { "retry-after": retryAfter } : {},
        data: {},
      },
    };
  }

  beforeEach(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockAxios = await getMockAxios();
    // The module-level axios mock is shared across the file; clear per-test
    // call history so assertions only see this test's traffic.
    mockAxios.request.mockReset();
    mockAxios.get.mockReset();
    client = new FreeAgentApiClient("test-token", true);
    // The client registers its interceptor pair in the constructor; take the
    // most recently registered error handler off the shared mock.
    const calls = mockAxios.interceptors.response.use.mock.calls;
    errorHandler = calls[calls.length - 1][1];
    sleepSpy = vi.fn().mockResolvedValue(undefined);
    (client as unknown as { sleep: Mock }).sleep = sleepSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for Retry-After then retries the original request", async () => {
    const config: Record<string, unknown> = { url: "/journal_sets/72270" };
    mockAxios.request.mockResolvedValueOnce({ data: { journal_set: {} }, headers: {} });

    const result = await errorHandler(make429(config, "2"));

    expect(sleepSpy).toHaveBeenCalledWith(2000);
    expect(mockAxios.request).toHaveBeenCalledWith(config);
    expect(config._rateLimitRetries).toBe(1);
    expect(result).toEqual({ data: { journal_set: {} }, headers: {} });
  });

  it("uses the default wait when Retry-After is absent", async () => {
    const config: Record<string, unknown> = { url: "/company" };
    mockAxios.request.mockResolvedValueOnce({ data: {}, headers: {} });

    await errorHandler(make429(config));

    expect(sleepSpy).toHaveBeenCalledWith(RATE_LIMIT_DEFAULT_WAIT_MS);
  });

  it("gives up after the retry cap and rejects with the original error", async () => {
    const config: Record<string, unknown> = {
      url: "/company",
      _rateLimitRetries: RATE_LIMIT_MAX_RETRIES,
    };
    const error = make429(config, "1");

    await expect(errorHandler(error)).rejects.toBe(error);
    expect(sleepSpy).not.toHaveBeenCalled();
    expect(mockAxios.request).not.toHaveBeenCalled();
  });

  it("retries up to the cap across successive 429s on the same request", async () => {
    const config: Record<string, unknown> = { url: "/company" };
    mockAxios.request.mockResolvedValue({ data: {}, headers: {} });

    for (let i = 0; i < RATE_LIMIT_MAX_RETRIES; i++) {
      await errorHandler(make429(config, "1"));
    }
    expect(config._rateLimitRetries).toBe(RATE_LIMIT_MAX_RETRIES);

    const exhausted = make429(config, "1");
    await expect(errorHandler(exhausted)).rejects.toBe(exhausted);
    expect(mockAxios.request).toHaveBeenCalledTimes(RATE_LIMIT_MAX_RETRIES);
  });

  it("does not retry non-429 errors", async () => {
    const error = {
      isAxiosError: true,
      config: { url: "/company" },
      response: { status: 500, headers: {}, data: {} },
    };

    await expect(errorHandler(error)).rejects.toBe(error);
    expect(sleepSpy).not.toHaveBeenCalled();
    expect(mockAxios.request).not.toHaveBeenCalled();
  });

  it("surfaces a sandbox-aware message once retries are exhausted", async () => {
    mockAxios.get.mockRejectedValueOnce({
      isAxiosError: true,
      config: { url: "/company" },
      response: { status: 429, headers: {}, data: {} },
    });

    await expect(client.get("/company")).rejects.toThrow(
      /retries \(2\) were exhausted.*5 requests per 60 seconds \(sandbox\)/
    );
  });
});

describe("formatErrorForLLM", () => {
  it("prefixes error message with 'Error:'", () => {
    const error = new Error("Something went wrong");
    expect(formatErrorForLLM(error)).toBe("Error: Something went wrong");
  });
});
