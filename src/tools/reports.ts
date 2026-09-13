import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse } from "../services/formatter.js";
import { resourcePath } from "../utils/resource-path.js";

import type {
  GetProfitAndLossInput, GetBalanceSheetInput, GetTrialBalanceInput, GetCashflowInput,
  ListAccountingTransactionsInput, GetAccountingTransactionInput,
} from "../schemas/index.js";

function jsonBlock(title: string, data: unknown): string {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

export async function getProfitAndLoss(client: FreeAgentApiClient, params: GetProfitAndLossInput): Promise<string> {
  const q: Record<string, string> = {};
  if (params.from_date) q.from_date = params.from_date;
  if (params.to_date) q.to_date = params.to_date;
  const response = await client.get<Record<string, unknown>>("/accounting/profit_and_loss/summary", q);
  return formatResponse(response.data, params.response_format, () => jsonBlock("Profit & Loss Summary", response.data));
}

export async function getBalanceSheet(client: FreeAgentApiClient, params: GetBalanceSheetInput): Promise<string> {
  const q: Record<string, string> = {};
  if (params.date) q.date = params.date;
  const response = await client.get<Record<string, unknown>>("/accounting/balance_sheet", q);
  return formatResponse(response.data, params.response_format, () => jsonBlock("Balance Sheet", response.data));
}

export async function getTrialBalance(client: FreeAgentApiClient, params: GetTrialBalanceInput): Promise<string> {
  const q: Record<string, string> = {};
  if (params.from_date) q.from_date = params.from_date;
  if (params.to_date) q.to_date = params.to_date;
  const path = params.opening_balances
    ? "/accounting/trial_balance/summary/opening_balances"
    : "/accounting/trial_balance/summary";
  const response = await client.get<Record<string, unknown>>(path, q);
  return formatResponse(response.data, params.response_format, () =>
    jsonBlock(params.opening_balances ? "Trial Balance Opening Balances" : "Trial Balance Summary", response.data)
  );
}

export async function getCashflow(client: FreeAgentApiClient, params: GetCashflowInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/cashflow", {
    from_date: params.from_date,
    to_date: params.to_date,
  });
  return formatResponse(response.data, params.response_format, () => jsonBlock("Cashflow", response.data));
}

export async function listAccountingTransactions(
  client: FreeAgentApiClient,
  params: ListAccountingTransactionsInput
): Promise<string> {
  const q: Record<string, string | number> = { page: params.page, per_page: params.per_page };
  if (params.from_date) q.from_date = params.from_date;
  if (params.to_date) q.to_date = params.to_date;
  const response = await client.get<{ accounting_transactions?: unknown[]; transactions?: unknown[] }>(
    "/accounting/transactions",
    q
  );
  const items = response.data.accounting_transactions ?? response.data.transactions ?? [];
  return formatResponse({ transactions: items }, params.response_format, () =>
    jsonBlock("Accounting Transactions", items)
  );
}

export async function getAccountingTransaction(
  client: FreeAgentApiClient,
  params: GetAccountingTransactionInput
): Promise<string> {
  const response = await client.get<Record<string, unknown>>(
    resourcePath(params.accounting_transaction_id, "accounting/transactions")
  );
  return formatResponse(response.data, params.response_format, () =>
    jsonBlock("Accounting Transaction", response.data)
  );
}
