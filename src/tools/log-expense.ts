/**
 * Intent-bundle tool: log an expense in a single call.
 *
 * Wraps the raw /expenses POST with three agent-friendly tweaks:
 *   - `amount` is a positive decimal; the tool applies the FreeAgent sign
 *     convention (negative = money out). `kind` ("expense" | "refund") makes
 *     the intent explicit, eliminating the "negative value" footgun in
 *     freeagent_create_expense.
 *   - `category` accepts a name, nominal code, or URL (resolved server-side).
 *   - `user` accepts an email, numeric ID, or URL; defaults to the sole user
 *     on the account when there is exactly one.
 *
 * For mileage claims, recurring expenses, or receipt attachments, use
 * freeagent_create_expense.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentExpense } from "../types.js";
import type { LogExpenseInput } from "../schemas/index.js";
import { extractIdFromUrl } from "../services/formatter.js";
import { resolveCategory, resolveUser } from "../services/resolvers.js";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toGrossValue(amount: string, kind: "expense" | "refund"): string {
  const num = parseFloat(amount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(
      `\`amount\` must be a positive decimal (got "${amount}"). Use \`kind: "refund"\` for money coming back in.`
    );
  }
  return kind === "expense" ? `-${num.toFixed(2)}` : num.toFixed(2);
}

export async function logExpense(
  client: FreeAgentApiClient,
  params: LogExpenseInput
): Promise<string> {
  const kind = params.kind ?? "expense";
  const grossValue = toGrossValue(params.amount, kind);
  const datedOn = params.dated_on ?? todayIso();

  const [categoryUrl, userUrl] = await Promise.all([
    resolveCategory(client, params.category),
    resolveUser(client, params.user),
  ]);

  const payload: Record<string, unknown> = {
    user: userUrl,
    category: categoryUrl,
    dated_on: datedOn,
    gross_value: grossValue,
    ec_status: params.ec_status ?? "UK/Non-EC",
  };
  if (params.description) payload.description = params.description;
  if (params.currency) payload.currency = params.currency;
  if (params.sales_tax_rate) payload.sales_tax_rate = params.sales_tax_rate;
  if (params.receipt_reference) payload.receipt_reference = params.receipt_reference;
  if (params.project) payload.project = params.project;

  const response = await client.post<{ expense: FreeAgentExpense }>("/expenses", {
    expense: payload,
  });
  const expense = response.data.expense;
  const expenseId = extractIdFromUrl(expense.url);

  return (
    `✅ Logged ${kind} ${expenseId}\n\n` +
    `**Date**: ${expense.dated_on}\n` +
    `**Amount**: ${expense.currency ?? "GBP"} ${expense.gross_value}\n` +
    `**Category**: ${expense.category}\n` +
    (expense.description ? `**Description**: ${expense.description}\n` : "") +
    `**URL**: ${expense.url}`
  );
}
