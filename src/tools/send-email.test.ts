import { describe, it, expect, vi } from "vitest";
import type { FreeAgentApiClient } from "../services/api-client.js";
import { sendInvoiceEmail } from "./invoices.js";
import { sendEstimateEmail } from "./estimates.js";
import { sendCreditNoteEmail } from "./credit-notes.js";

function makeClient(): { client: FreeAgentApiClient; calls: { path: string; body?: unknown }[] } {
  const calls: { path: string; body?: unknown }[] = [];
  const client = {
    post: vi.fn(async (path: string, body?: unknown) => {
      calls.push({ path, body });
      return { data: {}, headers: {} };
    }),
  } as unknown as FreeAgentApiClient;
  return { client, calls };
}

const email = {
  to: "customer@example.com",
  from: "Jane Doe <jane@example.com>",
  subject: "Invoice 990",
  body: "Hi",
};

// FreeAgent's endpoint is POST /v2/<resource>/:id/send_email; /emails returns 404.
describe("send email tools", () => {
  it("posts an invoice email to /invoices/:id/send_email", async () => {
    const { client, calls } = makeClient();
    await sendInvoiceEmail(client, { invoice_id: "https://api.freeagent.com/v2/invoices/990", ...email });
    expect(calls).toEqual([{ path: "/invoices/990/send_email", body: { invoice: { email } } }]);
  });

  it("posts an estimate email to /estimates/:id/send_email", async () => {
    const { client, calls } = makeClient();
    await sendEstimateEmail(client, { estimate_id: "12", ...email });
    expect(calls).toEqual([{ path: "/estimates/12/send_email", body: { estimate: { email } } }]);
  });

  it("posts a credit note email to /credit_notes/:id/send_email", async () => {
    const { client, calls } = makeClient();
    await sendCreditNoteEmail(client, { credit_note_id: "34", ...email });
    expect(calls).toEqual([{ path: "/credit_notes/34/send_email", body: { credit_note: { email } } }]);
  });
});
