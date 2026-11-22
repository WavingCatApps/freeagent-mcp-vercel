import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gzipSync } from "zlib";
import { buildAttachmentPayload } from "./attachment-payload.js";

vi.mock("./attachment-staging.js", () => ({
  fetchStagedAttachmentBytes: vi.fn(),
}));

import { fetchStagedAttachmentBytes } from "./attachment-staging.js";

const fetchStaged = vi.mocked(fetchStagedAttachmentBytes);

describe("buildAttachmentPayload", () => {
  beforeEach(() => {
    fetchStaged.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
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
      file_name: "ignored.pdf",
      content_type: "image/png",
    });

    expect(fetchStaged).toHaveBeenCalledWith("signed-token");
    expect(payload.data).toBe(raw.toString("base64"));
    expect(payload.file_name).toBe("staged.pdf");
    expect(payload.content_type).toBe("application/pdf");
  });

  it("rejects both data and upload_id", async () => {
    await expect(
      buildAttachmentPayload({
        data: "abc",
        upload_id: "tok",
        file_name: "a.pdf",
        content_type: "application/pdf",
      })
    ).rejects.toThrow(/not both/);
  });

  it("rejects neither data nor upload_id", async () => {
    await expect(
      buildAttachmentPayload({
        file_name: "a.pdf",
        content_type: "application/pdf",
      })
    ).rejects.toThrow(/requires either data/);
  });

  it("rejects is_gzipped with upload_id", async () => {
    await expect(
      buildAttachmentPayload({
        upload_id: "tok",
        is_gzipped: true,
        file_name: "a.pdf",
        content_type: "application/pdf",
      })
    ).rejects.toThrow(/is_gzipped/);
  });
});
