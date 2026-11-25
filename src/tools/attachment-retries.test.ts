import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { createExpense, updateExpense } from "./expenses.js";
import { createBankTransactionExplanation, updateBankTransactionExplanation } from "./bank-transactions.js";

const { fetchStaged, cleanup } = vi.hoisted(() => ({
  fetchStaged: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("../services/attachment-staging.js", () => ({
  fetchStagedAttachmentBytes: fetchStaged,
  cleanupStagedAttachment: cleanup,
}));

describe("staged receipt retries", () => {
  const attachment = { upload_id: "same-upload" };
  const explanation = {
    url: "https://api.freeagent.com/v2/bank_transaction_explanations/20",
    dated_on: "2026-11-25", gross_value: "-5.00",
  };
  const expense = {
    url: "https://api.freeagent.com/v2/expenses/10",
    dated_on: "2026-11-25", gross_value: "-5.00",
  };
  let post: ReturnType<typeof vi.fn>;
  let put: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  let client: FreeAgentApiClient;

  beforeEach(() => {
    fetchStaged.mockReset();
    cleanup.mockReset();
    fetchStaged.mockResolvedValue({
      buffer: Buffer.from("%PDF receipt"), file_name: "receipt.pdf",
      content_type: "application/pdf", size: 12,
    });
    cleanup.mockResolvedValue(undefined);
    post = vi.fn(); put = vi.fn(); get = vi.fn();
    client = { post, put, get } as unknown as FreeAgentApiClient;
  });

  it.each(["create expense", "update expense", "update explanation"])(
    "retains the upload after a failed %s, then cleans up after a successful retry",
    async (operation) => {
      let save: ReturnType<typeof vi.fn>;
      let run: () => Promise<string>;
      if (operation === "create expense") {
        save = post;
        run = () => createExpense(client, {
          user: "1", category: "269", dated_on: "2026-11-25",
          gross_value: "-5.00", attachment,
        });
      } else if (operation === "update expense") {
        save = put;
        run = () => updateExpense(client, { expense_id: "10", attachment });
      } else {
        save = post;
        get.mockResolvedValue({ data: { bank_transaction_explanation: explanation } });
        run = () => updateBankTransactionExplanation(client, {
          bank_transaction_explanation_id: "20", attachment,
        });
      }
      save.mockRejectedValueOnce(new Error("FreeAgent unavailable"));
      await expect(run()).rejects.toThrow("FreeAgent unavailable");
      expect(cleanup).not.toHaveBeenCalled();
      save.mockImplementationOnce(async () => {
        expect(cleanup).not.toHaveBeenCalled();
        return { data: { expense, attachments: [{ url: "/attachments/1" }] } };
      });
      await expect(run()).resolves.toContain("Successfully");
      expect(fetchStaged).toHaveBeenNthCalledWith(1, "same-upload");
      expect(fetchStaged).toHaveBeenNthCalledWith(2, "same-upload");
      expect(cleanup).toHaveBeenCalledExactlyOnceWith("same-upload");
    }
  );

  it("reports the created explanation ID on receipt failure so retry does not duplicate it", async () => {
    post.mockResolvedValueOnce({ data: { bank_transaction_explanation: explanation } })
      .mockRejectedValueOnce(new Error("FreeAgent unavailable"));
    await expect(createBankTransactionExplanation(client, {
      bank_transaction: "1", dated_on: "2026-11-25", gross_value: "-5.00", attachment,
    })).rejects.toThrow(/Do not create the explanation again.*bank_transaction_explanation_id=20/);
    expect(cleanup).not.toHaveBeenCalled();
    get.mockResolvedValue({ data: { bank_transaction_explanation: explanation } });
    post.mockResolvedValueOnce({ data: { attachments: [{ url: "/attachments/1" }] } });
    await updateBankTransactionExplanation(client, { bank_transaction_explanation_id: "20", attachment });
    expect(post.mock.calls.filter(([url]) => url === "/bank_transaction_explanations")).toHaveLength(1);
    expect(cleanup).toHaveBeenCalledExactlyOnceWith("same-upload");
  });

  it("cleans up a staged receipt after successful explanation creation", async () => {
    post.mockResolvedValueOnce({ data: { bank_transaction_explanation: explanation } })
      .mockImplementationOnce(async () => {
        expect(cleanup).not.toHaveBeenCalled();
        return { data: { attachments: [{ url: "/attachments/1" }] } };
      });
    await createBankTransactionExplanation(client, {
      bank_transaction: "1", dated_on: "2026-11-25", gross_value: "-5.00", attachment,
    });
    expect(cleanup).toHaveBeenCalledExactlyOnceWith("same-upload");
  });

  it("does not create an explanation when the staged upload cannot be read", async () => {
    fetchStaged.mockRejectedValueOnce(new Error("upload expired"));
    await expect(createBankTransactionExplanation(client, {
      bank_transaction: "1", dated_on: "2026-11-25", gross_value: "-5.00", attachment,
    })).rejects.toThrow("upload expired");
    expect(post).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
  });
});
