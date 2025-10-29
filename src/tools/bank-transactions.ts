/**
 * Bank Transaction Explanation Tools
 *
 * Tools for explaining bank transactions by linking them to invoices, bills,
 * expenses, and other accounting entries.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { CreateBankTransactionExplanationInput, UpdateBankTransactionExplanationInput } from "../schemas/index.js";
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
  if (params.ec_status) explanationPayload.ec_status = params.ec_status;
  if (params.marked_for_review !== undefined) explanationPayload.marked_for_review = params.marked_for_review;
  if (params.receipt_reference) explanationPayload.receipt_reference = params.receipt_reference;

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

/**
 * Update an existing bank transaction explanation
 *
 * This updates an existing explanation by modifying its description,
 * category, or other fields.
 */
export async function updateBankTransactionExplanation(
  client: FreeAgentApiClient,
  params: UpdateBankTransactionExplanationInput
): Promise<string> {
  const { bank_transaction_explanation_id, ...updateFields } = params;
  const explanationUrl = bank_transaction_explanation_id.startsWith('http')
    ? bank_transaction_explanation_id
    : `/bank_transaction_explanations/${bank_transaction_explanation_id}`;

  // Build explanation payload with only provided fields
  const explanationPayload: any = {};

  // Add optional fields only if provided
  if (updateFields.dated_on !== undefined) explanationPayload.dated_on = updateFields.dated_on;
  if (updateFields.description !== undefined) explanationPayload.description = updateFields.description;
  if (updateFields.gross_value !== undefined) explanationPayload.gross_value = updateFields.gross_value;
  if (updateFields.category !== undefined) explanationPayload.category = updateFields.category;
  if (updateFields.ec_status !== undefined) explanationPayload.ec_status = updateFields.ec_status;
  if (updateFields.marked_for_review !== undefined) explanationPayload.marked_for_review = updateFields.marked_for_review;
  if (updateFields.receipt_reference !== undefined) explanationPayload.receipt_reference = updateFields.receipt_reference;

  // Entity links
  if (updateFields.paid_invoice !== undefined) explanationPayload.paid_invoice = updateFields.paid_invoice;
  if (updateFields.paid_bill !== undefined) explanationPayload.paid_bill = updateFields.paid_bill;
  if (updateFields.paid_user !== undefined) explanationPayload.paid_user = updateFields.paid_user;
  if (updateFields.project !== undefined) explanationPayload.project = updateFields.project;

  // Tax information
  if (updateFields.sales_tax_rate !== undefined) explanationPayload.sales_tax_rate = updateFields.sales_tax_rate;
  if (updateFields.sales_tax_value !== undefined) explanationPayload.sales_tax_value = updateFields.sales_tax_value;

  // Transfer information
  if (updateFields.transfer_bank_account !== undefined) {
    explanationPayload.transfer_bank_account = updateFields.transfer_bank_account;
  }

  const response = await client.put<{ bank_transaction_explanation: any }>(
    explanationUrl,
    { bank_transaction_explanation: explanationPayload }
  );

  const explanation = response.bank_transaction_explanation;
  const explanationId = extractIdFromUrl(explanation.url);

  // Determine explanation type
  let explanationType = "general transaction";
  if (explanation.paid_invoice) explanationType = "invoice payment";
  else if (explanation.paid_bill) explanationType = "bill payment";
  else if (explanation.paid_user) explanationType = "user payment";
  else if (explanation.transfer_bank_account) explanationType = "bank transfer";

  return `✅ Successfully updated bank transaction explanation (${explanationType})\n\n` +
    `**Explanation ID**: ${explanationId}\n` +
    `**Date**: ${explanation.dated_on}\n` +
    `**Amount**: ${explanation.gross_value}\n` +
    (explanation.description ? `**Description**: ${explanation.description}\n` : '') +
    (explanation.category ? `**Category**: ${explanation.category}\n` : '') +
    `**URL**: ${explanation.url}`;
}
