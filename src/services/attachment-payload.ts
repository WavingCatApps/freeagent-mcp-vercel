/**
 * Resolve tool attachment inputs into FreeAgent's base64 attachment payload.
 *
 * Three mutually exclusive sources:
 * - `path` — local file under FREEAGENT_ATTACHMENTS_DIR (best for stdio)
 * - `upload_id` — S3-compatible staging (best for remote MCP)
 * - `data` — inline base64 (fallback; optionally gzip + is_gzipped)
 */

import { gunzipSync } from "zlib";
import { fetchStagedAttachmentBytes } from "./attachment-staging.js";
import { readLocalAttachment } from "./attachment-local-path.js";

export interface AttachmentInput {
  path?: string;
  data?: string;
  upload_id?: string;
  is_gzipped?: boolean;
  file_name?: string;
  content_type?: string;
  description?: string;
}

function countSources(attachment: AttachmentInput): string[] {
  const sources: string[] = [];
  if (typeof attachment.path === "string" && attachment.path.length > 0) sources.push("path");
  if (typeof attachment.data === "string" && attachment.data.length > 0) sources.push("data");
  if (typeof attachment.upload_id === "string" && attachment.upload_id.length > 0) {
    sources.push("upload_id");
  }
  return sources;
}

export async function buildAttachmentPayload(
  attachment: AttachmentInput
): Promise<Record<string, string>> {
  const sources = countSources(attachment);
  if (sources.length > 1) {
    throw new Error(
      `Provide exactly one of attachment.path, attachment.upload_id, or attachment.data (got ${sources.join(", ")})`
    );
  }
  if (sources.length === 0) {
    throw new Error(
      "Attachment requires one of: path (local FREEAGENT_ATTACHMENTS_DIR), " +
        "upload_id (from freeagent_prepare_attachment_upload), or data (base64)"
    );
  }

  if (attachment.is_gzipped && sources[0] !== "data") {
    throw new Error("is_gzipped applies only to inline attachment.data");
  }

  let attachmentData: string;
  let fileName = attachment.file_name?.trim() || "";
  let contentType = attachment.content_type?.trim() || "";

  if (sources[0] === "path") {
    const local = await readLocalAttachment(attachment.path!);
    attachmentData = local.buffer.toString("base64");
    fileName = fileName || local.file_name;
    contentType = contentType || local.content_type;
  } else if (sources[0] === "upload_id") {
    const staged = await fetchStagedAttachmentBytes(attachment.upload_id!);
    attachmentData = staged.buffer.toString("base64");
    fileName = fileName || staged.file_name;
    contentType = contentType || staged.content_type;
  } else {
    if (!fileName || !contentType) {
      throw new Error("Inline attachment.data requires file_name and content_type");
    }
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

  if (!fileName || !contentType) {
    throw new Error("Attachment is missing file_name or content_type after resolution");
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
