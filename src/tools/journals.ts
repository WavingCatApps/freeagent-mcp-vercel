import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse, extractIdFromUrl } from "../services/formatter.js";
import { resourcePath } from "../utils/resource-path.js";

import type {
  ListJournalSetsInput, GetJournalSetInput, GetOpeningBalancesInput,
  CreateJournalSetInput, UpdateJournalSetInput, DeleteJournalSetInput,
} from "../schemas/index.js";

interface JournalSet { url: string; dated_on?: string; description?: string; journal_entries?: unknown[]; }

export async function listJournalSets(client: FreeAgentApiClient, params: ListJournalSetsInput): Promise<string> {
  const response = await client.get<{ journal_sets: JournalSet[] }>("/journal_sets", {
    page: params.page, per_page: params.per_page,
  });
  const items = response.data.journal_sets ?? [];
  return formatResponse({ journal_sets: items }, params.response_format, () => {
    if (!items.length) return "No journal sets found.";
    const lines = ["# Journal Sets", ""];
    for (const j of items) {
      lines.push(`## ${extractIdFromUrl(j.url)} — ${j.dated_on ?? ""}`);
      if (j.description) lines.push(j.description);
      lines.push("");
    }
    return lines.join("\n");
  });
}

export async function getJournalSet(client: FreeAgentApiClient, params: GetJournalSetInput): Promise<string> {
  const response = await client.get<{ journal_set: JournalSet }>(resourcePath(params.journal_set_id, "journal_sets"));
  const j = response.data.journal_set;
  return formatResponse(j, params.response_format, () =>
    `# Journal Set ${extractIdFromUrl(j.url)}\n\n- **Date**: ${j.dated_on}\n- **Description**: ${j.description ?? ""}\n\n\`\`\`json\n${JSON.stringify(j.journal_entries ?? [], null, 2)}\n\`\`\``
  );
}

export async function getOpeningBalances(client: FreeAgentApiClient, params: GetOpeningBalancesInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/journal_sets/opening_balances");
  return formatResponse(response.data, params.response_format, () =>
    `# Opening Balances\n\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``
  );
}

export async function createJournalSet(client: FreeAgentApiClient, params: CreateJournalSetInput): Promise<string> {
  const response = await client.post<{ journal_set: JournalSet }>("/journal_sets", { journal_set: params });
  const j = response.data.journal_set;
  return `✅ Journal set created ${extractIdFromUrl(j.url)}\n**URL**: ${j.url}`;
}

export async function updateJournalSet(client: FreeAgentApiClient, params: UpdateJournalSetInput): Promise<string> {
  const { journal_set_id, ...fields } = params;
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) body[k] = v;
  const response = await client.put<{ journal_set: JournalSet }>(
    resourcePath(journal_set_id, "journal_sets"),
    { journal_set: body }
  );
  return `✅ Journal set updated ${extractIdFromUrl(response.data.journal_set.url)}`;
}

export async function deleteJournalSet(client: FreeAgentApiClient, params: DeleteJournalSetInput): Promise<string> {
  await client.delete(resourcePath(params.journal_set_id, "journal_sets"));
  return `✅ Journal set deleted: ${params.journal_set_id}`;
}
