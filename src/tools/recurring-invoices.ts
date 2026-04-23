/**
 * Recurring Invoice Tools (read-only).
 *
 * Lists and fetches the templates that FreeAgent uses to auto-generate
 * invoices on a schedule. Writes are intentionally omitted for now — the
 * create/update shape is more intricate and less commonly needed.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentRecurringInvoice } from "../types.js";
import type {
  ListRecurringInvoicesInput,
  GetRecurringInvoiceInput,
} from "../schemas/index.js";
import {
  formatResponse,
  createPaginationMetadata,
  extractIdFromUrl,
} from "../services/formatter.js";

export async function listRecurringInvoices(
  client: FreeAgentApiClient,
  params: ListRecurringInvoicesInput
): Promise<string> {
  const { page, per_page, view, contact, response_format } = params;

  const queryParams: Record<string, string> = {
    page: page.toString(),
    per_page: per_page.toString(),
  };
  if (view) queryParams.view = view;
  if (contact) queryParams.contact = contact;

  const response = await client.get<{ recurring_invoices: FreeAgentRecurringInvoice[] }>(
    "/recurring_invoices",
    queryParams
  );
  const items = response.data.recurring_invoices ?? [];
  const pagination = client.parsePaginationHeaders(response.headers);

  return formatResponse(
    {
      recurring_invoices: items,
      pagination: {
        page,
        per_page,
        total_count: pagination.totalCount,
        has_more: pagination.hasMore,
        next_page: pagination.nextPage,
      },
    },
    response_format,
    () => {
      const lines: string[] = ["# FreeAgent Recurring Invoices", ""];

      if (pagination.totalCount !== undefined) {
        lines.push(
          createPaginationMetadata({
            page,
            perPage: per_page,
            totalCount: pagination.totalCount,
            hasMore: pagination.hasMore,
            nextPage: pagination.nextPage,
          })
        );
        lines.push("");
      }

      if (items.length === 0) {
        lines.push("No recurring invoices found.");
        return lines.join("\n");
      }

      for (const item of items) {
        const id = extractIdFromUrl(item.url);
        lines.push(`## ${item.reference ?? id} (ID: ${id})`);
        lines.push(`Contact: ${item.contact}`);
        if (item.frequency) lines.push(`Frequency: ${item.frequency}`);
        if (item.next_recurs_on) lines.push(`Next run: ${item.next_recurs_on}`);
        if (item.ends_on) lines.push(`Ends: ${item.ends_on}`);
        if (item.status) lines.push(`Status: ${item.status}`);
        if (item.total_value) {
          lines.push(`Total: ${item.currency ?? "GBP"} ${item.total_value}`);
        }
        lines.push("");
      }

      return lines.join("\n");
    }
  );
}

export async function getRecurringInvoice(
  client: FreeAgentApiClient,
  params: GetRecurringInvoiceInput
): Promise<string> {
  const { recurring_invoice_id, response_format } = params;
  const url = recurring_invoice_id.startsWith("http")
    ? recurring_invoice_id
    : `/recurring_invoices/${recurring_invoice_id}`;

  const response = await client.get<{ recurring_invoice: FreeAgentRecurringInvoice }>(url);
  const item = response.data.recurring_invoice;

  return formatResponse(
    item,
    response_format,
    () => {
      const lines = [`# Recurring Invoice Details`, ""];
      lines.push(`- **Contact**: ${item.contact}`);
      if (item.reference) lines.push(`- **Reference**: ${item.reference}`);
      if (item.frequency) lines.push(`- **Frequency**: ${item.frequency}`);
      if (item.next_recurs_on) lines.push(`- **Next run**: ${item.next_recurs_on}`);
      if (item.ends_on) lines.push(`- **Ends**: ${item.ends_on}`);
      if (item.status) lines.push(`- **Status**: ${item.status}`);
      if (item.total_value) {
        lines.push(`- **Total**: ${item.currency ?? "GBP"} ${item.total_value}`);
      }
      const lineItems = item.recurring_invoice_items ?? item.invoice_items;
      if (lineItems && lineItems.length > 0) {
        lines.push("", "## Line items");
        for (const li of lineItems) {
          lines.push(`- ${li.description} (${li.item_type}): ${li.quantity} × ${li.price}`);
        }
      }
      return lines.join("\n");
    }
  );
}
