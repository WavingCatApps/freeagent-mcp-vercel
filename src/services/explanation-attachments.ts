/**
 * Bank Transaction Explanation Attachments API (X-Api-Version 2026-09-01).
 *
 * Nested `attachment` on create/update explanations is removed under this
 * version; files are managed at:
 *   /bank_transaction_explanations/:id/attachments
 */

import type { FreeAgentApiClient } from "./api-client.js";
import type {
  FreeAgentAttachmentRef,
  FreeAgentAttachmentSummary,
  FreeAgentBankTransactionExplanation
} from "../types.js";
import type { AttachmentInput } from "../schemas/index.js";
import { buildAttachmentPayload } from "./attachment-payload.js";
import { resourcePath } from "../utils/resource-path.js";

/** FreeAgent allows up to 10 attachments per Attachments API write. */
export const MAX_ATTACHMENTS_PER_REQUEST = 10;

export type FreeAgentAttachmentWritePayload = {
  data: string;
  file_name: string;
  content_type: string;
  description?: string;
};

export function explanationAttachmentsPath(explanationIdOrUrl: string): string {
  return `${resourcePath(explanationIdOrUrl, "bank_transaction_explanations")}/attachments`;
}

/**
 * Shape attachment presence for list responses.
 * Explanation list/get under 2026-09-01 only embed `{ url }` refs — use
 * {@link listExplanationAttachments} for file_name / size / content_type.
 */
export function summarizeExplanationAttachmentRefs(
  exp: FreeAgentBankTransactionExplanation
): {
  has_attachment: boolean;
  attachment_count: number;
  attachments: FreeAgentAttachmentRef[];
} {
  const fromArray = exp.attachments ?? [];
  const legacy = exp.attachment?.url ? [{ url: exp.attachment.url }] : [];
  const refs = fromArray.length > 0 ? fromArray : legacy;
  const urls = refs
    .map((a) => a.url)
    .filter((u): u is string => typeof u === "string" && u.length > 0);
  const count =
    typeof exp.attachment_count === "number" && exp.attachment_count > 0
      ? exp.attachment_count
      : urls.length;

  return {
    has_attachment: count > 0 || urls.length > 0,
    attachment_count: count,
    attachments: urls.map((url) => ({ url }))
  };
}

/**
 * Collect singular `attachment` and/or `attachments[]` tool inputs into write
 * payloads (max 10 per FreeAgent request).
 */
export async function resolveExplanationAttachmentWrites(params: {
  attachment?: AttachmentInput;
  attachments?: AttachmentInput[];
}): Promise<FreeAgentAttachmentWritePayload[]> {
  const inputs: AttachmentInput[] = [...(params.attachments ?? [])];
  if (params.attachment) {
    inputs.push(params.attachment);
  }
  if (inputs.length === 0) {
    return [];
  }
  if (inputs.length > MAX_ATTACHMENTS_PER_REQUEST) {
    throw new Error(
      `At most ${MAX_ATTACHMENTS_PER_REQUEST} attachments can be uploaded per request (got ${inputs.length})`
    );
  }

  const payloads: FreeAgentAttachmentWritePayload[] = [];
  for (const input of inputs) {
    const payload = await buildAttachmentPayload(input);
    payloads.push({
      data: payload.data,
      file_name: payload.file_name,
      content_type: payload.content_type,
      description: payload.description
    });
  }
  return payloads;
}

export async function addExplanationAttachments(
  client: FreeAgentApiClient,
  explanationIdOrUrl: string,
  attachments: FreeAgentAttachmentWritePayload[]
): Promise<FreeAgentAttachmentSummary[]> {
  if (attachments.length === 0) {
    return [];
  }
  if (attachments.length > MAX_ATTACHMENTS_PER_REQUEST) {
    throw new Error(
      `At most ${MAX_ATTACHMENTS_PER_REQUEST} attachments can be uploaded per request (got ${attachments.length})`
    );
  }
  const response = await client.post<{ attachments: FreeAgentAttachmentSummary[] }>(
    explanationAttachmentsPath(explanationIdOrUrl),
    { attachments }
  );
  return response.data.attachments ?? [];
}

export async function listExplanationAttachments(
  client: FreeAgentApiClient,
  explanationIdOrUrl: string
): Promise<FreeAgentAttachmentSummary[]> {
  const response = await client.get<{ attachments: FreeAgentAttachmentSummary[] }>(
    explanationAttachmentsPath(explanationIdOrUrl)
  );
  return response.data.attachments ?? [];
}

function toAttachmentUri(attachmentIdOrUrl: string, explanationIdOrUrl: string): string {
  if (attachmentIdOrUrl.startsWith("http://") || attachmentIdOrUrl.startsWith("https://")) {
    return attachmentIdOrUrl;
  }
  if (explanationIdOrUrl.startsWith("http://") || explanationIdOrUrl.startsWith("https://")) {
    const origin = explanationIdOrUrl.replace(/\/v2\/.*$/, "");
    return `${origin}/v2/attachments/${attachmentIdOrUrl}`;
  }
  return `https://api.freeagent.com/v2/attachments/${attachmentIdOrUrl}`;
}

/**
 * Delete one or more attachments via PUT …/attachments with `_destroy: true`
 * (preferred under X-Api-Version 2026-09-01).
 */
export async function destroyExplanationAttachments(
  client: FreeAgentApiClient,
  explanationIdOrUrl: string,
  attachmentIdsOrUrls: string[]
): Promise<FreeAgentAttachmentSummary[]> {
  if (attachmentIdsOrUrls.length === 0) {
    return listExplanationAttachments(client, explanationIdOrUrl);
  }

  const attachments = attachmentIdsOrUrls.map((idOrUrl) => ({
    url: toAttachmentUri(idOrUrl, explanationIdOrUrl),
    _destroy: "true"
  }));

  const response = await client.put<{ attachments: FreeAgentAttachmentSummary[] }>(
    explanationAttachmentsPath(explanationIdOrUrl),
    { attachments }
  );
  return response.data.attachments ?? [];
}

/** Delete every attachment on an explanation. */
export async function deleteAllExplanationAttachments(
  client: FreeAgentApiClient,
  explanationIdOrUrl: string
): Promise<void> {
  await client.delete(explanationAttachmentsPath(explanationIdOrUrl));
}

/** Public metadata for tool responses — omits short-lived content_src URLs. */
export function publicAttachmentMetadata(
  attachment: FreeAgentAttachmentSummary
): {
  url?: string;
  file_name?: string;
  file_size?: number;
  content_type?: string;
  description?: string;
} {
  return {
    url: attachment.url,
    file_name: attachment.file_name,
    file_size: attachment.file_size,
    content_type: attachment.content_type,
    description: attachment.description
  };
}

/**
 * Normalize a nested explanation on a bank transaction (URL string or object)
 * and surface attachment refs when present.
 */
export function shapeNestedBankTransactionExplanation(
  exp: string | FreeAgentBankTransactionExplanation
): Record<string, unknown> {
  if (typeof exp === "string") {
    return { url: exp };
  }
  const attachmentSummary = summarizeExplanationAttachmentRefs(exp);
  return {
    url: exp.url,
    dated_on: exp.dated_on,
    description: exp.description,
    gross_value: exp.gross_value,
    category: exp.category,
    marked_for_review: exp.marked_for_review,
    has_attachment: attachmentSummary.has_attachment,
    attachment_count: attachmentSummary.attachment_count,
    attachments: attachmentSummary.attachments
  };
}
