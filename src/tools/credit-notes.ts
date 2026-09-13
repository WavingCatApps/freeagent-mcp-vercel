import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse, createPaginationMetadata, extractIdFromUrl } from "../services/formatter.js";
import { resourcePath, resourceId } from "../utils/resource-path.js";

import type {
  ListCreditNotesInput,
  GetCreditNoteInput,
  CreateCreditNoteInput,
  UpdateCreditNoteInput,
  DeleteCreditNoteInput,
  TransitionCreditNoteInput,
  SendCreditNoteEmailInput,
  ListCreditNoteReconciliationsInput,
  GetCreditNoteReconciliationInput,
  CreateCreditNoteReconciliationInput,
  UpdateCreditNoteReconciliationInput,
  DeleteCreditNoteReconciliationInput,
} from "../schemas/index.js";

interface CreditNote {
  url: string;
  reference?: string;
  status?: string;
  dated_on?: string;
  currency?: string;
  total_value?: string;
  contact?: string;
}

interface Reconciliation {
  url: string;
  credit_note?: string;
  invoice?: string;
  dated_on?: string;
}

export async function listCreditNotes(client: FreeAgentApiClient, params: ListCreditNotesInput): Promise<string> {
  const q: Record<string, string | number> = { page: params.page, per_page: params.per_page };
  if (params.view) q.view = params.view;
  if (params.contact) q.contact = params.contact;
  if (params.project) q.project = params.project;
  const response = await client.get<{ credit_notes: CreditNote[] }>("/credit_notes", q);
  const items = response.data.credit_notes ?? [];
  const pagination = client.parsePaginationHeaders(response.headers);
  return formatResponse({ credit_notes: items, pagination }, params.response_format, () => {
    const lines = ["# Credit Notes", ""];
    if (pagination.totalCount !== undefined) {
      lines.push(createPaginationMetadata({
        page: params.page,
        perPage: params.per_page,
        totalCount: pagination.totalCount,
        hasMore: pagination.hasMore,
        nextPage: pagination.nextPage,
      }), "");
    }
    if (items.length === 0) return "No credit notes found.";
    for (const cn of items) {
      lines.push(`## ${cn.reference ?? extractIdFromUrl(cn.url)} (${cn.status ?? "unknown"})`);
      lines.push(`- **Date**: ${cn.dated_on ?? ""}`);
      lines.push(`- **Total**: ${cn.currency ?? "GBP"} ${cn.total_value ?? ""}`);
      if (cn.contact) lines.push(`- **Contact**: ${cn.contact}`);
      lines.push("");
    }
    return lines.join("\n");
  });
}

export async function getCreditNote(client: FreeAgentApiClient, params: GetCreditNoteInput): Promise<string> {
  const response = await client.get<{ credit_note: CreditNote }>(resourcePath(params.credit_note_id, "credit_notes"));
  const cn = response.data.credit_note;
  return formatResponse(cn, params.response_format, () =>
    `# Credit Note ${cn.reference ?? extractIdFromUrl(cn.url)}\n\n` +
    `- **Status**: ${cn.status}\n- **Date**: ${cn.dated_on}\n` +
    `- **Total**: ${cn.currency ?? "GBP"} ${cn.total_value}\n` +
    `- **Contact**: ${cn.contact}\n- **URL**: ${cn.url}`
  );
}

export async function createCreditNote(client: FreeAgentApiClient, params: CreateCreditNoteInput): Promise<string> {
  const response = await client.post<{ credit_note: CreditNote }>("/credit_notes", { credit_note: params });
  const cn = response.data.credit_note;
  return `✅ Credit note created ${extractIdFromUrl(cn.url)} (${cn.reference ?? "no ref"})\n` +
    `**Total**: ${cn.currency ?? "GBP"} ${cn.total_value}\n**URL**: ${cn.url}`;
}

export async function updateCreditNote(client: FreeAgentApiClient, params: UpdateCreditNoteInput): Promise<string> {
  const { credit_note_id, ...fields } = params;
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) body[k] = v;
  const response = await client.put<{ credit_note: CreditNote }>(
    resourcePath(credit_note_id, "credit_notes"),
    { credit_note: body }
  );
  return `✅ Credit note updated ${extractIdFromUrl(response.data.credit_note.url)}\n**URL**: ${response.data.credit_note.url}`;
}

