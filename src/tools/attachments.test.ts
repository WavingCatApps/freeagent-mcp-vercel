import { describe, it, expect, vi } from "vitest";
import { deleteAttachment, deleteAllBankTransactionExplanationAttachments } from "./attachments.js";
import type { FreeAgentApiClient } from "../services/api-client.js";

vi.mock("../services/explanation-attachments.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/explanation-attachments.js")>();
  return {
    ...actual,
    destroyExplanationAttachments: vi.fn(async () => [
      { url: "https://api.freeagent.com/v2/attachments/2", file_name: "kept.png" }
    ]),
    deleteAllExplanationAttachments: vi.fn(async () => undefined)
  };
});

import {
  destroyExplanationAttachments,
  deleteAllExplanationAttachments
} from "../services/explanation-attachments.js";

describe("deleteAttachment", () => {
  it("uses Explanation Attachments API when explanation id is provided", async () => {
    const client = { delete: vi.fn() } as unknown as FreeAgentApiClient;
    const result = await deleteAttachment(client, {
      attachment_id: "3",
      bank_transaction_explanation_id: "10"
    });
    expect(destroyExplanationAttachments).toHaveBeenCalledWith(client, "10", ["3"]);
    expect(client.delete).not.toHaveBeenCalled();
    expect(result).toContain("Attachments remaining**: 1");
  });

  it("falls back to DELETE /attachments/:id without explanation id", async () => {
    const del = vi.fn().mockResolvedValue({});
    const client = { delete: del } as unknown as FreeAgentApiClient;
    const result = await deleteAttachment(client, { attachment_id: "3" });
    expect(del).toHaveBeenCalledWith("/attachments/3");
    expect(result).toContain("Attachment deleted: 3");
  });
});

describe("deleteAllBankTransactionExplanationAttachments", () => {
  it("clears the collection", async () => {
    const client = {} as FreeAgentApiClient;
    const result = await deleteAllBankTransactionExplanationAttachments(client, {
      bank_transaction_explanation_id: "10"
    });
    expect(deleteAllExplanationAttachments).toHaveBeenCalledWith(client, "10");
    expect(result).toContain("All attachments deleted");
  });
});
