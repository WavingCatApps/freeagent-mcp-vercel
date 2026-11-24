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
import { resourcePath } from "../utils/resource-path.js";

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

export async function addExplanationAttachments(
  client: FreeAgentApiClient,
  explanationIdOrUrl: string,
  attachments: FreeAgentAttachmentWritePayload[]
): Promise<FreeAgentAttachmentSummary[]> {
  if (attachments.length === 0) {
    return [];
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
