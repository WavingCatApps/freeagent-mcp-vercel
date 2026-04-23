/**
 * Bill Management Tools
 *
 * Supplier bills — list, get, create. Pairs with bank_transaction_explanations
 * for the AP side of reconciliation.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentBill } from "../types.js";
import type {
  ListBillsInput,
  GetBillInput,
  CreateBillInput,
} from "../schemas/index.js";
import {
  formatResponse,
  createPaginationMetadata,
  extractIdFromUrl,
} from "../services/formatter.js";

export async function listBills(
  client: FreeAgentApiClient,
  params: ListBillsInput
): Promise<string> {
  const { page, per_page, view, contact, from_date, to_date, sort, response_format } = params;

  const queryParams: Record<string, string> = {
    page: page.toString(),
    per_page: per_page.toString(),
  };
  if (view) queryParams.view = view;
  if (contact) queryParams.contact = contact;
  if (from_date) queryParams.from_date = from_date;
  if (to_date) queryParams.to_date = to_date;
  if (sort) queryParams.sort = sort;

  const response = await client.get<{ bills: FreeAgentBill[] }>("/bills", queryParams);
  const bills = response.data.bills ?? [];
  const pagination = client.parsePaginationHeaders(response.headers);

  return formatResponse(
    {
      bills,
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
      const lines: string[] = ["# FreeAgent Bills", ""];

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

      if (bills.length === 0) {
        lines.push("No bills found matching the criteria.");
        return lines.join("\n");
      }

      for (const bill of bills) {
        const id = extractIdFromUrl(bill.url);
        lines.push(`## ${bill.dated_on} — ${bill.currency ?? "GBP"} ${bill.total_value} (ID: ${id})`);
        if (bill.reference) lines.push(`Reference: ${bill.reference}`);
        lines.push(`Contact: ${bill.contact}`);
        if (bill.status) lines.push(`Status: ${bill.status}`);
        if (bill.due_on) lines.push(`Due: ${bill.due_on}`);
        lines.push("");
      }

      return lines.join("\n");
    }
  );
}

export async function getBill(
  client: FreeAgentApiClient,
  params: GetBillInput
): Promise<string> {
  const { bill_id, response_format } = params;
  const url = bill_id.startsWith("http") ? bill_id : `/bills/${bill_id}`;

  const response = await client.get<{ bill: FreeAgentBill }>(url);
  const bill = response.data.bill;

  return formatResponse(
    bill,
    response_format,
    () => {
      const lines = [`# Bill Details`, ""];
      lines.push(`- **Date**: ${bill.dated_on}`);
      lines.push(`- **Total**: ${bill.currency ?? "GBP"} ${bill.total_value}`);
      if (bill.reference) lines.push(`- **Reference**: ${bill.reference}`);
      lines.push(`- **Contact**: ${bill.contact}`);
      if (bill.status) lines.push(`- **Status**: ${bill.status}`);
      if (bill.due_on) lines.push(`- **Due**: ${bill.due_on}`);
      if (bill.paid_value) lines.push(`- **Paid**: ${bill.paid_value}`);
      if (bill.due_value) lines.push(`- **Outstanding**: ${bill.due_value}`);
      if (bill.bill_items && bill.bill_items.length > 0) {
        lines.push("", "## Line items");
        for (const item of bill.bill_items) {
          lines.push(`- ${item.description ?? ""} (${item.category ?? ""}): ${item.quantity ?? ""} × ${item.price ?? ""}`);
        }
      }
      return lines.join("\n");
    }
  );
}

export async function createBill(
  client: FreeAgentApiClient,
  params: CreateBillInput
): Promise<string> {
  const payload: Record<string, unknown> = {
    contact: params.contact,
    dated_on: params.dated_on,
    ec_status: params.ec_status ?? "UK/Non-EC",
    bill_items: params.bill_items,
  };
  if (params.due_on) payload.due_on = params.due_on;
  if (params.reference) payload.reference = params.reference;
  if (params.currency) payload.currency = params.currency;
  if (params.comments) payload.comments = params.comments;
  if (params.payment_terms_in_days !== undefined) {
    payload.payment_terms_in_days = params.payment_terms_in_days;
  }

  const response = await client.post<{ bill: FreeAgentBill }>("/bills", { bill: payload });
  const bill = response.data.bill;
  const billId = extractIdFromUrl(bill.url);

  return (
    `✅ Created bill ${billId}\n\n` +
    `**Date**: ${bill.dated_on}\n` +
    `**Total**: ${bill.currency ?? "GBP"} ${bill.total_value}\n` +
    (bill.reference ? `**Reference**: ${bill.reference}\n` : "") +
    `**Contact**: ${bill.contact}\n` +
    `**URL**: ${bill.url}`
  );
}
