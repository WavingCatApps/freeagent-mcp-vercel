import { describe, it, expect, vi } from "vitest";

vi.mock("./attachment-payload.js", () => ({
  buildAttachmentPayload: vi.fn(async (input: { file_name?: string; data?: string }) => ({
    data: input.data ?? "YmFzZTY0",
    file_name: input.file_name ?? "file.png",
    content_type: "image/png"
  }))
}));

import {
  explanationAttachmentsPath,
  summarizeExplanationAttachmentRefs,
  addExplanationAttachments,
  listExplanationAttachments,
  publicAttachmentMetadata,
  destroyExplanationAttachments,
  deleteAllExplanationAttachments,
  resolveExplanationAttachmentWrites,
  shapeNestedBankTransactionExplanation,
  MAX_ATTACHMENTS_PER_REQUEST
} from "./explanation-attachments.js";
import type { FreeAgentApiClient } from "./api-client.js";
import type { FreeAgentBankTransactionExplanation } from "../types.js";

function baseExplanation(
  overrides: Partial<FreeAgentBankTransactionExplanation> = {}
): FreeAgentBankTransactionExplanation {
  return {
    url: "https://api.freeagent.com/v2/bank_transaction_explanations/1",
    bank_transaction: "https://api.freeagent.com/v2/bank_transactions/1",
    dated_on: "2026-11-01",
    gross_value: "-12.00",
    ...overrides
  };
}

describe("explanationAttachmentsPath", () => {
  it("builds path from numeric id", () => {
    expect(explanationAttachmentsPath("42")).toBe(
      "/bank_transaction_explanations/42/attachments"
    );
  });

  it("builds path from full URL", () => {
    expect(
      explanationAttachmentsPath(
        "https://api.freeagent.com/v2/bank_transaction_explanations/99"
      )
    ).toBe("/bank_transaction_explanations/99/attachments");
  });
});

describe("summarizeExplanationAttachmentRefs", () => {
  it("uses attachments array under 2026-09-01 shape", () => {
    const summary = summarizeExplanationAttachmentRefs(
      baseExplanation({
        attachments: [
          { url: "https://api.freeagent.com/v2/attachments/3" },
          { url: "https://api.freeagent.com/v2/attachments/4" }
        ]
      })
    );
    expect(summary.has_attachment).toBe(true);
    expect(summary.attachment_count).toBe(2);
    expect(summary.attachments).toEqual([
      { url: "https://api.freeagent.com/v2/attachments/3" },
      { url: "https://api.freeagent.com/v2/attachments/4" }
    ]);
  });

  it("falls back to legacy singular attachment", () => {
    const summary = summarizeExplanationAttachmentRefs(
      baseExplanation({
        attachment: {
          url: "https://api.freeagent.com/v2/attachments/7",
          file_name: "old.pdf"
        }
      })
    );
    expect(summary.has_attachment).toBe(true);
    expect(summary.attachment_count).toBe(1);
    expect(summary.attachments[0]?.url).toContain("/attachments/7");
  });

  it("reports no attachment when empty", () => {
    const summary = summarizeExplanationAttachmentRefs(baseExplanation());
    expect(summary.has_attachment).toBe(false);
    expect(summary.attachment_count).toBe(0);
    expect(summary.attachments).toEqual([]);
  });

  it("prefers attachment_count when provided", () => {
    const summary = summarizeExplanationAttachmentRefs(
      baseExplanation({
        attachment_count: 3,
        attachments: [{ url: "https://api.freeagent.com/v2/attachments/1" }]
      })
    );
    expect(summary.attachment_count).toBe(3);
    expect(summary.has_attachment).toBe(true);
  });
});

