import { describe, it, expect, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { transitionInvoice } from "./transition-invoice.js";

interface Call {
  method: "put";
  path: string;
  body?: unknown;
}

function makeClient(
  response: unknown
): { client: FreeAgentApiClient; calls: Call[] } {
  const calls: Call[] = [];
  const client = {
    put: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ method: "put", path, body });
      return { data: response, headers: {} };
    }),
  } as unknown as FreeAgentApiClient;
  return { client, calls };
}

describe("transitionInvoice", () => {
  it("PUTs to /invoices/:id/transitions/:action with numeric ID", async () => {
    const { client, calls } = makeClient({
      invoice: {
        url: "https://api.freeagent.com/v2/invoices/42",
        status: "Sent",
        dated_on: "2026-04-23",
        currency: "GBP",
        total_value: "500.00",
        net_value: "500.00",
        sales_tax_value: "0.00",
        contact: "c/1",
      },
    });

    const result = await transitionInvoice(client, {
      invoice_id: "42",
      action: "mark_as_sent",
    });

    expect(calls[0].path).toBe("/invoices/42/transitions/mark_as_sent");
    expect(calls[0].body).toBeUndefined();
    expect(result).toContain("mark_as_sent applied to invoice 42");
    expect(result).toContain("Sent");
  });

  it("extracts the ID from a full URL before building the transition path", async () => {
    const { client, calls } = makeClient({
      invoice: {
        url: "https://api.freeagent.com/v2/invoices/999",
        status: "Cancelled",
        dated_on: "2026-04-23",
        currency: "GBP",
        total_value: "0.00",
        net_value: "0.00",
        sales_tax_value: "0.00",
        contact: "c/1",
      },
    });

    await transitionInvoice(client, {
      invoice_id: "https://api.freeagent.com/v2/invoices/999",
      action: "mark_as_cancelled",
    });

    expect(calls[0].path).toBe("/invoices/999/transitions/mark_as_cancelled");
  });
});
