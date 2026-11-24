import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBankTransactionExplanation,
  updateBankTransactionExplanation,
  listBankTransactionExplanations,
  listBankTransactionExplanationAttachments
} from "./bank-transactions.js";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { ResponseFormat } from "../constants.js";

vi.mock("../services/attachment-payload.js", () => ({
  buildAttachmentPayload: vi.fn(async () => ({
    data: "YmFzZTY0",
    file_name: "receipt.png",
    content_type: "image/png"
  }))
}));

describe("bank transaction explanation attachments (2026-09-01)", () => {
  let post: ReturnType<typeof vi.fn>;
  let put: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;
  let client: FreeAgentApiClient;

  beforeEach(() => {
    post = vi.fn();
    put = vi.fn();
    get = vi.fn();
    client = { post, put, get, parsePaginationHeaders: () => ({}) } as unknown as FreeAgentApiClient;
  });

  it("create posts explanation then POSTs attachment to /attachments", async () => {
    post
      .mockResolvedValueOnce({
        data: {
          bank_transaction_explanation: {
            url: "https://api.freeagent.com/v2/bank_transaction_explanations/10",
            dated_on: "2026-11-01",
            gross_value: "-5.00",
            description: "Taxi"
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          attachments: [
            {
              url: "https://api.freeagent.com/v2/attachments/1",
              file_name: "receipt.png"
            }
          ]
        }
      });

    const result = await createBankTransactionExplanation(client, {
      bank_transaction: "https://api.freeagent.com/v2/bank_transactions/1",
      dated_on: "2026-11-01",
      gross_value: "-5.00",
      description: "Taxi",
      attachment: {
        data: "YmFzZTY0",
        file_name: "receipt.png",
        content_type: "image/png"
      }
    });

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0]).toBe("/bank_transaction_explanations");
    expect(post.mock.calls[0][1].bank_transaction_explanation.attachment).toBeUndefined();
    expect(post.mock.calls[1][0]).toBe(
      "/bank_transaction_explanations/10/attachments"
    );
    expect(post.mock.calls[1][1]).toEqual({
      attachments: [
        {
          data: "YmFzZTY0",
          file_name: "receipt.png",
          content_type: "image/png"
        }
      ]
    });
    expect(result).toContain("with attachment");
  });

  it("create posts multiple attachments in one Attachments API call", async () => {
    post
      .mockResolvedValueOnce({
        data: {
          bank_transaction_explanation: {
            url: "https://api.freeagent.com/v2/bank_transaction_explanations/11",
            dated_on: "2026-11-01",
            gross_value: "-8.00"
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          attachments: [
            { url: "https://api.freeagent.com/v2/attachments/1", file_name: "receipt.png" },
            { url: "https://api.freeagent.com/v2/attachments/2", file_name: "receipt.png" }
          ]
        }
      });

    const result = await createBankTransactionExplanation(client, {
      bank_transaction: "https://api.freeagent.com/v2/bank_transactions/1",
      dated_on: "2026-11-01",
      gross_value: "-8.00",
      attachments: [
        {
          data: "YmFzZTY0",
          file_name: "a.png",
          content_type: "image/png"
        },
        {
          data: "YmFzZTY0",
          file_name: "b.png",
          content_type: "image/png"
        }
      ]
    });

    expect(post.mock.calls[1][1].attachments).toHaveLength(2);
    expect(result).toContain("with 2 attachments");
  });

  it("update with only attachment skips PUT body fields and POSTs to /attachments", async () => {
    get.mockResolvedValueOnce({
      data: {
        bank_transaction_explanation: {
          url: "https://api.freeagent.com/v2/bank_transaction_explanations/20",
          dated_on: "2026-11-02",
          gross_value: "-9.00",
          description: "Lunch"
        }
      }
    });
    post.mockResolvedValueOnce({
      data: {
        attachments: [
          { url: "https://api.freeagent.com/v2/attachments/2", file_name: "receipt.png" }
        ]
      }
    });

    const result = await updateBankTransactionExplanation(client, {
      bank_transaction_explanation_id: "20",
      attachment: {
        data: "YmFzZTY0",
        file_name: "receipt.png",
        content_type: "image/png"
      }
    });

    expect(put).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith(
      "/bank_transaction_explanations/20/attachments",
      expect.objectContaining({ attachments: expect.any(Array) })
    );
    expect(result).toContain("Attachments now");
  });

  it("list uses attachments[] for has_attachment", async () => {
    get.mockResolvedValueOnce({
      data: {
        bank_transaction_explanations: [
          {
            url: "https://api.freeagent.com/v2/bank_transaction_explanations/1",
            dated_on: "2026-11-01",
            gross_value: "-1.00",
            description: "With file",
            bank_transaction: "https://api.freeagent.com/v2/bank_transactions/1",
            attachments: [{ url: "https://api.freeagent.com/v2/attachments/3" }]
          },
          {
            url: "https://api.freeagent.com/v2/bank_transaction_explanations/2",
            dated_on: "2026-11-02",
            gross_value: "-2.00",
            description: "No file",
            bank_transaction: "https://api.freeagent.com/v2/bank_transactions/2",
            attachments: []
          }
        ]
      },
      headers: {}
    });

    const result = await listBankTransactionExplanations(client, {
      page: 1,
      per_page: 25,
      response_format: ResponseFormat.JSON
    });
    const parsed = JSON.parse(result) as {
      explanations: Array<{ has_attachment: boolean; attachment_count: number }>;
    };
    expect(parsed.explanations[0]?.has_attachment).toBe(true);
    expect(parsed.explanations[0]?.attachment_count).toBe(1);
    expect(parsed.explanations[1]?.has_attachment).toBe(false);
  });

  it("listBankTransactionExplanationAttachments returns metadata", async () => {
    get.mockResolvedValueOnce({
      data: {
        attachments: [
          {
            url: "https://api.freeagent.com/v2/attachments/3",
            file_name: "a.png",
            file_size: 12,
            content_type: "image/png",
            content_src: "https://s3.example/x"
          }
        ]
      }
    });

    const result = await listBankTransactionExplanationAttachments(client, {
      bank_transaction_explanation_id: "3",
      response_format: ResponseFormat.JSON
    });
    const parsed = JSON.parse(result) as {
      attachments: Array<{ file_name?: string; content_src?: string }>;
    };
    expect(parsed.attachments[0]?.file_name).toBe("a.png");
    expect(parsed.attachments[0]?.content_src).toBeUndefined();
  });
});
