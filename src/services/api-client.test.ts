import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  FreeAgentApiClient,
  extractFreeAgentBodyDetail,
  formatErrorForLLM,
} from "./api-client.js";

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

  describe("error handling", () => {
    async function rejectGet(status: number, data: unknown = {}, headers: Record<string, string> = {}) {
      const mockAxios = await getMockAxios();
      mockAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status, data, headers },
      });
      return client.get("/contacts");
    }

    it("surfaces HTTP 429 with Retry-After guidance", async () => {
      await expect(rejectGet(429, {}, { "retry-after": "42" })).rejects.toThrow(
        /Rate limit exceeded\. Please retry after 42 seconds\.[\s\S]*120 requests per minute/
      );
    });

    it("defaults Retry-After to 60 seconds when the header is missing", async () => {
      await expect(rejectGet(429)).rejects.toThrow(
        /Rate limit exceeded\. Please retry after 60 seconds/
      );
    });

    it("maps HTTP 401 to an authentication message", async () => {
      await expect(rejectGet(401)).rejects.toThrow(/Authentication failed/);
    });

    it("maps HTTP 403 to a permissions message", async () => {
      await expect(rejectGet(403)).rejects.toThrow(/Access forbidden/);
    });

    it("prefers FreeAgent's plain-text 403 body when present", async () => {
      await expect(
        rejectGet(403, "You are not allowed to access this action.")
      ).rejects.toThrow(
        /Access forbidden: You are not allowed to access this action\./
      );
    });

    it("maps HTTP 404 to a not-found message", async () => {
      await expect(rejectGet(404)).rejects.toThrow(/Resource not found/);
    });

    it("formats FreeAgent 422 validation errors from an errors array", async () => {
      await expect(
        rejectGet(422, { errors: [{ message: "category can't be blank" }] })
      ).rejects.toThrow(/Validation error: category can't be blank/);
    });

    it("maps HTTP 400 with FreeAgent's message", async () => {
      await expect(rejectGet(400, { message: "Invalid nominal code" })).rejects.toThrow(
        /Bad request \(400\): Invalid nominal code/
      );
    });

    it("maps HTTP 5xx without a body to an explicit server-error message", async () => {
      await expect(rejectGet(503)).rejects.toThrow(
        /FreeAgent server error \(503\)\. Please try again shortly\./
      );
    });

    it("includes FreeAgent body detail on 5xx when present", async () => {
      await expect(rejectGet(500, { message: "Something went wrong" })).rejects.toThrow(
        /FreeAgent server error \(500\): Something went wrong/
      );
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

describe("extractFreeAgentBodyDetail", () => {
  it("returns plain text bodies", () => {
    expect(extractFreeAgentBodyDetail("You are not allowed to access this action.")).toBe(
      "You are not allowed to access this action."
    );
  });

  it("strips light HTML wrappers", () => {
    expect(extractFreeAgentBodyDetail("<p>Access denied</p>")).toBe("Access denied");
  });

  it("ignores full HTML documents", () => {
    expect(
      extractFreeAgentBodyDetail("<!DOCTYPE html><html><body>nope</body></html>")
    ).toBeUndefined();
  });

  it("reads nested errors.error.message", () => {
    expect(
      extractFreeAgentBodyDetail({
        errors: { error: { message: "category can't be blank" } },
      })
    ).toBe("category can't be blank");
  });
});

describe("formatErrorForLLM", () => {
  it("prefixes error message with 'Error:'", () => {
    const error = new Error("Something went wrong");
    expect(formatErrorForLLM(error)).toBe("Error: Something went wrong");
  });
});
