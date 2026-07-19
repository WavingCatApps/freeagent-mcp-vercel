/**
 * Bank statement upload + explanation delete (fork additions).
 *
 * upload_bank_statement wraps POST /bank_transactions/statement. FreeAgent
 * silently de-duplicates uploaded rows against existing transactions with the
 * same date + amount + description, which is exactly how legitimate same-day
 * twins get lost. This tool therefore verifies the import afterwards using the
 * last_uploaded filter and reports any rows that did not survive.
 *
 * delete_bank_transaction_explanation removes a single explanation, returning
 * its transaction to unexplained. It never deletes bank transactions.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type {
  UploadBankStatementInput,
  DeleteBankTransactionExplanationInput,
} from "../schemas/index.js";
import type { FreeAgentBankTransactionExplanation } from "../types.js";
import { extractIdFromUrl } from "../services/formatter.js";

interface UploadedTransaction {
  url: string;
  dated_on: string;
  amount: string;
  description: string;
  transaction_id?: string;
}

function accountId(idOrUrl: string): string {
  return idOrUrl.startsWith("http") ? extractIdFromUrl(idOrUrl) : idOrUrl;
}

export async function uploadBankStatement(
  client: FreeAgentApiClient,
  params: UploadBankStatementInput
): Promise<string> {
  const account = accountId(params.bank_account);

  const statement = params.transactions.map((t) => {
    const row: Record<string, unknown> = {
      dated_on: t.dated_on,
      amount: t.amount,
      description: t.description,
    };
    if (t.fitid) row.fitid = t.fitid;
    if (t.transaction_type) row.transaction_type = t.transaction_type;
    return row;
  });

  await client.post(`/bank_transactions/statement?bank_account=${account}`, {
    statement,
  });

  // The upload endpoint's 200 does not confirm the import. Verify what landed.
  const check = await client.get<{ bank_transactions: UploadedTransaction[] }>(
    "/bank_transactions",
    { bank_account: account, last_uploaded: true, per_page: 100 }
  );
  const imported = check.data.bank_transactions ?? [];

  const lines = [
    `✅ Statement uploaded to bank account ${account}.`,
    "",
    `**Sent**: ${params.transactions.length} transaction(s)`,
    `**Imported in this upload**: ${imported.length}`,
    "",
    "| Date | Amount | Description | ID |",
    "|---|---|---|---|",
    ...imported.map(
      (t) =>
        `| ${t.dated_on} | ${t.amount} | ${t.description} | ${extractIdFromUrl(t.url)} |`
    ),
  ];

  if (imported.length < params.transactions.length) {
    lines.push(
      "",
      `⚠️ ${params.transactions.length - imported.length} row(s) appear to have been dropped by FreeAgent's de-duplication (same date + amount + description as an existing transaction). To add a deliberate same-day twin, re-send it with a slightly different description or a unique fitid.`
    );
  }

  return lines.join("\n");
}

export async function deleteBankTransactionExplanation(
  client: FreeAgentApiClient,
  params: DeleteBankTransactionExplanationInput
): Promise<string> {
  const id = params.bank_transaction_explanation_id.startsWith("http")
    ? extractIdFromUrl(params.bank_transaction_explanation_id)
    : params.bank_transaction_explanation_id;

  // Read before deleting so the reply carries an audit trail of what was removed.
  const before = await client.get<{
    bank_transaction_explanation: FreeAgentBankTransactionExplanation;
  }>(`/bank_transaction_explanations/${id}`);
  const exp = before.data.bank_transaction_explanation;

  await client.delete(`/bank_transaction_explanations/${id}`);

  return (
    `🗑️ Deleted bank transaction explanation ${id}. ` +
    `The underlying bank transaction is now unexplained.\n\n` +
    `Record of what was removed:\n` +
    `- **Date**: ${exp.dated_on}\n` +
    `- **Value**: ${exp.gross_value}\n` +
    `- **Type**: ${exp.type ?? "-"}\n` +
    `- **Description**: ${exp.description ?? "-"}\n` +
    `- **Bank transaction**: ${exp.bank_transaction}\n` +
    (exp.linked_transfer_account
      ? `- **Was linked to transfer account**: ${exp.linked_transfer_account} (pairing now broken)\n`
      : "")
  );
}
