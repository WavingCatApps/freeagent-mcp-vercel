/**
 * Bank Transaction Explanation Tools
 *
 * Tools for explaining bank transactions by linking them to invoices, bills,
 * expenses, and other accounting entries.
 */

import { gunzipSync } from "zlib";
import type { FreeAgentApiClient } from "../services/api-client.js";
import type {
  ListBankTransactionExplanationsInput,
  GetBankTransactionExplanationInput,
  CreateBankTransactionExplanationInput,
  UpdateBankTransactionExplanationInput
} from "../schemas/index.js";
import { ResponseFormat } from "../constants.js";
import {
  formatResponse,
  createPaginationMetadata,
  extractIdFromUrl
} from "../services/formatter.js";

/**
 * List bank transaction explanations with optional filtering and pagination
 */
export async function listBankTransactionExplanations(
  client: FreeAgentApiClient,
  params: ListBankTransactionExplanationsInput
): Promise<string> {
  const { page, per_page, bank_account, from_date, to_date, response_format } = params;

  // Build query parameters
  const queryParams: Record<string, string> = {
    page: page.toString(),
    per_page: per_page.toString()
  };

  if (bank_account) queryParams.bank_account = bank_account;
  if (from_date) queryParams.from_date = from_date;
  if (to_date) queryParams.to_date = to_date;

  const response = await client.get<{ bank_transaction_explanations: any[] }>(
    "/bank_transaction_explanations",
    queryParams
  );
  const explanations = response.bank_transaction_explanations || [];
  const pagination = client.parsePaginationHeaders(
    (response as any).headers || {}
  );

  // Format response
  return formatResponse(
    {
      explanations: explanations.map((exp: any) => ({
        url: exp.url,
        dated_on: exp.dated_on,
        description: exp.description,
        gross_value: exp.gross_value,
        bank_transaction: exp.bank_transaction,
        category: exp.category,
        ec_status: exp.ec_status,
        receipt_reference: exp.receipt_reference,
        marked_for_review: exp.marked_for_review,
        paid_invoice: exp.paid_invoice,
        paid_bill: exp.paid_bill,
        paid_user: exp.paid_user,
        transfer_bank_account: exp.transfer_bank_account
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
      const lines: string[] = ["# Bank Transaction Explanations", ""];

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

      if (explanations.length === 0) {
        lines.push("No explanations found matching the criteria.");
        return lines.join("\n");
      }

      for (const exp of explanations) {
        const id = extractIdFromUrl(exp.url);
        const amount = parseFloat(exp.gross_value || '0');
        const amountStr = amount >= 0 ? `+${amount}` : `${amount}`;
        const desc = exp.description || 'No description';
        const reviewStatus = exp.marked_for_review ? ' ⚠️ NEEDS REVIEW' : '';

        lines.push(`## ${exp.dated_on} - ${amountStr}${reviewStatus} (ID: ${id})`);
        lines.push(`${desc}`);
        if (exp.category) lines.push(`Category: ${exp.category}`);
        if (exp.paid_invoice) lines.push(`Paid Invoice: ${exp.paid_invoice}`);
        if (exp.paid_bill) lines.push(`Paid Bill: ${exp.paid_bill}`);
        if (exp.transfer_bank_account) lines.push(`Transfer to: ${exp.transfer_bank_account}`);
        lines.push("");
      }

      return lines.join("\n");
    }
  );
}

/**
 * Get detailed information about a specific bank transaction explanation
 */
export async function getBankTransactionExplanation(
  client: FreeAgentApiClient,
  params: GetBankTransactionExplanationInput
): Promise<string> {
  const { bank_transaction_explanation_id, response_format } = params;
  const explanationUrl = bank_transaction_explanation_id.startsWith('http')
    ? bank_transaction_explanation_id
    : `/bank_transaction_explanations/${bank_transaction_explanation_id}`;

  const response = await client.get<{ bank_transaction_explanation: any }>(explanationUrl);
  const exp = response.bank_transaction_explanation;

  // Format response
  return formatResponse(
    exp,
    response_format,
    () => {
      const lines: string[] = ["# Bank Transaction Explanation Details", ""];

      const amount = parseFloat(exp.gross_value || '0');
      const amountStr = amount >= 0 ? `+${amount}` : `${amount}`;

      lines.push(`- **Date**: ${exp.dated_on}`);
      lines.push(`- **Amount**: ${amountStr}`);
      lines.push(`- **Description**: ${exp.description || 'N/A'}`);
      lines.push(`- **Bank Transaction**: ${exp.bank_transaction}`);

      if (exp.category) {
        lines.push(`- **Category**: ${exp.category}`);
      }

      if (exp.ec_status) {
        lines.push(`- **EC Status**: ${exp.ec_status}`);
      }

      if (exp.receipt_reference) {
        lines.push(`- **Receipt Reference**: ${exp.receipt_reference}`);
      }

      lines.push(`- **Marked for Review**: ${exp.marked_for_review ? 'Yes' : 'No'}`);

      // Entity links
      if (exp.paid_invoice) {
        lines.push(`- **Paid Invoice**: ${exp.paid_invoice}`);
      }
      if (exp.paid_bill) {
        lines.push(`- **Paid Bill**: ${exp.paid_bill}`);
      }
      if (exp.paid_user) {
        lines.push(`- **Paid User**: ${exp.paid_user}`);
      }
      if (exp.transfer_bank_account) {
        lines.push(`- **Transfer to Account**: ${exp.transfer_bank_account}`);
      }
      if (exp.project) {
        lines.push(`- **Project**: ${exp.project}`);
      }

      // Tax information
      if (exp.sales_tax_rate) {
        lines.push(`- **Sales Tax Rate**: ${parseFloat(exp.sales_tax_rate) * 100}%`);
      }
      if (exp.sales_tax_value) {
        lines.push(`- **Sales Tax Value**: ${exp.sales_tax_value}`);
      }

      if (exp.attachment_count && exp.attachment_count > 0) {
        lines.push(`- **Attachments**: ${exp.attachment_count} file(s)`);
      }

      lines.push("");
      lines.push(`- **Created**: ${exp.created_at}`);
      lines.push(`- **Updated**: ${exp.updated_at}`);

      return lines.join("\n");
    }
  );
}

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
    let attachmentData = params.attachment.data;

    // If attachment is gzipped, decompress it before sending to FreeAgent
    if (params.attachment.is_gzipped) {
      try {
        // Decode Base64 to Buffer
        const compressedBuffer = Buffer.from(attachmentData, 'base64');
        // Decompress using gunzip
        const decompressedBuffer = gunzipSync(compressedBuffer);
        // Re-encode to Base64
        attachmentData = decompressedBuffer.toString('base64');
      } catch (error) {
        throw new Error(`Failed to decompress gzipped attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    explanationPayload.attachment = {
      data: attachmentData,
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
