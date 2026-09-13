import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse, extractIdFromUrl } from "../services/formatter.js";
import { resourcePath } from "../utils/resource-path.js";

import type { GetAttachmentInput, DeleteAttachmentInput } from "../schemas/index.js";

interface Attachment {
  url: string;
  content_src?: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  description?: string;
}

export async function getAttachment(client: FreeAgentApiClient, params: GetAttachmentInput): Promise<string> {
  const response = await client.get<{ attachment: Attachment }>(resourcePath(params.attachment_id, "attachments"));
  const a = response.data.attachment;
  return formatResponse(a, params.response_format, () =>
    `# Attachment ${a.file_name ?? extractIdFromUrl(a.url)}\n\n` +
    `- **Content type**: ${a.content_type ?? ""}\n` +
    `- **Size**: ${a.file_size ?? "?"}\n` +
    `- **Download URL**: ${a.content_src ?? a.url}\n` +
    (a.description ? `- **Description**: ${a.description}\n` : "") +
    `\nNote: binary file bytes are not inlined; use the download URL from a non-agent context if needed.`
  );
}

export async function deleteAttachment(client: FreeAgentApiClient, params: DeleteAttachmentInput): Promise<string> {
  await client.delete(resourcePath(params.attachment_id, "attachments"));
  return `✅ Attachment deleted: ${params.attachment_id}`;
}
