import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { ResponseFormat } from "../constants.js";

vi.mock("../services/attachment-staging.js", () => ({
  isAttachmentStagingConfigured: vi.fn(),
  prepareAttachmentUpload: vi.fn(),
}));

import {
  isAttachmentStagingConfigured,
  prepareAttachmentUpload,
} from "../services/attachment-staging.js";
import { prepareAttachmentUploadTool } from "./prepare-attachment-upload.js";

const isConfigured = vi.mocked(isAttachmentStagingConfigured);
const prepare = vi.mocked(prepareAttachmentUpload);

describe("prepareAttachmentUploadTool", () => {
  beforeEach(() => {
    isConfigured.mockReset();
    prepare.mockReset();
  });

  it("explains how to configure staging when unset", async () => {
    isConfigured.mockReturnValue(false);
    const text = await prepareAttachmentUploadTool({} as FreeAgentApiClient, {
      file_name: "r.pdf",
      content_type: "application/pdf",
      size: 10,
      response_format: ResponseFormat.MARKDOWN,
    });
    expect(text).toContain("not configured");
    expect(text).toContain("UPLOAD_S3_BUCKET");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("returns upload instructions when configured", async () => {
    isConfigured.mockReturnValue(true);
    prepare.mockResolvedValue({
      upload_id: "tok",
      upload_url: "https://upload.example/put",
      headers: { "Content-Type": "application/pdf", "Content-Length": "10" },
      expires_at: "2026-11-22T12:00:00.000Z",
      expires_in_seconds: 900,
      file_name: "r.pdf",
      content_type: "application/pdf",
      size: 10,
      method: "PUT",
    });

    const text = await prepareAttachmentUploadTool({} as FreeAgentApiClient, {
      file_name: "r.pdf",
      content_type: "application/pdf",
      size: 10,
      response_format: ResponseFormat.MARKDOWN,
    });

    expect(text).toContain("upload_id");
    expect(text).toContain("https://upload.example/put");
    expect(text).toContain("PUT");
  });
});
