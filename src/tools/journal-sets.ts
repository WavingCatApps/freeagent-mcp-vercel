/**
 * Journal set tools (fork addition).
 *
 * FreeAgent models journalled corrections as balanced "sets" of entries all
 * dated the same day. Primary use case for this fork: Isle of Man companies
 * where Corporation Tax is 0% and the CT balance is zeroed by journal each
 * year, plus other manual-jurisdiction adjustments FreeAgent's UK automation
 * does not produce.
 *
 * Sign convention throughout: debit_value positive = debit, negative = credit.
 * A set must sum to zero to be valid; the schema enforces this client-side on
 * create so failures are caught before the API round trip.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type {
  ListJournalSetsInput,
  GetJournalSetInput,
  CreateJournalSetInput,
  UpdateJournalSetInput,
  DeleteJournalSetInput,
} from "../schemas/index.js";
import { extractIdFromUrl } from "../services/formatter.js";
import { resolveCategory, resolveUser } from "../services/resolvers.js";

interface JournalEntry {
  url?: string;
  category?: string;
  description?: string;
  debit_value: string | number;
  user?: string;
}

interface JournalSet {
  url: string;
  dated_on?: string;
  description: string;
  updated_at?: string;
  tag?: string;
  journal_entries: JournalEntry[];
}

function idOrUrlToId(idOrUrl: string): string {
  return idOrUrl.startsWith("http") ? extractIdFromUrl(idOrUrl) : idOrUrl;
}

function formatSet(set: JournalSet): string {
  const lines = [
    `## Journal Set ${extractIdFromUrl(set.url)}`,
    `- **Date**: ${set.dated_on ?? "(opening balances)"}`,
    `- **Description**: ${set.description}`,
  ];
  if (set.tag) lines.push(`- **Tag**: ${set.tag} (API-only: not editable in the web UI)`);
  lines.push(`- **URL**: ${set.url}`, "", "| Entry | Category | Debit (+) / Credit (-) | Description |", "|---|---|---|---|");
  for (const e of set.journal_entries ?? []) {
    lines.push(
      `| ${e.url ? extractIdFromUrl(e.url) : "-"} | ${e.category ?? "-"} | ${e.debit_value} | ${e.description ?? ""} |`
    );
  }
  return lines.join("\n");
}

export async function listJournalSets(
  client: FreeAgentApiClient,
  params: ListJournalSetsInput
): Promise<string> {
  const query: Record<string, string> = {};
  if (params.from_date) query.from_date = params.from_date;
  if (params.to_date) query.to_date = params.to_date;
  if (params.tag) query.tag = params.tag;

  const response = await client.get<{ journal_sets: JournalSet[] }>(
    "/journal_sets",
    query
  );
  const sets = response.data.journal_sets ?? [];

  if (params.response_format === "json") return JSON.stringify(sets, null, 2);
  if (sets.length === 0) return "No journal sets found for the given filters.";
  return `# Journal Sets (${sets.length})\n\n` + sets.map(formatSet).join("\n\n");
}

export async function getJournalSet(
  client: FreeAgentApiClient,
  params: GetJournalSetInput
): Promise<string> {
  const id = idOrUrlToId(params.journal_set_id);
  const response = await client.get<{ journal_set: JournalSet }>(
    `/journal_sets/${id}`
  );
  if (params.response_format === "json")
    return JSON.stringify(response.data.journal_set, null, 2);
  return formatSet(response.data.journal_set);
}

async function resolveEntry(
  client: FreeAgentApiClient,
  entry: { category?: string; debit_value?: number; description?: string; user?: string }
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (entry.category !== undefined) out.category = await resolveCategory(client, entry.category);
  if (entry.debit_value !== undefined) out.debit_value = entry.debit_value.toFixed(2);
  if (entry.description !== undefined) out.description = entry.description;
  if (entry.user !== undefined) out.user = await resolveUser(client, entry.user);
  return out;
}

export async function createJournalSet(
  client: FreeAgentApiClient,
  params: CreateJournalSetInput
): Promise<string> {
  const entries = [];
  for (const e of params.journal_entries) {
    entries.push(await resolveEntry(client, e));
  }

  const payload: Record<string, unknown> = {
    dated_on: params.dated_on,
    description: params.description,
    journal_entries: entries,
  };
  if (params.tag) payload.tag = params.tag;

  const response = await client.post<{ journal_set: JournalSet }>(
    "/journal_sets",
    { journal_set: payload }
  );

  const set = response.data.journal_set;
  return `✅ Created journal set ${extractIdFromUrl(set.url)}\n\n${formatSet(set)}`;
}

export async function updateJournalSet(
  client: FreeAgentApiClient,
  params: UpdateJournalSetInput
): Promise<string> {
  const id = idOrUrlToId(params.journal_set_id);

  const payload: Record<string, unknown> = {};
  if (params.dated_on) payload.dated_on = params.dated_on;
  if (params.description) payload.description = params.description;
  if (params.journal_entries) {
    const entries = [];
    for (const e of params.journal_entries) {
      if (e.url && e._destroy) {
        entries.push({ url: e.url, _destroy: true });
        continue;
      }
      const resolved = await resolveEntry(client, e);
      if (e.url) resolved.url = e.url;
      entries.push(resolved);
    }
    payload.journal_entries = entries;
  }

  await client.put<{ journal_set: JournalSet }>(`/journal_sets/${id}`, {
    journal_set: payload,
  });

  // Re-read for an authoritative post-update view (PUT responses can be sparse).
  const fresh = await client.get<{ journal_set: JournalSet }>(
    `/journal_sets/${id}`
  );
  return `✅ Updated journal set ${id}\n\n${formatSet(fresh.data.journal_set)}`;
}

export async function deleteJournalSet(
  client: FreeAgentApiClient,
  params: DeleteJournalSetInput
): Promise<string> {
  const id = idOrUrlToId(params.journal_set_id);

  // Capture what is being deleted for the audit trail before it goes.
  const before = await client.get<{ journal_set: JournalSet }>(
    `/journal_sets/${id}`
  );
  await client.delete(`/journal_sets/${id}`);

  return (
    `🗑️ Deleted journal set ${id}. Record of what was removed:\n\n` +
    formatSet(before.data.journal_set)
  );
}
