/**
 * Resolve tool attachment inputs into FreeAgent's base64 attachment payload.
 *
 * Supports:
 * - Inline `data` (optionally gzip-then-base64 with is_gzipped=true)
 * - Out-of-band `upload_id` from freeagent_prepare_attachment_upload
 */

import { gunzipSync } from "zlib";
import { fetchStagedAttachmentBytes } from "./attachment-staging.js";

export interface AttachmentInput {
  data?: string;
  upload_id?: string;
  is_gzipped?: boolean;
  file_name: string;
  content_type: string;
  description?: string;
}

export async function buildAttachmentPayload(
  attachment: AttachmentInput
): Promise<Record<string, string>> {
  const hasData = typeof attachment.data === "string" && attachment.data.length > 0;
  const hasUploadId =
    typeof attachment.upload_id === "string" && attachment.upload_id.length > 0;

  if (hasData && hasUploadId) {
    throw new Error("Provide attachment.data or attachment.upload_id, not both");
  }
  if (!hasData && !hasUploadId) {
    throw new Error(
      "Attachment requires either data (base64) or upload_id from freeagent_prepare_attachment_upload"
    );
  }

  let attachmentData: string;
  let fileName = attachment.file_name;
  let contentType = attachment.content_type;

  if (hasUploadId) {
    if (attachment.is_gzipped) {
      throw new Error(
        "is_gzipped applies only to inline attachment.data — PUT the raw file for upload_id staging"
      );
    }
    const staged = await fetchStagedAttachmentBytes(attachment.upload_id!);
    attachmentData = staged.buffer.toString("base64");
    // Prefer token metadata (authoritative) over caller-supplied names.
    fileName = staged.file_name || fileName;
    contentType = staged.content_type || contentType;
  } else {
    attachmentData = attachment.data!;
    if (attachment.is_gzipped) {
      try {
        const compressedBuffer = Buffer.from(attachmentData, "base64");
        const decompressedBuffer = gunzipSync(compressedBuffer);
        attachmentData = decompressedBuffer.toString("base64");
      } catch (error) {
        throw new Error(
          `Failed to decompress gzipped attachment: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  }

  const payload: Record<string, string> = {
    data: attachmentData,
    file_name: fileName,
    content_type: contentType,
  };
  if (attachment.description) {
    payload.description = attachment.description;
  }
  return payload;
}
