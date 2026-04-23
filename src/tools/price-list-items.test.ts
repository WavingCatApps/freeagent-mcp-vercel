import { describe, it, expect, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import {
  createPriceListItem,
  listPriceListItems,
} from "./price-list-items.js";
import { ResponseFormat } from "../constants.js";

interface Call {
  method: "get" | "post";
  path: string;
  body?: unknown;
}

function makeClient(handlers: {
  get?: (path: string) => unknown;
  post?: (path: string, body?: unknown) => unknown;
}): { client: FreeAgentApiClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    get: vi.fn(async (path: string) => {
      calls.push({ method: "get", path });
      return { data: handlers.get?.(path), headers: {} };
    }),
    post: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: "post", path, body });
      return { data: handlers.post?.(path, body), headers: {} };
    }),
    parsePaginationHeaders: () => ({ hasMore: false }),
  } as unknown as FreeAgentApiClient;
  return { client, calls };
}

describe("price list item tools", () => {
  it("createPriceListItem POSTs the payload under the price_list_item key", async () => {
    const { client, calls } = makeClient({
      post: () => ({
        price_list_item: {
          url: "https://api.freeagent.com/v2/price_list_items/3",
          description: "Consulting hour",
          item_type: "Hours",
          price: "120.00",
        },
      }),
    });

    await createPriceListItem(client, {
      description: "Consulting hour",
      price: "120.00",
      item_type: "Hours",
    });

    const post = calls.find((c) => c.method === "post");
    expect(post?.path).toBe("/price_list_items");
    expect(post?.body).toMatchObject({
      price_list_item: {
        description: "Consulting hour",
        price: "120.00",
        item_type: "Hours",
      },
    });
  });

  it("listPriceListItems renders description, type, and price", async () => {
    const { client } = makeClient({
      get: () => ({
        price_list_items: [
          {
            url: "https://api.freeagent.com/v2/price_list_items/3",
            description: "Consulting hour",
            item_type: "Hours",
            price: "120.00",
          },
        ],
      }),
    });

    const result = await listPriceListItems(client, {
      page: 1,
      per_page: 25,
      response_format: ResponseFormat.MARKDOWN,
    });
    expect(result).toContain("Consulting hour");
    expect(result).toContain("Hours");
    expect(result).toContain("120.00");
  });
});
