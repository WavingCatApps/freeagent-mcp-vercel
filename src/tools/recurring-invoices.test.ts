import { describe, it, expect, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import {
  listRecurringInvoices,
  getRecurringInvoice,
} from "./recurring-invoices.js";
import { ResponseFormat } from "../constants.js";

function makeClient(data: Record<string, unknown>): FreeAgentApiClient {
  return {
    get: vi.fn(async (path: string) => ({ data: data[path], headers: {} })),
    parsePaginationHeaders: () => ({ hasMore: false }),
  } as unknown as FreeAgentApiClient;
}

describe("recurring invoice tools", () => {
  it("listRecurringInvoices renders a reference and next run date", async () => {
    const client = makeClient({
      "/recurring_invoices": {
        recurring_invoices: [
          {
            url: "https://api.freeagent.com/v2/recurring_invoices/1",
            contact: "c/1",
            reference: "RI-001",
            frequency: "Monthly",
            next_recurs_on: "2026-05-01",
            status: "Active",
            currency: "GBP",
            total_value: "120.00",
          },
        ],
      },
    });

    const result = await listRecurringInvoices(client, {
      page: 1,
      per_page: 25,
      response_format: ResponseFormat.MARKDOWN,
    });
    expect(result).toContain("RI-001");
    expect(result).toContain("2026-05-01");
    expect(result).toContain("Monthly");
  });

  it("getRecurringInvoice uses the recurring_invoice_items key when present", async () => {
    const client = makeClient({
      "/recurring_invoices/5": {
        recurring_invoice: {
          url: "https://api.freeagent.com/v2/recurring_invoices/5",
          contact: "c/1",
          frequency: "Monthly",
          recurring_invoice_items: [
            { item_type: "Hours", description: "Retainer", price: "120", quantity: "1" },
          ],
        },
      },
    });

    const result = await getRecurringInvoice(client, {
      recurring_invoice_id: "5",
      response_format: ResponseFormat.MARKDOWN,
    });
    expect(result).toContain("Retainer");
  });
});
