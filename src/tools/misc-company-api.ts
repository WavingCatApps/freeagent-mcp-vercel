import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse, extractIdFromUrl } from "../services/formatter.js";
import { resourcePath } from "../utils/resource-path.js";

import type {
  ListBankFeedsInput, GetBankFeedInput,
  ListEmailAddressesInput,
  ListAccountLocksInput, SetAccountLockInput, DeleteAccountLockInput,
  ListCisBandsInput, GetCisSettingsInput, UpdateCisSettingsInput,
  ListSalesTaxPeriodsInput, GetSalesTaxPeriodInput, CreateSalesTaxPeriodInput,
  UpdateSalesTaxPeriodInput, DeleteSalesTaxPeriodInput,
  GetCompanyBusinessTypesInput, GetCompanyTaxTimelineInput,
  GetUserInput, CreateUserInput, UpdateUserInput, DeleteUserInput,
} from "../schemas/index.js";

function dump(title: string, data: unknown): string {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

export async function listBankFeeds(client: FreeAgentApiClient, params: ListBankFeedsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/bank_feeds");
  return formatResponse(response.data, params.response_format, () => dump("Bank Feeds", response.data));
}

export async function getBankFeed(client: FreeAgentApiClient, params: GetBankFeedInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>(resourcePath(params.bank_feed_id, "bank_feeds"));
  return formatResponse(response.data, params.response_format, () => dump("Bank Feed", response.data));
}

export async function listEmailAddresses(client: FreeAgentApiClient, params: ListEmailAddressesInput): Promise<string> {
  const response = await client.get<{ email_addresses?: string[] }>("/email_addresses");
  const emails = response.data.email_addresses ?? [];
  return formatResponse({ email_addresses: emails }, params.response_format, () => {
    if (!emails.length) return "No verified sender email addresses found.";
    return ["# Verified Email Addresses", "", ...emails.map((e) => `- ${e}`)].join("\n");
  });
}

export async function listAccountLocks(client: FreeAgentApiClient, params: ListAccountLocksInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/account_locks");
  return formatResponse(response.data, params.response_format, () => dump("Account Locks", response.data));
}

export async function setAccountLock(client: FreeAgentApiClient, params: SetAccountLockInput): Promise<string> {
  const response = await client.put<Record<string, unknown>>("/account_locks", {
    account_lock: { locked_to_date: params.locked_to_date, user_lock: true },
  });
  return `✅ Account lock set to ${params.locked_to_date}\n\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``;
}

export async function deleteAccountLock(client: FreeAgentApiClient, _params: DeleteAccountLockInput): Promise<string> {
  await client.delete("/account_locks");
  return "✅ User account lock removed";
}

export async function listCisBands(client: FreeAgentApiClient, params: ListCisBandsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/cis_bands");
  return formatResponse(response.data, params.response_format, () => dump("CIS Bands", response.data));
}

export async function getCisSettings(client: FreeAgentApiClient, params: GetCisSettingsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/cis_settings");
  return formatResponse(response.data, params.response_format, () => dump("CIS Settings", response.data));
}

export async function updateCisSettings(client: FreeAgentApiClient, params: UpdateCisSettingsInput): Promise<string> {
  const response = await client.put<Record<string, unknown>>("/cis_settings", { cis_settings: params.settings });
  return `✅ CIS settings updated\n\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``;
}

export async function listSalesTaxPeriods(client: FreeAgentApiClient, params: ListSalesTaxPeriodsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/sales_tax_periods");
  return formatResponse(response.data, params.response_format, () => dump("Sales Tax Periods", response.data));
}

export async function getSalesTaxPeriod(client: FreeAgentApiClient, params: GetSalesTaxPeriodInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>(resourcePath(params.sales_tax_period_id, "sales_tax_periods"));
  return formatResponse(response.data, params.response_format, () => dump("Sales Tax Period", response.data));
}

export async function createSalesTaxPeriod(client: FreeAgentApiClient, params: CreateSalesTaxPeriodInput): Promise<string> {
  const response = await client.post<Record<string, unknown>>("/sales_tax_periods", { sales_tax_period: params });
  return `✅ Sales tax period created\n\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``;
}

export async function updateSalesTaxPeriod(client: FreeAgentApiClient, params: UpdateSalesTaxPeriodInput): Promise<string> {
  const { sales_tax_period_id, ...fields } = params;
  const response = await client.put<Record<string, unknown>>(
    resourcePath(sales_tax_period_id, "sales_tax_periods"),
    { sales_tax_period: fields }
  );
  return `✅ Sales tax period updated\n\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``;
}

export async function deleteSalesTaxPeriod(client: FreeAgentApiClient, params: DeleteSalesTaxPeriodInput): Promise<string> {
  await client.delete(resourcePath(params.sales_tax_period_id, "sales_tax_periods"));
  return `✅ Sales tax period deleted: ${params.sales_tax_period_id}`;
}

export async function getCompanyBusinessCategories(client: FreeAgentApiClient, params: GetCompanyBusinessTypesInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/company/business_categories");
  return formatResponse(response.data, params.response_format, () => dump("Business Categories", response.data));
}

export async function getCompanyTaxTimeline(client: FreeAgentApiClient, params: GetCompanyTaxTimelineInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/company/tax_timeline");
  return formatResponse(response.data, params.response_format, () => dump("Tax Timeline", response.data));
}

export async function getUser(client: FreeAgentApiClient, params: GetUserInput): Promise<string> {
  const path = params.user_id === "me" ? "/users/me" : resourcePath(params.user_id, "users");
  const response = await client.get<Record<string, unknown>>(path);
  return formatResponse(response.data, params.response_format, () => dump("User", response.data));
}

export async function createUser(client: FreeAgentApiClient, params: CreateUserInput): Promise<string> {
  const response = await client.post<{ user: { url: string; email?: string } }>("/users", { user: params });
  return `✅ User created ${extractIdFromUrl(response.data.user.url)} (${response.data.user.email ?? ""})\n**URL**: ${response.data.user.url}`;
}

export async function updateUser(client: FreeAgentApiClient, params: UpdateUserInput): Promise<string> {
  const { user_id, ...fields } = params;
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) body[k] = v;
  const response = await client.put<{ user: { url: string } }>(resourcePath(user_id, "users"), { user: body });
  return `✅ User updated ${extractIdFromUrl(response.data.user.url)}`;
}

export async function deleteUser(client: FreeAgentApiClient, params: DeleteUserInput): Promise<string> {
  await client.delete(resourcePath(params.user_id, "users"));
  return `✅ User deleted: ${params.user_id}`;
}
