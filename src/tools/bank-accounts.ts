/**
 * Bank Account Tools
 *
 * Tools for listing and viewing bank accounts.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type {
  ListBankAccountsInput,
  GetBankAccountInput,
  ListBankTransactionsInput
} from "../schemas/index.js";
import { ResponseFormat } from "../constants.js";
import {
  formatResponse,
  createPaginationMetadata,
  extractIdFromUrl
} from "../services/formatter.js";

/**
 * List all bank accounts
 */
export async function listBankAccounts(
  client: FreeAgentApiClient,
  params: ListBankAccountsInput
): Promise<string> {
  const { response_format } = params;

  const response = await client.get<{ bank_accounts: any[] }>("/bank_accounts");
  const bankAccounts = response.bank_accounts || [];

  // Format response
  return formatResponse(
    { bank_accounts: bankAccounts },
    response_format,
    () => {
      const lines: string[] = ["# FreeAgent Bank Accounts", ""];

      if (bankAccounts.length === 0) {
        lines.push("No bank accounts found.");
        return lines.join("\n");
      }

      for (const account of bankAccounts) {
        const id = extractIdFromUrl(account.url);
        const name = account.name || 'Unnamed Account';
        const type = account.type || 'Unknown';
        const currency = account.currency || 'GBP';
        const balance = account.current_balance
          ? `${currency} ${account.current_balance}`
          : 'N/A';
        const status = account.is_active ? '✓ Active' : '✗ Inactive';

        lines.push(`## ${name} (ID: ${id})`);
        lines.push(`- **Type**: ${type}`);
        lines.push(`- **Currency**: ${currency}`);
        lines.push(`- **Balance**: ${balance}`);
        lines.push(`- **Status**: ${status}`);
        if (account.bank_name) {
          lines.push(`- **Bank**: ${account.bank_name}`);
        }
        if (account.account_number) {
          lines.push(`- **Account Number**: ${account.account_number}`);
        }
        lines.push("");
      }

      return lines.join("\n");
    }
  );
}

/**
 * Get detailed information about a specific bank account
 */
export async function getBankAccount(
  client: FreeAgentApiClient,
  params: GetBankAccountInput
): Promise<string> {
  const { bank_account_id, response_format } = params;
  const accountUrl = bank_account_id.startsWith('http')
    ? bank_account_id
    : `/bank_accounts/${bank_account_id}`;

  const response = await client.get<{ bank_account: any }>(accountUrl);
  const account = response.bank_account;

  // Format response
  return formatResponse(
    account,
    response_format,
    () => {
      const lines: string[] = ["# Bank Account Details", ""];

      lines.push(`- **Name**: ${account.name || 'N/A'}`);
      lines.push(`- **Type**: ${account.type || 'N/A'}`);
      lines.push(`- **Currency**: ${account.currency || 'GBP'}`);
      lines.push(`- **Current Balance**: ${account.currency || 'GBP'} ${account.current_balance || '0.00'}`);
      lines.push(`- **Status**: ${account.is_active ? 'Active' : 'Inactive'}`);

      if (account.bank_name) {
        lines.push(`- **Bank**: ${account.bank_name}`);
      }

      if (account.account_number) {
        lines.push(`- **Account Number**: ${account.account_number}`);
      }

      if (account.sort_code) {
        lines.push(`- **Sort Code**: ${account.sort_code}`);
      }

      if (account.iban) {
        lines.push(`- **IBAN**: ${account.iban}`);
      }

      if (account.bic) {
        lines.push(`- **BIC/SWIFT**: ${account.bic}`);
      }

      if (account.opening_balance !== undefined) {
        lines.push(`- **Opening Balance**: ${account.currency || 'GBP'} ${account.opening_balance}`);
      }

      lines.push("");
      lines.push(`- **Created**: ${account.created_at}`);
      lines.push(`- **Updated**: ${account.updated_at}`);

      return lines.join("\n");
    }
  );
}

/**
 * List bank transactions for a specific bank account
 */
export async function listBankTransactions(
  client: FreeAgentApiClient,
  params: ListBankTransactionsInput
): Promise<string> {
  const { bank_account, page, per_page, from_date, to_date, view, response_format } = params;

  // Build query parameters
  const queryParams: Record<string, string> = {
    bank_account: bank_account,
    page: page.toString(),
    per_page: per_page.toString()
  };

  if (from_date) queryParams.from_date = from_date;
  if (to_date) queryParams.to_date = to_date;
  if (view) queryParams.view = view;

  const response = await client.get<{ bank_transactions: any[] }>(
    "/bank_transactions",
    queryParams
  );
  const transactions = response.bank_transactions || [];
  const pagination = client.parsePaginationHeaders(
    (response as any).headers || {}
  );

  // Format response
  return formatResponse(
    {
      transactions: transactions.map((txn: any) => ({
        url: txn.url,
        dated_on: txn.dated_on,
        description: txn.description,
        amount: txn.amount,
        unexplained_amount: txn.unexplained_amount,
        is_manual: txn.is_manual,
        bank_account: txn.bank_account
      })),
      pagination: {
        page,
        per_page,
        total_count: pagination.totalCount,
        has_more: pagination.hasMore,
        next_page: pagination.nextPage
      }
    },
    response_format,
    () => {
      const lines: string[] = ["# Bank Transactions", ""];

      if (pagination.totalCount !== undefined) {
        lines.push(
          createPaginationMetadata({
            page,
            perPage: per_page,
            totalCount: pagination.totalCount,
            hasMore: pagination.hasMore,
            nextPage: pagination.nextPage
          })
        );
        lines.push("");
      }

      if (transactions.length === 0) {
        lines.push("No transactions found matching the criteria.");
        return lines.join("\n");
      }

      for (const txn of transactions) {
        const id = extractIdFromUrl(txn.url);
        const amount = parseFloat(txn.amount);
        const amountStr = amount >= 0 ? `+${amount}` : `${amount}`;
        const desc = txn.description || 'No description';
        const unexplained = parseFloat(txn.unexplained_amount || '0');
        const status = unexplained !== 0 ? ' ⚠️ UNEXPLAINED' : ' ✓ Explained';
        const manual = txn.is_manual ? ' [MANUAL]' : '';

        lines.push(`## ${txn.dated_on} - ${amountStr}${status} (ID: ${id})`);
        lines.push(`${desc}${manual}`);
        if (unexplained !== 0) {
          lines.push(`*Unexplained amount: ${unexplained}*`);
        }
        lines.push("");
      }

      return lines.join("\n");
    }
  );
}
