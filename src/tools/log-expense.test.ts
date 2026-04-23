import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { logExpense } from "./log-expense.js";

interface Call {
  method: "get" | "post";
  path: string;
  params?: unknown;
  body?: unknown;
}

function makeClient(handlers: {
  get?: (path: string, params?: unknown) => unknown;
  post?: (path: string, body?: unknown) => unknown;
}): { client: FreeAgentApiClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    get: vi.fn(async (path: string, params?: unknown) => {
      calls.push({ method: "get", path, params });
      const data = handlers.get?.(path, params);
      return { data, headers: {} };
    }),
    post: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: "post", path, body });
      const data = handlers.post?.(path, body);
      return { data, headers: {} };
    }),
  } as unknown as FreeAgentApiClient;
  return { client, calls };
}

const soleUser = {
  url: "https://api.freeagent.com/v2/users/1",
  email: "owner@example.com",
  first_name: "Owner",
  last_name: "User",
  role: "Owner",
  permission_level: 8,
};

const travelCategory = {
  url: "https://api.freeagent.com/v2/categories/285",
  description: "Travel",
  nominal_code: "285",
};

describe("logExpense", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("negates a positive amount and defaults date to today", async () => {
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/categories/285") return { category: travelCategory };
        if (path === "/users") return { users: [soleUser] };
      },
      post: () => ({
        expense: {
          url: "https://api.freeagent.com/v2/expenses/500",
          user: soleUser.url,
          category: travelCategory.url,
          dated_on: "2026-04-23",
          gross_value: "-12.50",
        },
      }),
    });

    const result = await logExpense(client, {
      amount: "12.50",
      kind: "expense",
      category: "285",
    });

    expect(result).toContain("Logged expense 500");

    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      expense: {
        user: soleUser.url,
        category: travelCategory.url,
        dated_on: "2026-04-23",
        gross_value: "-12.50",
        ec_status: "UK/Non-EC",
      },
    });
  });

  it("keeps a positive gross_value when kind is 'refund'", async () => {
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/categories/285") return { category: travelCategory };
        if (path === "/users") return { users: [soleUser] };
      },
      post: () => ({
        expense: {
          url: "https://api.freeagent.com/v2/expenses/501",
          user: soleUser.url,
          category: travelCategory.url,
          dated_on: "2026-04-23",
          gross_value: "8.00",
        },
      }),
    });

    await logExpense(client, {
      amount: "8.00",
      kind: "refund",
      category: "285",
    });

    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      expense: { gross_value: "8.00" },
    });
  });

  it("resolves a user by email", async () => {
    const other = {
      url: "https://api.freeagent.com/v2/users/2",
      email: "bob@example.com",
      first_name: "Bob",
      last_name: "B",
      role: "Staff",
      permission_level: 4,
    };
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/categories/285") return { category: travelCategory };
        if (path === "/users") return { users: [soleUser, other] };
      },
      post: () => ({
        expense: {
          url: "https://api.freeagent.com/v2/expenses/502",
          user: other.url,
          category: travelCategory.url,
          dated_on: "2026-04-23",
          gross_value: "-5.00",
        },
      }),
    });

    await logExpense(client, {
      amount: "5.00",
      kind: "expense",
      category: "285",
      user: "bob@example.com",
    });

    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      expense: { user: other.url },
    });
  });

  it("errors when there are multiple users and none specified", async () => {
    const { client } = makeClient({
      get: (path) => {
        if (path === "/categories/285") return { category: travelCategory };
        if (path === "/users")
          return {
            users: [soleUser, { ...soleUser, url: "https://x/2", email: "b@example.com" }],
          };
      },
    });

    await expect(
      logExpense(client, { amount: "5.00", kind: "expense", category: "285" })
    ).rejects.toThrow(/pass the `user` parameter/);
  });

  it("rejects a negative or zero amount with actionable guidance", async () => {
    const { client } = makeClient({});
    await expect(
      logExpense(client, { amount: "-5.00", kind: "expense", category: "285" })
    ).rejects.toThrow(/positive decimal/);
    await expect(
      logExpense(client, { amount: "0", kind: "expense", category: "285" })
    ).rejects.toThrow(/positive decimal/);
  });

  it("honours an explicit dated_on over today", async () => {
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/categories/285") return { category: travelCategory };
        if (path === "/users") return { users: [soleUser] };
      },
      post: () => ({
        expense: {
          url: "https://api.freeagent.com/v2/expenses/503",
          user: soleUser.url,
          category: travelCategory.url,
          dated_on: "2026-01-15",
          gross_value: "-1.00",
        },
      }),
    });

    await logExpense(client, {
      amount: "1.00",
      kind: "expense",
      category: "285",
      dated_on: "2026-01-15",
    });

    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      expense: { dated_on: "2026-01-15" },
    });
  });
});
