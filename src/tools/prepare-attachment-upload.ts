/**
 * Prepare an out-of-band receipt upload (S3-compatible staging).
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { PrepareAttachmentUploadInput } from "../schemas/index.js";
import { ResponseFormat } from "../constants.js";
import { formatResponse } from "../services/formatter.js";
import {
  isAttachmentStagingConfigured,
  prepareAttachmentUpload,
} from "../services/attachment-staging.js";

export async function prepareAttachmentUploadTool(
  _client: FreeAgentApiClient,
  params: PrepareAttachmentUploadInput
): Promise<string> {
  if (!isAttachmentStagingConfigured()) {
    return (
      "❌ Out-of-band attachment staging is not configured on this server.\n\n" +
      "Set these environment variables to an S3-compatible store (Cloudflare R2, MinIO, " +
      "Backblaze B2, AWS S3, etc.):\n" +
      "- `UPLOAD_S3_BUCKET`\n" +
      "- `UPLOAD_S3_ACCESS_KEY_ID`\n" +
      "- `UPLOAD_S3_SECRET_ACCESS_KEY`\n" +
      "- `UPLOAD_S3_ENDPOINT` (required for R2/MinIO; omit for AWS)\n" +
      "- `UPLOAD_S3_REGION` (default `auto`)\n\n" +
      "Until then, pass `attachment.data` as base64 (optionally gzip + `is_gzipped=true`)."
    );
  }

  const prepared = await prepareAttachmentUpload({
    file_name: params.file_name,
    content_type: params.content_type,
    size: params.size,
  });

  return formatResponse(prepared, params.response_format ?? ResponseFormat.MARKDOWN, () => {
    return (
      `# Attachment upload ready\n\n` +
      `1. **PUT** the raw file bytes to the URL below (not base64).\n` +
      `2. Send the same \`Content-Type\` and \`Content-Length\` headers.\n` +
      `3. Call create/update expense or explanation with ` +
      `\`attachment: { upload_id, file_name, content_type }\` — **do not** pass \`data\`.\n\n` +
      `- **Method**: \`${prepared.method}\`\n` +
      `- **Upload URL**: \`${prepared.upload_url}\`\n` +
      `- **upload_id**: \`${prepared.upload_id}\`\n` +
      `- **Expires**: ${prepared.expires_at} (${prepared.expires_in_seconds}s)\n` +
      `- **File**: ${prepared.file_name} (${prepared.content_type}, ${prepared.size} bytes)\n` +
      `- **Headers**: \`Content-Type: ${prepared.headers["Content-Type"]}\`, ` +
      `\`Content-Length: ${prepared.headers["Content-Length"]}\`\n\n` +
      `The model should not emit file bytes. The MCP host (or a local skill) should PUT them.`
    );
  });
}
