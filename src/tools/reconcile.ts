/**
 * Intent-bundle tool: reconcile a bank transaction in a single call.
 *
 * Collapses the multi-step pattern of
 *   get_bank_transaction → list_categories (or list_invoices) → create_bank_transaction_explanation
 * into one tool that accepts human-friendly hints (category name / nominal code,
 * invoice reference) and resolves them server-side.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type {
  FreeAgentBankTransaction,
  FreeAgentBankTransactionExplanation,
  FreeAgentInvoice,
} from "../types.js";
import type { ReconcileBankTransactionInput } from "../schemas/index.js";
import { extractIdFromUrl } from "../services/formatter.js";
import { resolveCategory } from "../services/resolvers.js";

async function resolveInvoice(
  client: FreeAgentApiClient,
  hint: string
): Promise<string> {
  if (hint.startsWith("http")) return hint;

  if (/^\d+$/.test(hint)) {
    const response = await client.get<{ invoice: FreeAgentInvoice }>(
      `/invoices/${hint}`
    );
    return response.data.invoice.url;
  }

  // Treat as invoice reference. FreeAgent's list endpoint does not filter by
  // reference, so we page through at most 100 invoices and match client-side.
  const response = await client.get<{ invoices: FreeAgentInvoice[] }>(
    "/invoices",
    { per_page: 100, view: "recent_open_or_overdue" }
  );
  const matches = (response.data.invoices ?? []).filter(
    (inv) => inv.reference === hint
  );

  if (matches.length === 1) return matches[0].url;
  if (matches.length > 1) {
    throw new Error(
      `Invoice reference "${hint}" matches ${matches.length} invoices. Pass the invoice ID or URL instead.`
    );
  }

  throw new Error(
    `No open invoice has reference "${hint}". Check the reference, or pass the invoice ID/URL directly.`
  );
}

export async function reconcileBankTransaction(
  client: FreeAgentApiClient,
  params: ReconcileBankTransactionInput
): Promise<string> {
  const {
    bank_transaction_id,
    category,
    paid_invoice,
    description,
    marked_for_review,
    receipt_reference,
  } = params;

  if (!category && !paid_invoice) {
    throw new Error(
      "Provide either `category` (name, nominal code, or URL) or `paid_invoice` (reference, ID, or URL)."
    );
  }
  if (category && paid_invoice) {
    throw new Error(
      "Provide only one of `category` or `paid_invoice`, not both."
    );
  }

  const txUrl = bank_transaction_id.startsWith("http")
    ? bank_transaction_id
    : `/bank_transactions/${bank_transaction_id}`;

  const txResponse = await client.get<{ bank_transaction: FreeAgentBankTransaction }>(
    txUrl
  );
  const tx = txResponse.data.bank_transaction;

  const payload: Record<string, unknown> = {
    bank_transaction: tx.url,
    dated_on: tx.dated_on,
    gross_value: tx.gross_value,
  };
  if (description) payload.description = description;
  if (marked_for_review !== undefined) payload.marked_for_review = marked_for_review;
  if (receipt_reference) payload.receipt_reference = receipt_reference;

  let resolvedKind: "category" | "invoice";
  if (category) {
    payload.category = await resolveCategory(client, category);
    resolvedKind = "category";
  } else {
    payload.paid_invoice = await resolveInvoice(client, paid_invoice!);
    resolvedKind = "invoice";
  }

  const createResponse = await client.post<{
    bank_transaction_explanation: FreeAgentBankTransactionExplanation;
  }>("/bank_transaction_explanations", {
    bank_transaction_explanation: payload,
  });

  const exp = createResponse.data.bank_transaction_explanation;
  const explanationId = extractIdFromUrl(exp.url);
  const linkedTo =
    resolvedKind === "category"
      ? `Category: ${exp.category}`
      : `Paid invoice: ${exp.paid_invoice}`;

  return (
    `✅ Reconciled bank transaction ${extractIdFromUrl(tx.url)}\n\n` +
    `**Explanation ID**: ${explanationId}\n` +
    `**Date**: ${exp.dated_on}\n` +
    `**Amount**: ${exp.gross_value}\n` +
    `${linkedTo}\n` +
    (exp.description ? `**Description**: ${exp.description}\n` : "") +
    `**URL**: ${exp.url}`
  );
}
