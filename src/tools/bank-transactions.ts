/**
 * Bank Transaction Explanation Tools
 *
 * Tools for explaining bank transactions by linking them to invoices, bills,
 * expenses, and other accounting entries.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { CreateBankTransactionExplanationInput } from "../schemas/index.js";
import { extractIdFromUrl } from "../services/formatter.js";

/**
 * Create a bank transaction explanation
 *
 * This explains (categorizes) a bank transaction by linking it to:
 * - Invoice payments
 * - Bill payments
 * - User payments
 * - Transfers
 * - Or general category with description
 */
export async function createBankTransactionExplanation(
  client: FreeAgentApiClient,
  params: CreateBankTransactionExplanationInput
): Promise<string> {
  // Build explanation payload
  const explanationPayload: any = {
    bank_transaction: params.bank_transaction,
    dated_on: params.dated_on,
    gross_value: params.gross_value
  };

  // Add optional fields
  if (params.description) explanationPayload.description = params.description;
  if (params.category) explanationPayload.category = params.category;

  // Entity links
  if (params.paid_invoice) explanationPayload.paid_invoice = params.paid_invoice;
  if (params.paid_bill) explanationPayload.paid_bill = params.paid_bill;
  if (params.paid_user) explanationPayload.paid_user = params.paid_user;
  if (params.project) explanationPayload.project = params.project;

  // Tax information
  if (params.sales_tax_rate) explanationPayload.sales_tax_rate = params.sales_tax_rate;
  if (params.sales_tax_value) explanationPayload.sales_tax_value = params.sales_tax_value;

  // Transfer information
  if (params.transfer_bank_account) {
    explanationPayload.transfer_bank_account = params.transfer_bank_account;
  }

  // Add attachment if provided
  if (params.attachment) {
    explanationPayload.attachment = {
      data: params.attachment.data,
      file_name: params.attachment.file_name,
      content_type: params.attachment.content_type
    };
    if (params.attachment.description) {
      explanationPayload.attachment.description = params.attachment.description;
    }
  }

  const response = await client.post<{ bank_transaction_explanation: any }>(
    "/bank_transaction_explanations",
    { bank_transaction_explanation: explanationPayload }
  );

  const explanation = response.bank_transaction_explanation;
  const explanationId = extractIdFromUrl(explanation.url);

  // Determine explanation type
  let explanationType = "general transaction";
  if (params.paid_invoice) explanationType = "invoice payment";
  else if (params.paid_bill) explanationType = "bill payment";
  else if (params.paid_user) explanationType = "user payment";
  else if (params.transfer_bank_account) explanationType = "bank transfer";

  const attachmentInfo = params.attachment ? ` with attachment (${params.attachment.file_name})` : '';

  return `✅ Successfully explained bank transaction as ${explanationType}${attachmentInfo}\n\n` +
    `**Explanation ID**: ${explanationId}\n` +
    `**Date**: ${explanation.dated_on}\n` +
    `**Amount**: ${explanation.gross_value}\n` +
    (explanation.description ? `**Description**: ${explanation.description}\n` : '') +
    `**URL**: ${explanation.url}\n\n` +
    `The bank transaction has been categorized and will now appear as explained in your FreeAgent account.`;
}
