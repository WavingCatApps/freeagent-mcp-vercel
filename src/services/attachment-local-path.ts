/**
 * Confined local-path attachment reads for stdio / single-machine MCP.
 *
 * The model passes a short path string; this process reads the bytes and
 * base64-encodes them for FreeAgent. FREEAGENT_ATTACHMENTS_DIR is mandatory
 * and default-deny: without it, path attachments are refused.
 *
 * Remote hosts (e.g. Vercel) cannot see the user's laptop disk — use
 * upload_id staging or inline data there instead.
 */

import { constants } from "node:fs";
import { open, realpath, type FileHandle } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  FREEAGENT_ATTACHMENT_MAX_BYTES,
  type AttachmentContentType,
} from "./attachment-staging.js";

const CONTENT_TYPES: Readonly<Record<string, AttachmentContentType>> = Object.freeze({
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
});

export function isLocalAttachmentPathConfigured(): boolean {
  const dir = process.env.FREEAGENT_ATTACHMENTS_DIR?.trim();
  return Boolean(dir);
}

function outsideRootError(): Error {
  return new Error(
    "Attachment path is outside FREEAGENT_ATTACHMENTS_DIR and was not read"
  );
}

/** True when child is inside parent (both should be absolute / realpath'd). */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(".." + path.sep) &&
    !path.isAbsolute(rel)
  );
}

function contentTypeFor(filePath: string): AttachmentContentType {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    const supported = Object.keys(CONTENT_TYPES).sort().join(", ");
    throw new Error(
      `Unsupported attachment type "${ext || "(none)"}". Supported: ${supported}`
    );
  }
  return contentType;
}

async function resolveAttachmentsRoot(): Promise<{ confineTo: string; root: string }> {
  const confineTo = process.env.FREEAGENT_ATTACHMENTS_DIR?.trim();
  if (!confineTo) {
    throw new Error(
      "Path attachments require FREEAGENT_ATTACHMENTS_DIR (a dedicated receipts folder). " +
        "Without it, use attachment.data (base64) or freeagent_prepare_attachment_upload."
    );
  }

  let root: string;
  try {
    root = await realpath(confineTo);
  } catch {
    throw new Error("FREEAGENT_ATTACHMENTS_DIR is set to a path that does not exist");
  }

  const home = await realpath(homedir()).catch(() => path.resolve(homedir()));
  if (root === path.parse(root).root || root === home || isInside(root, home)) {
    throw new Error(
      "FREEAGENT_ATTACHMENTS_DIR must be a dedicated receipts directory, not the " +
        "filesystem root, your home directory, or a folder that contains your home"
    );
  }

  return { confineTo, root };
}

export interface LocalAttachmentBytes {
  buffer: Buffer;
  file_name: string;
  content_type: AttachmentContentType;
}

/**
 * Read a file under FREEAGENT_ATTACHMENTS_DIR for FreeAgent attachment upload.
 */
export async function readLocalAttachment(inputPath: string): Promise<LocalAttachmentBytes> {
  if (!inputPath || inputPath.trim() === "") {
    throw new Error("Attachment path must not be empty");
  }

  const { confineTo, root } = await resolveAttachmentsRoot();

  // Lexical checks before touching the path (avoid existence probes).
  const lexical = path.resolve(inputPath);
  if (!isInside(path.resolve(confineTo), lexical) && !isInside(root, lexical)) {
    throw outsideRootError();
  }
  contentTypeFor(lexical);

  let resolved: string;
  try {
    resolved = await realpath(inputPath);
  } catch {
    throw new Error(`Attachment not found: ${path.basename(inputPath)}`);
  }
  if (!isInside(root, resolved)) {
    throw outsideRootError();
  }

  const contentType = contentTypeFor(resolved);

  let handle: FileHandle;
  try {
    handle = await open(
      resolved,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)
    );
  } catch {
    throw new Error(`Attachment could not be opened: ${path.basename(inputPath)}`);
  }

  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      throw new Error(`Attachment is not a regular file: ${path.basename(inputPath)}`);
    }
    if (info.nlink > 1) {
      throw new Error(
        `Attachment has more than one hard link and was not read: ${path.basename(inputPath)}`
      );
    }
    if (info.size === 0) {
      throw new Error(`Attachment is empty: ${path.basename(inputPath)}`);
    }
    if (info.size > FREEAGENT_ATTACHMENT_MAX_BYTES) {
      throw new Error(
        `Attachment exceeds FreeAgent's ${FREEAGENT_ATTACHMENT_MAX_BYTES} byte (5MB) limit`
      );
    }

    const buffer = Buffer.alloc(FREEAGENT_ATTACHMENT_MAX_BYTES + 1);
    let filled = 0;
    while (filled < buffer.length) {
      const { bytesRead } = await handle.read(buffer, filled, buffer.length - filled, filled);
      if (bytesRead === 0) break;
      filled += bytesRead;
    }
    if (filled > FREEAGENT_ATTACHMENT_MAX_BYTES) {
      throw new Error(
        `Attachment grew past FreeAgent's ${FREEAGENT_ATTACHMENT_MAX_BYTES} byte (5MB) limit while reading`
      );
    }

    return {
      buffer: buffer.subarray(0, filled),
      file_name: path.basename(resolved),
      content_type: contentType,
    };
  } finally {
    await handle.close();
  }
}
