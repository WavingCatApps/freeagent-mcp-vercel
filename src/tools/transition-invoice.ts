/**
 * Transition a FreeAgent invoice between lifecycle states.
 *
 * Wraps PUT /v2/invoices/:id/transitions/:action with no request body.
 * Supported actions mirror FreeAgent's UI: mark_as_sent, mark_as_cancelled,
 * mark_as_draft, mark_as_scheduled, convert_to_credit_note.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentInvoice } from "../types.js";
import type { TransitionInvoiceInput } from "../schemas/index.js";
import { extractIdFromUrl } from "../services/formatter.js";

export async function transitionInvoice(
  client: FreeAgentApiClient,
  params: TransitionInvoiceInput
): Promise<string> {
  const id = params.invoice_id.startsWith("http")
    ? extractIdFromUrl(params.invoice_id)
    : params.invoice_id;

  const path = `/invoices/${id}/transitions/${params.action}`;
  const response = await client.put<{ invoice: FreeAgentInvoice }>(path);
  const invoice = response.data.invoice;

  return (
    `✅ ${params.action} applied to invoice ${extractIdFromUrl(invoice.url)}\n\n` +
    `**Status**: ${invoice.status}\n` +
    `**Date**: ${invoice.dated_on}\n` +
    `**Total**: ${invoice.currency} ${invoice.total_value}\n` +
    `**URL**: ${invoice.url}`
  );
}
