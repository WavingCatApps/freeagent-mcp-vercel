/**
 * Shared resolvers for intent-bundle tools.
 *
 * These take a human-friendly hint (name, code, email) and return the canonical
 * FreeAgent URL required by the API. Keeping them here lets multiple tools
 * (reconcile_bank_transaction, log_expense, ...) share one lookup strategy and
 * one set of error messages.
 */

import type { FreeAgentApiClient } from "./api-client.js";
import type { FreeAgentBill, FreeAgentCategory, FreeAgentContact, FreeAgentUser } from "../types.js";

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
