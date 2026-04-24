/**
 * Shared resolvers for intent-bundle tools.
 *
 * These take a human-friendly hint (name, code, email) and return the canonical
 * FreeAgent URL required by the API. Keeping them here lets multiple tools
 * (reconcile_bank_transaction, log_expense, ...) share one lookup strategy and
 * one set of error messages.
 */

import type { FreeAgentApiClient } from "./api-client.js";
import type {
  FreeAgentBill,
  FreeAgentCategory,
  FreeAgentContact,
  FreeAgentProject,
  FreeAgentTask,
  FreeAgentUser,
} from "../types.js";

interface CategoryListResponse {
  admin_expenses_categories?: FreeAgentCategory[];
  cost_of_sales_categories?: FreeAgentCategory[];
  income_categories?: FreeAgentCategory[];
  general_categories?: FreeAgentCategory[];
}

function flattenCategories(data: CategoryListResponse): FreeAgentCategory[] {
  return [
    ...(data.admin_expenses_categories ?? []),
    ...(data.cost_of_sales_categories ?? []),
    ...(data.income_categories ?? []),
    ...(data.general_categories ?? []),
  ];
}

/**
 * Resolve a category hint (URL, nominal code, name) to its canonical URL.
 *
 * Prefers an exact case-insensitive match on description before falling back
 * to substring matching. Throws a clear, suggestion-rich error when the hint
 * is ambiguous or matches nothing.
 */
export async function resolveCategory(
  client: FreeAgentApiClient,
  hint: string
): Promise<string> {
  if (hint.startsWith("http")) return hint;

  if (/^\d+$/.test(hint)) {
    const response = await client.get<{ category: FreeAgentCategory }>(
      `/categories/${hint}`
    );
    return response.data.category.url;
  }

  const response = await client.get<CategoryListResponse>("/categories");
  const all = flattenCategories(response.data);
  const lower = hint.toLowerCase();

  const exact = all.filter((c) => c.description.toLowerCase() === lower);
  if (exact.length === 1) return exact[0].url;
  if (exact.length > 1) {
    const codes = exact.map((c) => `${c.nominal_code} (${c.description})`).join(", ");
    throw new Error(
      `Category name "${hint}" is ambiguous. Matches: ${codes}. Pass the nominal code instead.`
    );
  }

  const partial = all.filter((c) => c.description.toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0].url;
  if (partial.length > 1) {
    const suggestions = partial
      .slice(0, 8)
      .map((c) => `${c.nominal_code} (${c.description})`)
      .join(", ");
    throw new Error(
      `Category name "${hint}" matches multiple categories: ${suggestions}. ` +
        `Pass the nominal code or the exact description.`
    );
  }

  throw new Error(
    `No category matches "${hint}". Call freeagent_list_categories to see available categories.`
  );
}

/**
 * Resolve a user hint (URL, numeric ID, email) to its canonical URL. When
 * `hint` is undefined, returns the sole user on the account, or throws if
 * there are zero or many users.
 */
export async function resolveUser(
  client: FreeAgentApiClient,
  hint?: string
): Promise<string> {
  if (hint?.startsWith("http")) return hint;

  if (hint && /^\d+$/.test(hint)) {
    const response = await client.get<{ user: FreeAgentUser }>(`/users/${hint}`);
    return response.data.user.url;
  }

  const response = await client.get<{ users: FreeAgentUser[] }>("/users");
  const users = response.data.users ?? [];

  if (hint) {
    const lower = hint.toLowerCase();
    const matches = users.filter(
      (u) =>
        u.email.toLowerCase() === lower ||
        `${u.first_name} ${u.last_name}`.toLowerCase() === lower
    );
    if (matches.length === 1) return matches[0].url;
    if (matches.length > 1) {
      throw new Error(
        `User "${hint}" is ambiguous across ${matches.length} accounts. Pass the user ID or URL.`
      );
    }
    throw new Error(
      `No user matches "${hint}". Call freeagent_list_users to see available users.`
    );
  }

  if (users.length === 1) return users[0].url;
  if (users.length === 0) {
    throw new Error("No users found on this FreeAgent account.");
  }
  throw new Error(
    `This account has ${users.length} users; pass the \`user\` parameter (email, ID, or URL) to disambiguate.`
  );
}

function contactLabel(c: FreeAgentContact): string {
  if (c.organisation_name) return c.organisation_name;
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.join(" ") || "Unnamed contact";
}

/**
 * Resolve a contact hint (URL, numeric ID, organisation or person name) to
 * its canonical URL.
 */
export async function resolveContact(
  client: FreeAgentApiClient,
  hint: string
): Promise<string> {
  if (hint.startsWith("http")) return hint;

  if (/^\d+$/.test(hint)) {
    const response = await client.get<{ contact: FreeAgentContact }>(
      `/contacts/${hint}`
    );
    return response.data.contact.url;
  }

  const response = await client.get<{ contacts: FreeAgentContact[] }>(
    "/contacts",
    { per_page: 100 }
  );
  const contacts = response.data.contacts ?? [];
  const lower = hint.toLowerCase();

  const exact = contacts.filter((c) => contactLabel(c).toLowerCase() === lower);
  if (exact.length === 1) return exact[0].url;
  if (exact.length > 1) {
    throw new Error(
      `Contact name "${hint}" matches ${exact.length} contacts exactly. Pass the contact ID or URL.`
    );
  }

  const partial = contacts.filter((c) =>
    contactLabel(c).toLowerCase().includes(lower)
  );
  if (partial.length === 1) return partial[0].url;
  if (partial.length > 1) {
    const suggestions = partial
      .slice(0, 8)
      .map(contactLabel)
      .join(", ");
    throw new Error(
      `Contact "${hint}" matches multiple contacts: ${suggestions}. Pass the contact ID or URL.`
    );
  }

  throw new Error(
    `No contact matches "${hint}". Call freeagent_list_contacts to see available contacts.`
  );
}

