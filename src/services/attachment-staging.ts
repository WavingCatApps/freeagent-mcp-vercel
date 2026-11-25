/**
 * Optional S3-compatible staging for out-of-band receipt uploads.
 *
 * Mirrors the OAuth JWT approach: control-plane state lives in a signed
 * upload_id token (no shared DB). Bytes live briefly in any S3-compatible
 * bucket (R2, MinIO, Backblaze, AWS, …) via env-configured credentials.
 *
 * When staging env vars are unset, prepareUpload is unavailable and tools
 * keep accepting inline base64 `attachment.data` as before.
 */

import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import jwt from "jsonwebtoken";
import { resolveJwtSecret } from "./oauth-jwt.js";

export const FREEAGENT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

const UPLOAD_TOKEN_TYP = "fa_upload";
const DEFAULT_TTL_SECONDS = 900;

export type AttachmentContentType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/gif";

export interface StagingConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  ttlSeconds: number;
  keyPrefix: string;
}

export interface PrepareUploadInput {
  file_name: string;
  content_type: AttachmentContentType;
  size: number;
}

export interface PreparedUpload {
  upload_id: string;
  upload_url: string;
  headers: Record<string, string>;
  expires_at: string;
  expires_in_seconds: number;
  file_name: string;
  content_type: AttachmentContentType;
  size: number;
  method: "PUT";
}

interface UploadTokenPayload {
  typ: typeof UPLOAD_TOKEN_TYP;
  key: string;
  file_name: string;
  content_type: AttachmentContentType;
  size: number;
}

function readStagingConfig(): StagingConfig | null {
  const bucket = process.env.UPLOAD_S3_BUCKET?.trim();
  const accessKeyId = process.env.UPLOAD_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.UPLOAD_S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const ttlRaw = process.env.UPLOAD_STAGING_TTL_SECONDS;
  const ttlParsed = ttlRaw ? Number.parseInt(ttlRaw, 10) : DEFAULT_TTL_SECONDS;
  const ttlSeconds =
    Number.isFinite(ttlParsed) && ttlParsed > 0 ? ttlParsed : DEFAULT_TTL_SECONDS;

  const forcePathStyle =
    process.env.UPLOAD_S3_FORCE_PATH_STYLE === "true" ||
    process.env.UPLOAD_S3_FORCE_PATH_STYLE === "1" ||
    Boolean(process.env.UPLOAD_S3_ENDPOINT?.trim());

  return {
    bucket,
    region: process.env.UPLOAD_S3_REGION?.trim() || "auto",
    endpoint: process.env.UPLOAD_S3_ENDPOINT?.trim() || undefined,
    forcePathStyle,
    accessKeyId,
    secretAccessKey,
    ttlSeconds,
    keyPrefix: (process.env.UPLOAD_S3_KEY_PREFIX?.trim() || "mcp-uploads").replace(
      /\/+$/,
      ""
    ),
  };
}

export function isAttachmentStagingConfigured(): boolean {
  return readStagingConfig() !== null;
}

function createS3Client(config: StagingConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function sanitizeFileName(fileName: string): string {
  const base = fileName.replace(/[/\\]/g, "_").trim() || "attachment";
  return base.slice(0, 200);
}

/**
 * Mint a presigned PUT URL and a signed upload_id JWT for a pending receipt.
 */
export async function prepareAttachmentUpload(
  input: PrepareUploadInput
): Promise<PreparedUpload> {
  const config = readStagingConfig();
  if (!config) {
    throw new Error(
      "Out-of-band attachment staging is not configured. Set UPLOAD_S3_BUCKET, " +
        "UPLOAD_S3_ACCESS_KEY_ID, and UPLOAD_S3_SECRET_ACCESS_KEY (S3-compatible; " +
        "Cloudflare R2 works on free tiers), or pass attachment.data as base64 instead."
    );
  }

  if (input.size <= 0) {
    throw new Error("`size` must be a positive byte count");
  }
  if (input.size > FREEAGENT_ATTACHMENT_MAX_BYTES) {
    throw new Error(
      `File exceeds FreeAgent's ${FREEAGENT_ATTACHMENT_MAX_BYTES} byte (5MB) attachment limit`
    );
  }

  const fileName = sanitizeFileName(input.file_name);
  const key = `${config.keyPrefix}/${randomUUID()}/${fileName}`;
  const expiresIn = Math.min(config.ttlSeconds, 60 * 60);
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const upload_id = jwt.sign(
    {
      typ: UPLOAD_TOKEN_TYP,
      key,
      file_name: fileName,
      content_type: input.content_type,
      size: input.size,
    } satisfies UploadTokenPayload,
    resolveJwtSecret(),
    { expiresIn }
  );

  const client = createS3Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.content_type,
    ContentLength: input.size,
  });
  const upload_url = await getSignedUrl(client, command, { expiresIn });

  return {
    upload_id,
    upload_url,
    headers: {
      "Content-Type": input.content_type,
      "Content-Length": String(input.size),
    },
    expires_at: expiresAt.toISOString(),
    expires_in_seconds: expiresIn,
    file_name: fileName,
    content_type: input.content_type,
    size: input.size,
    method: "PUT",
  };
}

