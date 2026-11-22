import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gzipSync } from "zlib";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildAttachmentPayload } from "./attachment-payload.js";

vi.mock("./attachment-staging.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./attachment-staging.js")>();
  return {
    ...actual,
    fetchStagedAttachmentBytes: vi.fn(),
  };
});

import { fetchStagedAttachmentBytes } from "./attachment-staging.js";

const fetchStaged = vi.mocked(fetchStagedAttachmentBytes);

describe("buildAttachmentPayload", () => {
  const originalEnv = { ...process.env };
  let root: string;

  beforeEach(async () => {
    fetchStaged.mockReset();
    process.env = { ...originalEnv };
    root = await mkdtemp(path.join(tmpdir(), "fa-payload-"));
    process.env.FREEAGENT_ATTACHMENTS_DIR = root;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("accepts inline base64 data", async () => {
    const raw = Buffer.from("hello-receipt");
    const payload = await buildAttachmentPayload({
      data: raw.toString("base64"),
      file_name: "receipt.pdf",
      content_type: "application/pdf",
      description: "Taxi",
    });

    expect(payload).toEqual({
      data: raw.toString("base64"),
      file_name: "receipt.pdf",
      content_type: "application/pdf",
      description: "Taxi",
    });
    expect(fetchStaged).not.toHaveBeenCalled();
  });

  it("decompresses gzipped inline data", async () => {
    const raw = Buffer.from("compressible-receipt-bytes");
    const gzipped = gzipSync(raw).toString("base64");

    const payload = await buildAttachmentPayload({
      data: gzipped,
      is_gzipped: true,
      file_name: "receipt.pdf",
      content_type: "application/pdf",
    });

    expect(payload.data).toBe(raw.toString("base64"));
  });

  it("resolves upload_id via staging", async () => {
    const raw = Buffer.from("%PDF-1.4 staged");
    fetchStaged.mockResolvedValue({
      buffer: raw,
      file_name: "staged.pdf",
      content_type: "application/pdf",
      size: raw.length,
    });

    const payload = await buildAttachmentPayload({
      upload_id: "signed-token",
    });

    expect(fetchStaged).toHaveBeenCalledWith("signed-token");
    expect(payload.data).toBe(raw.toString("base64"));
    expect(payload.file_name).toBe("staged.pdf");
    expect(payload.content_type).toBe("application/pdf");
  });

  it("reads a local path under FREEAGENT_ATTACHMENTS_DIR", async () => {
    const file = path.join(root, "local.pdf");
    const raw = Buffer.from("%PDF-1.4 local");
    await writeFile(file, raw);

    const payload = await buildAttachmentPayload({ path: file });
    expect(payload.data).toBe(raw.toString("base64"));
    expect(payload.file_name).toBe("local.pdf");
    expect(payload.content_type).toBe("application/pdf");
  });

  it("rejects multiple sources", async () => {
    await expect(
      buildAttachmentPayload({
        data: "abc",
        upload_id: "tok",
        file_name: "a.pdf",
        content_type: "application/pdf",
      })
    ).rejects.toThrow(/exactly one/);
  });

  it("rejects neither source", async () => {
    await expect(
      buildAttachmentPayload({
        file_name: "a.pdf",
        content_type: "application/pdf",
      })
    ).rejects.toThrow(/requires one of/);
  });

  it("rejects is_gzipped with upload_id", async () => {
    await expect(
      buildAttachmentPayload({
        upload_id: "tok",
        is_gzipped: true,
      })
    ).rejects.toThrow(/is_gzipped/);
  });

  it("rejects is_gzipped with path", async () => {
    const file = path.join(root, "x.pdf");
    await writeFile(file, Buffer.from("%PDF"));
    await expect(
      buildAttachmentPayload({
        path: file,
        is_gzipped: true,
      })
    ).rejects.toThrow(/is_gzipped/);
  });
});