/**
 * Resolve a bill hint (URL, numeric ID, reference) to its canonical URL.
 * When `hint` looks like a reference, only open/overdue bills are searched.
 */
export async function resolveBill(
  client: FreeAgentApiClient,
  hint: string
): Promise<string> {
  if (hint.startsWith("http")) return hint;

  if (/^\d+$/.test(hint)) {
    const response = await client.get<{ bill: FreeAgentBill }>(`/bills/${hint}`);
    return response.data.bill.url;
  }

  const response = await client.get<{ bills: FreeAgentBill[] }>("/bills", {
    per_page: 100,
    view: "open",
  });
  const matches = (response.data.bills ?? []).filter((b) => b.reference === hint);

  if (matches.length === 1) return matches[0].url;
  if (matches.length > 1) {
    throw new Error(
      `Bill reference "${hint}" matches ${matches.length} open bills. Pass the bill ID or URL instead.`
    );
  }
  throw new Error(
    `No open bill has reference "${hint}". Check the reference, or pass the bill ID/URL directly.`
  );
}

/**
 * Resolve a project hint (URL, numeric ID, name) to its canonical URL.
 *
 * Prefers an exact case-insensitive match on name before falling back to
 * substring matching. Searches active projects first; retries across all
 * projects if nothing matches, so completed/hidden projects remain findable
 * by exact name.
 */
export async function resolveProject(
  client: FreeAgentApiClient,
  hint: string
): Promise<string> {
  if (hint.startsWith("http")) return hint;

  if (/^\d+$/.test(hint)) {
    const response = await client.get<{ project: FreeAgentProject }>(
      `/projects/${hint}`
    );
    return response.data.project.url;
  }

  const lower = hint.toLowerCase();

  const tryMatch = (projects: FreeAgentProject[]): string | undefined => {
    const exact = projects.filter((p) => p.name.toLowerCase() === lower);
    if (exact.length === 1) return exact[0].url;
    if (exact.length > 1) {
      throw new Error(
        `Project name "${hint}" matches ${exact.length} projects exactly. Pass the project ID or URL.`
      );
    }
    const partial = projects.filter((p) => p.name.toLowerCase().includes(lower));
    if (partial.length === 1) return partial[0].url;
    if (partial.length > 1) {
      const suggestions = partial.slice(0, 8).map((p) => p.name).join(", ");
      throw new Error(
        `Project "${hint}" matches multiple projects: ${suggestions}. Pass the project ID or URL.`
      );
    }
    return undefined;
  };

  const active = await client.get<{ projects: FreeAgentProject[] }>(
    "/projects",
    { view: "active", per_page: 100 }
  );
  const activeMatch = tryMatch(active.data.projects ?? []);
  if (activeMatch) return activeMatch;

  const all = await client.get<{ projects: FreeAgentProject[] }>(
    "/projects",
    { view: "all", per_page: 100 }
  );
  const allMatch = tryMatch(all.data.projects ?? []);
  if (allMatch) return allMatch;

  throw new Error(
    `No project matches "${hint}". Call freeagent_list_projects to see available projects.`
  );
}

/**
 * Resolve a task hint (URL, numeric ID, or name-within-project) to its
 * canonical URL together with the project URL it belongs to.
 *
 * - URL or numeric ID: fetched directly; `projectHint` is only used to sanity
 *   check that the task belongs to the expected project.
 * - Name: `projectHint` is required to scope the lookup, since task names are
 *   only unique within a project.
 */
export async function resolveTask(
  client: FreeAgentApiClient,
  hint: string,
  projectHint?: string
): Promise<{ url: string; projectUrl: string }> {
  if (hint.startsWith("http") || /^\d+$/.test(hint)) {
    const taskPath = hint.startsWith("http") ? hint : `/tasks/${hint}`;
    const response = await client.get<{ task: FreeAgentTask }>(taskPath);
    const task = response.data.task;
    if (projectHint) {
      const expected = await resolveProject(client, projectHint);
      if (task.project !== expected) {
        throw new Error(
          `Task ${task.url} belongs to a different project than "${projectHint}".`
        );
      }
    }
    return { url: task.url, projectUrl: task.project };
  }

  if (!projectHint) {
    throw new Error(
      `Task "${hint}" must be paired with a \`project\` (name, ID, or URL) when passed by name, since task names are not globally unique.`
    );
  }

  const projectUrl = await resolveProject(client, projectHint);
  const response = await client.get<{ tasks: FreeAgentTask[] }>("/tasks", {
    project: projectUrl,
    view: "active",
    per_page: 100,
  });
  const tasks = response.data.tasks ?? [];
  const lower = hint.toLowerCase();

  const exact = tasks.filter((t) => t.name.toLowerCase() === lower);
  if (exact.length === 1) return { url: exact[0].url, projectUrl };
  if (exact.length > 1) {
    throw new Error(
      `Task name "${hint}" matches ${exact.length} active tasks on this project. Pass the task ID or URL.`
    );
  }

  const partial = tasks.filter((t) => t.name.toLowerCase().includes(lower));
  if (partial.length === 1) return { url: partial[0].url, projectUrl };
  if (partial.length > 1) {
    const suggestions = partial.slice(0, 8).map((t) => t.name).join(", ");
    throw new Error(
      `Task "${hint}" matches multiple tasks on this project: ${suggestions}. Pass the task ID or URL, or use the exact task name.`
    );
  }

  throw new Error(
    `No active task matches "${hint}" on this project. Call freeagent_list_tasks to see available tasks, or create the task first.`
  );
}
