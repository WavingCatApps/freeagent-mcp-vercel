/**
 * Tool-search meta-tools for the FreeAgent MCP server.
 *
 * When FREEAGENT_TOOL_SEARCH=true the server exposes only `freeagent_search_tools`
 * and `freeagent_call_tool`. This reduces the tool-definition footprint of
 * tools/list from ~50 entries to 2, and lets clients pull in individual tool
 * schemas on demand — mirroring the deferred-loading pattern used by Claude
 * Code's internal ToolSearch.
 */

import { z } from "zod";
import type { FreeAgentApiClient } from "../services/api-client.js";
import type { ToolContext, ToolDefinition } from "./register.js";
import type { SearchToolsInput, CallToolInput } from "../schemas/index.js";

interface ToolMatch {
  tool: ToolDefinition;
  score: number;
}

/**
 * Tokenize text for keyword matching. Lowercases, strips punctuation, and
 * collapses on whitespace. Underscores in tool names are treated as separators
 * so "list_invoices" matches a query for "list invoices".
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Parse a search query into required and optional terms.
 * - `+foo bar baz` → required: [foo], optional: [bar, baz]
 * - `foo bar` → required: [], optional: [foo, bar]
 */
function parseQuery(query: string): { required: string[]; optional: string[] } {
  const required: string[] = [];
  const optional: string[] = [];
  for (const raw of query.split(/\s+/)) {
    if (!raw) continue;
    if (raw.startsWith("+") && raw.length > 1) {
      required.push(raw.slice(1).toLowerCase());
    } else {
      optional.push(raw.toLowerCase());
    }
  }
  return { required, optional };
}

/**
 * Match a term against a set of tokens with plural/prefix tolerance.
 * Returns a match grade: 2 for exact, 1 for prefix/suffix overlap, 0 for none.
 */
function matchGrade(term: string, tokens: Set<string>): 0 | 1 | 2 {
  if (tokens.has(term)) return 2;
  for (const token of tokens) {
    if (term.length >= 3 && token.length >= 3 &&
        (token.startsWith(term) || term.startsWith(token))) {
      return 1;
    }
  }
  return 0;
}

/**
 * Rank a single tool against a parsed query. Returns a score or null if it
 * fails a required term. Name matches weigh more than description matches;
 * prefix/plural matches (e.g. "invoice" → "invoices") are treated as near-exact.
 */
function scoreTool(tool: ToolDefinition, required: string[], optional: string[]): number | null {
  const nameTokens = new Set(tokenize(tool.name));
  const descTokens = new Set(tokenize(tool.description));
  const titleTokens = new Set(tokenize(tool.title));
  const nameLower = tool.name.toLowerCase();
  const descLower = tool.description.toLowerCase();

  const hasTerm = (term: string): boolean =>
    matchGrade(term, nameTokens) > 0 ||
    matchGrade(term, titleTokens) > 0 ||
    matchGrade(term, descTokens) > 0 ||
    nameLower.includes(term) || descLower.includes(term);

  for (const term of required) {
    if (!hasTerm(term)) return null;
  }

  let score = 0;
  const allTerms = [...required, ...optional];
  for (const term of allTerms) {
    const nameGrade = matchGrade(term, nameTokens);
    if (nameGrade === 2) score += 10;
    else if (nameGrade === 1) score += 8;
    else if (nameLower.includes(term)) score += 4;

    const titleGrade = matchGrade(term, titleTokens);
    if (titleGrade === 2) score += 3;
    else if (titleGrade === 1) score += 2;

    const descGrade = matchGrade(term, descTokens);
    if (descGrade === 2) score += 2;
    else if (descGrade === 1) score += 1;
    else if (descLower.includes(term)) score += 1;
  }
  return score;
}

/**
 * Rank tools by a free-text query. Exported for testability.
 */
export function matchTools(
  catalog: ToolDefinition[],
  query: string,
  maxResults: number
): ToolDefinition[] {
  const { required, optional } = parseQuery(query);
  if (required.length === 0 && optional.length === 0) return [];

  const matches: ToolMatch[] = [];
  for (const tool of catalog) {
    const score = scoreTool(tool, required, optional);
    if (score !== null && score > 0) matches.push({ tool, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, maxResults).map((m) => m.tool);
}

/**
 * Look up tools by exact name for `select:name1,name2` queries.
 */
function selectTools(catalog: ToolDefinition[], names: string[]): ToolDefinition[] {
  const byName = new Map(catalog.map((t) => [t.name, t]));
  const out: ToolDefinition[] = [];
  for (const name of names) {
    const tool = byName.get(name.trim());
    if (tool) out.push(tool);
  }
  return out;
}

/**
 * Render a tool as a <function> block matching the encoding used by Claude
 * Code's ToolSearch, so agents can drop it directly into their tool list.
 */
function renderToolBlock(tool: ToolDefinition): string {
  const schema = z.object(tool.inputSchema);
  const parameters = z.toJSONSchema(schema);
  const payload = {
    description: tool.description,
    name: tool.name,
    parameters,
  };
  return `<function>${JSON.stringify(payload)}</function>`;
}

/**
 * Handler for freeagent_search_tools. Returns matching tool schemas wrapped in
 * a <functions>…</functions> block, or a "No matching tools found" message.
 */
export async function searchTools(
  catalog: ToolDefinition[],
  params: SearchToolsInput
): Promise<string> {
  const { query, max_results } = params;
  const trimmed = query.trim();

  let tools: ToolDefinition[];
  if (trimmed.toLowerCase().startsWith("select:")) {
    const names = trimmed.slice("select:".length).split(",").map((s) => s.trim()).filter(Boolean);
    tools = selectTools(catalog, names);
    if (tools.length === 0) {
      return `No tools matched select query. Available tool count: ${catalog.length}. Requested names: ${names.join(", ") || "(none)"}`;
    }
  } else {
    tools = matchTools(catalog, trimmed, max_results);
    if (tools.length === 0) {
      return "No matching tools found. Try different keywords or use 'select:<tool_name>' to fetch a specific tool.";
    }
  }

  const blocks = tools.map(renderToolBlock).join("\n");
  return `<functions>\n${blocks}\n</functions>`;
}

/**
 * Handler for freeagent_call_tool. Validates arguments against the target
 * tool's Zod schema and dispatches to its handler.
 */
export async function callTool(
  catalog: ToolDefinition[],
  apiClient: FreeAgentApiClient,
  params: CallToolInput,
  ctx: ToolContext
): Promise<string> {
  const { name, arguments: args } = params;
  const tool = catalog.find((t) => t.name === name);
  if (!tool) {
    const available = catalog.map((t) => t.name).slice(0, 10).join(", ");
    throw new Error(
      `Unknown tool '${name}'. Use freeagent_search_tools to discover tool names. ` +
        `First few available: ${available}…`
    );
  }

  const schema = z.object(tool.inputSchema);
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid arguments for ${name}:\n${issues}`);
  }

  return tool.handler(apiClient, parsed.data, ctx);
}
