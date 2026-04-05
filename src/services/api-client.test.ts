import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { FreeAgentApiClient, formatErrorForLLM } from "./api-client.js";

interface MockAxiosInstance {
  get: Mock;
  post: Mock;
  put: Mock;
  delete: Mock;
}

// Mock axios at the module level
vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
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

describe("formatErrorForLLM", () => {
  it("prefixes error message with 'Error:'", () => {
    const error = new Error("Something went wrong");
    expect(formatErrorForLLM(error)).toBe("Error: Something went wrong");
  });
});
