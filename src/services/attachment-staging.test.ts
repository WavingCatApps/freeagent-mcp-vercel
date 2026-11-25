import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";

const send = vi.fn();
const getSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = send;
    constructor(_opts: unknown) {}
  }
  return {
    S3Client: FakeS3Client,
    PutObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    DeleteObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrl(...args),
}));

describe("attachment-staging", () => {
  const secret = "test-staging-secret";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    send.mockReset();
    getSignedUrl.mockReset();
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = secret;
    delete process.env.UPLOAD_S3_BUCKET;
    delete process.env.UPLOAD_S3_ACCESS_KEY_ID;
    delete process.env.UPLOAD_S3_SECRET_ACCESS_KEY;
    delete process.env.UPLOAD_S3_ENDPOINT;
    delete process.env.UPLOAD_S3_REGION;
    delete process.env.UPLOAD_STAGING_TTL_SECONDS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function load() {
    return import("./attachment-staging.js");
  }

  it("reports staging disabled without env", async () => {
    const mod = await load();
    expect(mod.isAttachmentStagingConfigured()).toBe(false);
    await expect(
      mod.prepareAttachmentUpload({
        file_name: "r.pdf",
        content_type: "application/pdf",
        size: 10,
      })
    ).rejects.toThrow(/not configured/);
  });

  it("prepares a signed upload when configured", async () => {
    process.env.UPLOAD_S3_BUCKET = "receipts";
    process.env.UPLOAD_S3_ACCESS_KEY_ID = "key";
    process.env.UPLOAD_S3_SECRET_ACCESS_KEY = "secret";
    process.env.UPLOAD_S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.UPLOAD_STAGING_TTL_SECONDS = "600";
    getSignedUrl.mockResolvedValue("https://example.r2.cloudflarestorage.com/put");

    const mod = await load();
    expect(mod.isAttachmentStagingConfigured()).toBe(true);

    const prepared = await mod.prepareAttachmentUpload({
      file_name: "taxi.pdf",
      content_type: "application/pdf",
      size: 42,
    });

    expect(prepared.method).toBe("PUT");
    expect(prepared.upload_url).toContain("https://");
    expect(prepared.headers["Content-Type"]).toBe("application/pdf");
    expect(prepared.headers["Content-Length"]).toBe("42");
    expect(prepared.expires_in_seconds).toBe(600);

    const payload = jwt.verify(prepared.upload_id, secret) as jwt.JwtPayload;
    expect(payload.typ).toBe("fa_upload");
    expect(payload.file_name).toBe("taxi.pdf");
    expect(payload.size).toBe(42);
    expect(typeof payload.key).toBe("string");
  });

  it("retains staged bytes for retries until explicitly cleaned up after save", async () => {
    process.env.UPLOAD_S3_BUCKET = "receipts";
    process.env.UPLOAD_S3_ACCESS_KEY_ID = "key";
    process.env.UPLOAD_S3_SECRET_ACCESS_KEY = "secret";

    const body = Buffer.from("pdf-bytes-here!!");
    const uploadId = jwt.sign(
      {
        typ: "fa_upload",
        key: "mcp-uploads/abc/taxi.pdf",
        file_name: "taxi.pdf",
        content_type: "application/pdf",
        size: body.length,
      },
      secret,
      { expiresIn: "10m" }
    );

    send
      .mockImplementation(async () => ({
        Body: (async function* () {
          yield body;
        })(),
      }));

    const mod = await load();
    const staged = await mod.fetchStagedAttachmentBytes(uploadId);

    expect(staged.buffer.equals(body)).toBe(true);
    expect(staged.file_name).toBe("taxi.pdf");
    expect(send).toHaveBeenCalledTimes(1);
    const retried = await mod.fetchStagedAttachmentBytes(uploadId);
    expect(retried.buffer.equals(body)).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    await mod.cleanupStagedAttachment(uploadId);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2][0].input).toEqual({
      Bucket: "receipts",
      Key: "mcp-uploads/abc/taxi.pdf",
    });
  });

  it("does not fail a saved attachment when cleanup fails", async () => {
    process.env.UPLOAD_S3_BUCKET = "receipts";
    process.env.UPLOAD_S3_ACCESS_KEY_ID = "key";
    process.env.UPLOAD_S3_SECRET_ACCESS_KEY = "secret";
    const uploadId = jwt.sign({
      typ: "fa_upload", key: "mcp-uploads/abc/taxi.pdf",
      file_name: "taxi.pdf", content_type: "application/pdf", size: 10,
    }, secret, { expiresIn: "10m" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    send.mockRejectedValue(new Error("storage unavailable"));
    try {
      const mod = await load();
      await expect(mod.cleanupStagedAttachment(uploadId)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("after FreeAgent save"));
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects size mismatches", async () => {
    process.env.UPLOAD_S3_BUCKET = "receipts";
    process.env.UPLOAD_S3_ACCESS_KEY_ID = "key";
    process.env.UPLOAD_S3_SECRET_ACCESS_KEY = "secret";

    const body = Buffer.from("short");
    const uploadId = jwt.sign(
      {
        typ: "fa_upload",
        key: "mcp-uploads/abc/taxi.pdf",
        file_name: "taxi.pdf",
        content_type: "application/pdf",
        size: 999,
      },
      secret,
      { expiresIn: "10m" }
    );

    send.mockResolvedValueOnce({
      Body: (async function* () {
        yield body;
      })(),
    });

    const mod = await load();
    await expect(mod.fetchStagedAttachmentBytes(uploadId)).rejects.toThrow(/size mismatch/);
  });
});