describe("addExplanationAttachments / listExplanationAttachments", () => {
  it("POSTs attachments array to the explanation attachments endpoint", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        attachments: [
          {
            url: "https://api.freeagent.com/v2/attachments/9",
            file_name: "receipt.png",
            file_size: 100,
            content_type: "image/png"
          }
        ]
      }
    });
    const client = { post } as unknown as FreeAgentApiClient;

    const result = await addExplanationAttachments(client, "55", [
      {
        data: "abc",
        file_name: "receipt.png",
        content_type: "image/png"
      }
    ]);

    expect(post).toHaveBeenCalledWith(
      "/bank_transaction_explanations/55/attachments",
      {
        attachments: [
          {
            data: "abc",
            file_name: "receipt.png",
            content_type: "image/png"
          }
        ]
      }
    );
    expect(result[0]?.file_name).toBe("receipt.png");
  });

  it("GETs full attachment metadata", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        attachments: [
          {
            url: "https://api.freeagent.com/v2/attachments/3",
            file_name: "a.pdf",
            content_src: "https://s3.example/presigned"
          }
        ]
      }
    });
    const client = { get } as unknown as FreeAgentApiClient;

    const result = await listExplanationAttachments(client, "12");
    expect(get).toHaveBeenCalledWith(
      "/bank_transaction_explanations/12/attachments"
    );
    expect(result).toHaveLength(1);
  });

  it("skips POST when attachments array is empty", async () => {
    const post = vi.fn();
    const client = { post } as unknown as FreeAgentApiClient;
    await expect(addExplanationAttachments(client, "1", [])).resolves.toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });
});

describe("publicAttachmentMetadata", () => {
  it("omits content_src", () => {
    expect(
      publicAttachmentMetadata({
        url: "https://api.freeagent.com/v2/attachments/1",
        file_name: "r.png",
        file_size: 10,
        content_type: "image/png",
        content_src: "https://s3.example/secret"
      })
    ).toEqual({
      url: "https://api.freeagent.com/v2/attachments/1",
      file_name: "r.png",
      file_size: 10,
      content_type: "image/png",
      description: undefined
    });
  });
});

describe("resolveExplanationAttachmentWrites", () => {
  it("merges singular attachment and attachments array", async () => {
    const payloads = await resolveExplanationAttachmentWrites({
      attachment: {
        data: "YQ==",
        file_name: "one.png",
        content_type: "image/png"
      },
      attachments: [
        {
          data: "Yg==",
          file_name: "two.png",
          content_type: "image/png"
        }
      ]
    });
    expect(payloads).toHaveLength(2);
    expect(payloads.map((p) => p.file_name)).toEqual(["two.png", "one.png"]);
  });

  it(`rejects more than ${MAX_ATTACHMENTS_PER_REQUEST} files`, async () => {
    const attachments = Array.from({ length: MAX_ATTACHMENTS_PER_REQUEST + 1 }, (_, i) => ({
      data: "YQ==",
      file_name: `f${i}.png`,
      content_type: "image/png" as const
    }));
    await expect(resolveExplanationAttachmentWrites({ attachments })).rejects.toThrow(
      /At most 10 attachments/
    );
  });
});

describe("destroyExplanationAttachments", () => {
  it("PUTs _destroy with absolute attachment URLs", async () => {
    const put = vi.fn().mockResolvedValue({
      data: { attachments: [] }
    });
    const client = { put } as unknown as FreeAgentApiClient;

    await destroyExplanationAttachments(
      client,
      "https://api.sandbox.freeagent.com/v2/bank_transaction_explanations/5",
      ["9"]
    );

    expect(put).toHaveBeenCalledWith(
      "/bank_transaction_explanations/5/attachments",
      {
        attachments: [
          {
            url: "https://api.sandbox.freeagent.com/v2/attachments/9",
            _destroy: "true"
          }
        ]
      }
    );
  });
});

describe("deleteAllExplanationAttachments", () => {
  it("DELETEs the attachments collection", async () => {
    const del = vi.fn().mockResolvedValue({ data: { attachments: [] } });
    const client = { delete: del } as unknown as FreeAgentApiClient;
    await deleteAllExplanationAttachments(client, "7");
    expect(del).toHaveBeenCalledWith("/bank_transaction_explanations/7/attachments");
  });
});

describe("shapeNestedBankTransactionExplanation", () => {
  it("passes through URL strings", () => {
    expect(
      shapeNestedBankTransactionExplanation(
        "https://api.freeagent.com/v2/bank_transaction_explanations/1"
      )
    ).toEqual({ url: "https://api.freeagent.com/v2/bank_transaction_explanations/1" });
  });

  it("surfaces attachments on nested objects", () => {
    const shaped = shapeNestedBankTransactionExplanation(
      baseExplanation({
        attachments: [{ url: "https://api.freeagent.com/v2/attachments/3" }]
      })
    );
    expect(shaped.has_attachment).toBe(true);
    expect(shaped.attachment_count).toBe(1);
    expect(shaped.attachments).toEqual([
      { url: "https://api.freeagent.com/v2/attachments/3" }
    ]);
  });
});