function verifyUploadToken(uploadId: string): UploadTokenPayload {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(uploadId, resolveJwtSecret()) as jwt.JwtPayload;
  } catch {
    throw new Error(
      "Invalid or expired upload_id. Call freeagent_prepare_attachment_upload again and PUT the file before the expiry."
    );
  }

  if (
    decoded.typ !== UPLOAD_TOKEN_TYP ||
    typeof decoded.key !== "string" ||
    typeof decoded.file_name !== "string" ||
    typeof decoded.content_type !== "string" ||
    typeof decoded.size !== "number"
  ) {
    throw new Error("upload_id is not a FreeAgent MCP staging token");
  }

  return {
    typ: UPLOAD_TOKEN_TYP,
    key: decoded.key,
    file_name: decoded.file_name,
    content_type: decoded.content_type as AttachmentContentType,
    size: decoded.size,
  };
}

async function streamToBuffer(
  body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | Blob | undefined
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch staged bytes without consuming the upload. Keep them available for retry
 * until the caller has successfully saved the attachment in FreeAgent.
 */
export async function fetchStagedAttachmentBytes(uploadId: string): Promise<{
  buffer: Buffer;
  file_name: string;
  content_type: AttachmentContentType;
  size: number;
}> {
  const config = readStagingConfig();
  if (!config) {
    throw new Error(
      "upload_id was provided but attachment staging is not configured on this server"
    );
  }

  const token = verifyUploadToken(uploadId);
  const client = createS3Client(config);

  let response;
  try {
    response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: token.key,
      })
    );
  } catch (error) {
    throw new Error(
      `Staged upload not found or not readable. PUT the file to the upload_url from ` +
        `freeagent_prepare_attachment_upload before retrying. ` +
        `(${error instanceof Error ? error.message : "unknown error"})`
    );
  }

  const buffer = await streamToBuffer(response.Body as AsyncIterable<Uint8Array> | undefined);

  if (buffer.length === 0) {
    throw new Error("Staged upload is empty — PUT the file bytes before using upload_id");
  }
  if (buffer.length > FREEAGENT_ATTACHMENT_MAX_BYTES) {
    throw new Error(
      `Staged upload exceeds FreeAgent's ${FREEAGENT_ATTACHMENT_MAX_BYTES} byte (5MB) limit`
    );
  }
  if (buffer.length !== token.size) {
    throw new Error(
      `Staged upload size mismatch: expected ${token.size} bytes, got ${buffer.length}. ` +
        `PUT the exact file advertised in freeagent_prepare_attachment_upload.`
    );
  }

  return {
    buffer,
    file_name: token.file_name,
    content_type: token.content_type,
    size: token.size,
  };
}

/**
 * Best-effort cleanup after FreeAgent confirms the attachment was saved.
 * Cleanup failures must not turn a successful write into a retry/duplicate.
 * Configure a bucket lifecycle rule to remove abandoned or expired uploads.
 */
export async function cleanupStagedAttachment(uploadId: string | undefined): Promise<void> {
  if (!uploadId) return;

  try {
    const config = readStagingConfig();
    if (!config) throw new Error("Attachment staging is not configured");
    const token = verifyUploadToken(uploadId);
    const client = createS3Client(config);
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: token.key,
      })
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        component: "attachment-staging",
        message: "Failed to delete staged upload after FreeAgent save",
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
    );
  }
}
