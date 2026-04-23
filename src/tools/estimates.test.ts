import { describe, it, expect, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import {
  createEstimate,
  listEstimates,
  transitionEstimate,
} from "./estimates.js";
import { ResponseFormat } from "../constants.js";

interface Call {
  method: "get" | "post" | "put";
  path: string;
  body?: unknown;
  params?: unknown;
}

function makeClient(handlers: {
  get?: (path: string) => unknown;
  post?: (path: string, body?: unknown) => unknown;
  put?: (path: string) => unknown;
}): { client: FreeAgentApiClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    get: vi.fn(async (path: string, params?: unknown) => {
      calls.push({ method: "get", path, params });
      return { data: handlers.get?.(path), headers: {} };
    }),
    post: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: "post", path, body });
      return { data: handlers.post?.(path, body), headers: {} };
    }),
    put: vi.fn(async (path: string) => {
      calls.push({ method: "put", path });
      return { data: handlers.put?.(path), headers: {} };
    }),
    parsePaginationHeaders: () => ({ hasMore: false }),
  } as unknown as FreeAgentApiClient;
  return { client, calls };
}

describe("estimates tools", () => {
  it("createEstimate POSTs a normalized contact URL and the line items", async () => {
    const { client, calls } = makeClient({
      post: () => ({
        estimate: {
          url: "https://api.freeagent.com/v2/estimates/5",
          contact: "https://api.freeagent.com/v2/contacts/1",
          dated_on: "2026-04-23",
          currency: "GBP",
          total_value: "500.00",
          reference: "EST-001",
          status: "Draft",
        },
      }),
    });

    const result = await createEstimate(client, {
      contact: "1",
      dated_on: "2026-04-23",
      currency: "GBP",
      estimate_items: [
        { item_type: "Hours", description: "Consulting", price: "100.00", quantity: "5.0" },
      ],
    });

    expect(result).toContain("Drafted estimate 5");
    const post = calls.find((c) => c.method === "post");
    expect(post?.path).toBe("/estimates");
    expect(post?.body).toMatchObject({
      estimate: {
        contact: "https://api.freeagent.com/v2/contacts/1",
        ec_status: "UK/Non-EC",
      },
    });
  });

  it("listEstimates passes through filters and sort", async () => {
    const { client, calls } = makeClient({
      get: () => ({ estimates: [] }),
    });

    await listEstimates(client, {
      page: 1,
      per_page: 25,
      view: "sent",
      contact: "contact/7",
      project: "project/11",
      sort: "dated_on",
      response_format: ResponseFormat.MARKDOWN,
    });

    const get = calls.find((c) => c.method === "get");
    expect(get?.path).toBe("/estimates");
    expect(get?.params).toMatchObject({
      view: "sent",
      contact: "contact/7",
      project: "project/11",
      sort: "dated_on",
    });
  });

  it("transitionEstimate PUTs to the right transition path", async () => {
    const { client, calls } = makeClient({
      put: () => ({
        estimate: {
          url: "https://api.freeagent.com/v2/estimates/5",
          dated_on: "2026-04-23",
          status: "Approved",
        },
      }),
    });

    await transitionEstimate(client, {
      estimate_id: "https://api.freeagent.com/v2/estimates/5",
      action: "mark_as_approved",
    });

    expect(calls[0].path).toBe("/estimates/5/transitions/mark_as_approved");
  });
});
