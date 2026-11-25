/**
 * Bank Transaction Explanation Tools
 *
 * Tools for explaining bank transactions by linking them to invoices, bills,
 * expenses, and other accounting entries.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentBankTransactionExplanation } from "../types.js";
import type {
  ListBankTransactionExplanationsInput,
  GetBankTransactionExplanationInput,
  CreateBankTransactionExplanationInput,
  UpdateBankTransactionExplanationInput,
  DeleteBankTransactionExplanationInput,
  ListBankTransactionExplanationAttachmentsInput
} from "../schemas/index.js";
import { formatResponse, createPaginationMetadata, extractIdFromUrl } from "../services/formatter.js";
import { buildAttachmentPayload } from "../services/attachment-payload.js";
import { cleanupStagedAttachment } from "../services/attachment-staging.js";
import {
  addExplanationAttachments,
  listExplanationAttachments,
  publicAttachmentMetadata,
  summarizeExplanationAttachmentRefs
} from "../services/explanation-attachments.js";
import { resourcePath } from "../utils/resource-path.js";

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

  const response = await client.get<{ bank_transaction_explanations: FreeAgentBankTransactionExplanation[] }>(
    "/bank_transaction_explanations",
    queryParams
  );
  const explanations = response.data.bank_transaction_explanations || [];
  const pagination = client.parsePaginationHeaders(response.headers);

  // Format response
  return formatResponse(
    {
      explanations: explanations.map((exp: FreeAgentBankTransactionExplanation) => {
        // Under X-Api-Version 2026-09-01, explanations embed attachment URLs
        // only (no file_name/size). Use list_…_attachments for metadata.
        const attachmentSummary = summarizeExplanationAttachmentRefs(exp);
        return {
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
          transfer_bank_account: exp.transfer_bank_account,
          has_attachment: attachmentSummary.has_attachment,
          attachment_count: attachmentSummary.attachment_count,
          attachments: attachmentSummary.attachments
        };
      }),
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

        const attachmentSummary = summarizeExplanationAttachmentRefs(exp);
        const receiptNote = attachmentSummary.has_attachment
          ? ` [${attachmentSummary.attachment_count} attachment(s)]`
          : " [no receipt]";

        lines.push(`## ${exp.dated_on} - ${amountStr}${reviewStatus} (ID: ${id})`);
        lines.push(`${desc}${receiptNote}`);
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

  const response = await client.get<{ bank_transaction_explanation: FreeAgentBankTransactionExplanation }>(explanationUrl);
  const exp = response.data.bank_transaction_explanation;
  const attachmentSummary = summarizeExplanationAttachmentRefs(exp);
  const attachmentDetails = attachmentSummary.has_attachment
    ? (await listExplanationAttachments(client, exp.url)).map(publicAttachmentMetadata)
    : [];

  const payload = {
    ...exp,
    has_attachment: attachmentSummary.has_attachment,
    attachment_count: attachmentSummary.attachment_count || attachmentDetails.length,
    attachments: attachmentDetails.length > 0 ? attachmentDetails : attachmentSummary.attachments
  };

  // Format response
  return formatResponse(
    payload,
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

      if (attachmentDetails.length > 0) {
        lines.push(`- **Attachments**: ${attachmentDetails.length} file(s)`);
        for (const a of attachmentDetails) {
          lines.push(
            `  - ${a.file_name ?? "file"} (${a.content_type ?? "?"}, ${a.file_size ?? "?"} bytes) — ${a.url ?? ""}`
          );
        }
      } else {
        lines.push(`- **Attachments**: none`);
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
  const explanationPayload: Record<string, unknown> = {
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

  // Attachments are added via the Explanation Attachments API after create
  // (nested `attachment` is not accepted under X-Api-Version 2026-09-01).
  // Resolve before creating a record so an invalid/missing upload makes no write.
  const attachmentPayload = params.attachment
    ? await buildAttachmentPayload(params.attachment)
    : undefined;
  const response = await client.post<{ bank_transaction_explanation: FreeAgentBankTransactionExplanation }>(
    "/bank_transaction_explanations",
    { bank_transaction_explanation: explanationPayload }
  );

  const explanation = response.data.bank_transaction_explanation;
  const explanationId = extractIdFromUrl(explanation.url);

  if (attachmentPayload) {
    const payload = attachmentPayload;
    try {
      await addExplanationAttachments(client, explanation.url, [
        {
          data: payload.data,
          file_name: payload.file_name,
          content_type: payload.content_type,
          description: payload.description
        }
      ]);
    } catch (error) {
      throw new Error(
        `Explanation ${explanationId} was created, but its attachment was not confirmed saved. ` +
        `Do not create the explanation again. Check its attachments, then retry with ` +
        `freeagent_update_bank_transaction_explanation and bank_transaction_explanation_id=${explanationId}. ` +
        (params.attachment?.upload_id ? `The staged upload is retained until expiry. ` : "") +
        `(${error instanceof Error ? error.message : "unknown error"})`
      );
    }
    await cleanupStagedAttachment(params.attachment?.upload_id);
  }

  // Determine explanation type
  let explanationType = "general transaction";
  if (params.paid_invoice) explanationType = "invoice payment";
  else if (params.paid_bill) explanationType = "bill payment";
  else if (params.paid_user) explanationType = "user payment";
  else if (params.transfer_bank_account) explanationType = "bank transfer";

  const attachmentInfo = params.attachment
    ? ` with attachment (${params.attachment.file_name ?? params.attachment.path ?? params.attachment.upload_id ?? "file"})`
    : "";

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
  const explanationPayload: Record<string, unknown> = {};

  // Add fields only if provided
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

  const hasFieldUpdates = Object.keys(explanationPayload).length > 0;
  let explanation: FreeAgentBankTransactionExplanation;

  if (hasFieldUpdates) {
    const response = await client.put<{ bank_transaction_explanation: FreeAgentBankTransactionExplanation }>(
      explanationUrl,
      { bank_transaction_explanation: explanationPayload }
    );
    explanation = response.data.bank_transaction_explanation;
  } else {
    const response = await client.get<{ bank_transaction_explanation: FreeAgentBankTransactionExplanation }>(
      explanationUrl
    );
    explanation = response.data.bank_transaction_explanation;
  }

  // Attachment adds via the Attachments API (does not replace existing files;
  // explanations support up to 50). Nested `attachment` on PUT is rejected
  // under X-Api-Version 2026-09-01.
  let attachmentNote = "";
  if (updateFields.attachment !== undefined) {
    const payload = await buildAttachmentPayload(updateFields.attachment);
    const attachments = await addExplanationAttachments(client, explanation.url, [
      {
        data: payload.data,
        file_name: payload.file_name,
        content_type: payload.content_type,
        description: payload.description
      }
    ]);
    await cleanupStagedAttachment(updateFields.attachment.upload_id);
    attachmentNote =
      `\n**Attachments now**: ${attachments.length} file(s)` +
      (payload.file_name ? ` (added ${payload.file_name})` : "");
  }

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
    `**URL**: ${explanation.url}` +
    attachmentNote;
}


export async function deleteBankTransactionExplanation(
  client: FreeAgentApiClient,
  params: DeleteBankTransactionExplanationInput
): Promise<string> {
  await client.delete(resourcePath(params.bank_transaction_explanation_id, "bank_transaction_explanations"));
  return `✅ Bank transaction explanation deleted: ${params.bank_transaction_explanation_id}`;
}

/**
 * List full attachment metadata for one explanation (file names, sizes, types).
 * Prefer this after list_explanations shows has_attachment — explanation list
 * rows only include attachment URLs under API version 2026-09-01.
 */
export async function listBankTransactionExplanationAttachments(
  client: FreeAgentApiClient,
  params: ListBankTransactionExplanationAttachmentsInput
): Promise<string> {
  const { bank_transaction_explanation_id, response_format } = params;
  const attachments = (
    await listExplanationAttachments(client, bank_transaction_explanation_id)
  ).map(publicAttachmentMetadata);

  return formatResponse(
    {
      bank_transaction_explanation_id,
      attachment_count: attachments.length,
      attachments
    },
    response_format,
    () => {
      const lines: string[] = [
        `# Attachments for explanation ${bank_transaction_explanation_id}`,
        ""
      ];
      if (attachments.length === 0) {
        lines.push("No attachments.");
        return lines.join("\n");
      }
      for (const a of attachments) {
        lines.push(
          `- **${a.file_name ?? "file"}** — ${a.content_type ?? "?"}, ${a.file_size ?? "?"} bytes`
        );
        if (a.url) lines.push(`  - URL: ${a.url}`);
        if (a.description) lines.push(`  - ${a.description}`);
      }
      return lines.join("\n");
    }
  );
}
