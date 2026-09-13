import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse, extractIdFromUrl } from "../services/formatter.js";
import { resourcePath } from "../utils/resource-path.js";

import type {
  ListNotesInput, GetNoteInput, CreateNoteInput, UpdateNoteInput, DeleteNoteInput,
} from "../schemas/index.js";

interface Note { url: string; note?: string; parent_url?: string; author?: string; }

export async function listNotes(client: FreeAgentApiClient, params: ListNotesInput): Promise<string> {
  const q: Record<string, string> = {};
  if (params.contact) q.contact = params.contact;
  if (params.project) q.project = params.project;
  const response = await client.get<{ notes: Note[] }>("/notes", q);
  const notes = response.data.notes ?? [];
  return formatResponse({ notes }, params.response_format, () => {
    if (!notes.length) return "No notes found.";
    const lines = ["# Notes", ""];
    for (const n of notes) {
      lines.push(`## ${extractIdFromUrl(n.url)}`);
      lines.push(n.note ?? "");
      if (n.parent_url) lines.push(`- Parent: ${n.parent_url}`);
      if (n.author) lines.push(`- Author: ${n.author}`);
      lines.push("");
    }
    return lines.join("\n");
  });
}

export async function getNote(client: FreeAgentApiClient, params: GetNoteInput): Promise<string> {
  const response = await client.get<{ note: Note }>(resourcePath(params.note_id, "notes"));
  const n = response.data.note;
  return formatResponse(n, params.response_format, () =>
    `# Note ${extractIdFromUrl(n.url)}\n\n${n.note ?? ""}\n\n- Parent: ${n.parent_url ?? ""}\n- Author: ${n.author ?? ""}`
  );
}

export async function createNote(client: FreeAgentApiClient, params: CreateNoteInput): Promise<string> {
  const q: Record<string, string> = {};
  if (params.contact) q.contact = params.contact;
  if (params.project) q.project = params.project;
  // FreeAgent expects query param for parent on create
  const qs = Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const path = qs ? `/notes?${qs}` : "/notes";
  const response = await client.post<{ note: Note }>(path, { note: { note: params.note } });
  const n = response.data.note;
  return `✅ Note created ${extractIdFromUrl(n.url)}\n**URL**: ${n.url}`;
}

export async function updateNote(client: FreeAgentApiClient, params: UpdateNoteInput): Promise<string> {
  const response = await client.put<{ note: Note }>(
    resourcePath(params.note_id, "notes"),
    { note: { note: params.note } }
  );
  return `✅ Note updated ${extractIdFromUrl(response.data.note.url)}`;
}

export async function deleteNote(client: FreeAgentApiClient, params: DeleteNoteInput): Promise<string> {
  await client.delete(resourcePath(params.note_id, "notes"));
  return `✅ Note deleted: ${params.note_id}`;
}