export async function deleteCreditNote(client: FreeAgentApiClient, params: DeleteCreditNoteInput): Promise<string> {
  await client.delete(resourcePath(params.credit_note_id, "credit_notes"));
  return `✅ Credit note deleted: ${params.credit_note_id}`;
}

export async function transitionCreditNote(client: FreeAgentApiClient, params: TransitionCreditNoteInput): Promise<string> {
  const id = resourceId(params.credit_note_id);
  const response = await client.put<{ credit_note: CreditNote }>(`/credit_notes/${id}/transitions/${params.action}`);
  const cn = response.data.credit_note;
  return `✅ ${params.action} applied to credit note ${extractIdFromUrl(cn.url)}\n**Status**: ${cn.status}\n**URL**: ${cn.url}`;
}

export async function sendCreditNoteEmail(client: FreeAgentApiClient, params: SendCreditNoteEmailInput): Promise<string> {
  const id = resourceId(params.credit_note_id);
  const email: Record<string, unknown> = {};
  if (params.to) email.to = params.to;
  if (params.cc) email.cc = params.cc;
  if (params.subject) email.subject = params.subject;
  if (params.body) email.body = params.body;
  if (params.from) email.from = params.from;
  await client.post(`/credit_notes/${id}/emails`, { credit_note: { email } });
  return `✅ Credit note email sent for ${params.credit_note_id}`;
}

export async function listCreditNoteReconciliations(
  client: FreeAgentApiClient,
  params: ListCreditNoteReconciliationsInput
): Promise<string> {
  const response = await client.get<{ credit_note_reconciliations: Reconciliation[] }>(
    "/credit_note_reconciliations",
    { page: params.page, per_page: params.per_page }
  );
  const items = response.data.credit_note_reconciliations ?? [];
  return formatResponse({ credit_note_reconciliations: items }, params.response_format, () => {
    if (items.length === 0) return "No credit note reconciliations found.";
    const lines = ["# Credit Note Reconciliations", ""];
    for (const r of items) {
      lines.push(`## ${extractIdFromUrl(r.url)}`);
      lines.push(`- Credit note: ${r.credit_note}`);
      lines.push(`- Invoice: ${r.invoice}`);
      lines.push(`- Date: ${r.dated_on ?? ""}`, "");
    }
    return lines.join("\n");
  });
}

export async function getCreditNoteReconciliation(
  client: FreeAgentApiClient,
  params: GetCreditNoteReconciliationInput
): Promise<string> {
  const response = await client.get<{ credit_note_reconciliation: Reconciliation }>(
    resourcePath(params.credit_note_reconciliation_id, "credit_note_reconciliations")
  );
  const r = response.data.credit_note_reconciliation;
  return formatResponse(r, params.response_format, () =>
    `# Credit Note Reconciliation ${extractIdFromUrl(r.url)}\n\n` +
    `- Credit note: ${r.credit_note}\n- Invoice: ${r.invoice}\n- Date: ${r.dated_on ?? ""}`
  );
}

export async function createCreditNoteReconciliation(
  client: FreeAgentApiClient,
  params: CreateCreditNoteReconciliationInput
): Promise<string> {
  const response = await client.post<{ credit_note_reconciliation: Reconciliation }>(
    "/credit_note_reconciliations",
    { credit_note_reconciliation: params }
  );
  const r = response.data.credit_note_reconciliation;
  return `✅ Reconciliation created ${extractIdFromUrl(r.url)}\n**URL**: ${r.url}`;
}

export async function updateCreditNoteReconciliation(
  client: FreeAgentApiClient,
  params: UpdateCreditNoteReconciliationInput
): Promise<string> {
  const { credit_note_reconciliation_id, ...fields } = params;
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) body[k] = v;
  const response = await client.put<{ credit_note_reconciliation: Reconciliation }>(
    resourcePath(credit_note_reconciliation_id, "credit_note_reconciliations"),
    { credit_note_reconciliation: body }
  );
  return `✅ Reconciliation updated ${extractIdFromUrl(response.data.credit_note_reconciliation.url)}`;
}

export async function deleteCreditNoteReconciliation(
  client: FreeAgentApiClient,
  params: DeleteCreditNoteReconciliationInput
): Promise<string> {
  await client.delete(resourcePath(params.credit_note_reconciliation_id, "credit_note_reconciliations"));
  return `✅ Reconciliation deleted: ${params.credit_note_reconciliation_id}`;
}
