import { describe, it, expect, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import type { ToolContext } from "./register.js";
import { createInvoice } from "./invoices.js";

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
  } as unknown as FreeAgentApiClient;
  return { client, calls };
}

const baseInvoiceResponse = {
  invoice: {
    url: "https://api.freeagent.com/v2/invoices/100",
    contact: "https://api.freeagent.com/v2/contacts/1",
    dated_on: "2026-04-23",
    currency: "GBP",
    net_value: "500.00",
    sales_tax_value: "0.00",
    total_value: "500.00",
    status: "Draft",
  },
};

const baseParams = {
  dated_on: "2026-04-23",
  currency: "GBP",
  invoice_items: [
    { item_type: "Hours", description: "Consulting", price: "100.00", quantity: "5.0" },
  ],
};

describe("createInvoice elicitation", () => {
  it("passes a provided contact straight through without eliciting", async () => {
    const elicit = vi.fn();
    const ctx: ToolContext = { clientSupportsElicitation: true, elicit };
    const { client, calls } = makeClient({
      post: () => baseInvoiceResponse,
    });

    await createInvoice(
      client,
      { ...baseParams, contact: "1" },
      ctx
    );

    expect(elicit).not.toHaveBeenCalled();
    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      invoice: { contact: "https://api.freeagent.com/v2/contacts/1" },
    });
  });

  it("elicits a contact when the field is missing and the client supports it", async () => {
    const elicit = vi.fn(async () => ({
      action: "accept" as const,
      content: { contact_url: "https://api.freeagent.com/v2/contacts/7" },
    }));
    const ctx: ToolContext = { clientSupportsElicitation: true, elicit };
    const { client, calls } = makeClient({
      get: (path) => {
        if (path === "/contacts") {
          return {
            contacts: [
              { url: "https://api.freeagent.com/v2/contacts/7", organisation_name: "Acme Ltd" },
              { url: "https://api.freeagent.com/v2/contacts/8", first_name: "Dave", last_name: "Grohl" },
            ],
          };
        }
      },
      post: () => baseInvoiceResponse,
    });

    const result = await createInvoice(
      client,
      { ...baseParams },
      ctx
    );

    expect(elicit).toHaveBeenCalledOnce();
    const elicitArgs = (elicit.mock.calls as unknown as Array<[{
      message: string;
      requestedSchema: { properties: { contact_url: { oneOf: Array<{ const: string; title: string }> } } };
    }]>)[0][0];
    expect(elicitArgs.message).toMatch(/contact/i);
    const oneOf = elicitArgs.requestedSchema.properties.contact_url.oneOf;
    expect(oneOf).toEqual(
      expect.arrayContaining([
        { const: "https://api.freeagent.com/v2/contacts/7", title: "Acme Ltd" },
        { const: "https://api.freeagent.com/v2/contacts/8", title: "Dave Grohl" },
        { const: "__other__", title: expect.stringContaining("paste a URL") },
      ])
    );

    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      invoice: { contact: "https://api.freeagent.com/v2/contacts/7" },
    });
    expect(result).toContain("Invoice created successfully");
  });

  it("errors clearly when elicitation is unsupported and contact is missing", async () => {
    const ctx: ToolContext = {
      clientSupportsElicitation: false,
      elicit: vi.fn(),
    };
    const { client } = makeClient({});

    await expect(
      createInvoice(client, { ...baseParams }, ctx)
    ).rejects.toThrow(/does not support MCP elicitation/);
  });

  it("errors when the user cancels the elicitation", async () => {
    const elicit = vi.fn(async () => ({ action: "cancel" as const, content: undefined }));
    const ctx: ToolContext = { clientSupportsElicitation: true, elicit };
    const { client } = makeClient({
      get: () => ({
        contacts: [
          { url: "https://api.freeagent.com/v2/contacts/7", organisation_name: "Acme Ltd" },
        ],
      }),
    });

    await expect(
      createInvoice(client, { ...baseParams }, ctx)
    ).rejects.toThrow(/cancelled/);
  });

  it("passes discount_percent through to the invoice payload", async () => {
    const elicit = vi.fn();
    const ctx: ToolContext = { clientSupportsElicitation: true, elicit };
    const { client, calls } = makeClient({
      post: () => baseInvoiceResponse,
    });

    await createInvoice(
      client,
      { ...baseParams, contact: "1", discount_percent: "20" },
      ctx
    );

    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      invoice: { discount_percent: "20" },
    });
  });

  it("accepts the 'Other' choice and uses the pasted URL", async () => {
    const elicit = vi.fn(async () => ({
      action: "accept" as const,
      content: {
        contact_url: "__other__",
        other_url: "https://api.freeagent.com/v2/contacts/42",
      },
    }));
    const ctx: ToolContext = { clientSupportsElicitation: true, elicit };
    const { client, calls } = makeClient({
      get: () => ({
        contacts: [
          { url: "https://api.freeagent.com/v2/contacts/7", organisation_name: "Acme Ltd" },
        ],
      }),
      post: () => baseInvoiceResponse,
    });

    await createInvoice(client, { ...baseParams }, ctx);

    const post = calls.find((c) => c.method === "post");
    expect(post?.body).toMatchObject({
      invoice: { contact: "https://api.freeagent.com/v2/contacts/42" },
    });
  });
});
