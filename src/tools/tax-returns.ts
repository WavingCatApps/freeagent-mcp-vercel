import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse } from "../services/formatter.js";
import { resourceId } from "../utils/resource-path.js";

import type {
  ListVatReturnsInput, GetVatReturnInput, TransitionVatReturnInput, TransitionVatReturnPaymentInput,
  ListCorporationTaxReturnsInput, GetCorporationTaxReturnInput, TransitionCorporationTaxReturnInput,
  ListFinalAccountsReportsInput, GetFinalAccountsReportInput, TransitionFinalAccountsReportInput,
  ListIncomeTaxReturnsInput, GetIncomeTaxReturnInput, TransitionIncomeTaxReturnInput, TransitionIncomeTaxReturnPaymentInput,
} from "../schemas/index.js";

function dump(title: string, data: unknown): string {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

export async function listVatReturns(client: FreeAgentApiClient, params: ListVatReturnsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/vat_returns");
  return formatResponse(response.data, params.response_format, () => dump("VAT Returns", response.data));
}

export async function getVatReturn(client: FreeAgentApiClient, params: GetVatReturnInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>(`/vat_returns/${params.period_ends_on}`);
  return formatResponse(response.data, params.response_format, () => dump(`VAT Return ${params.period_ends_on}`, response.data));
}

export async function transitionVatReturn(client: FreeAgentApiClient, params: TransitionVatReturnInput): Promise<string> {
  await client.put(`/vat_returns/${params.period_ends_on}/${params.action}`);
  return `✅ VAT return ${params.period_ends_on}: ${params.action}`;
}

export async function transitionVatReturnPayment(client: FreeAgentApiClient, params: TransitionVatReturnPaymentInput): Promise<string> {
  await client.put(`/vat_returns/${params.period_ends_on}/payments/${params.payment_date}/${params.action}`);
  return `✅ VAT return payment ${params.payment_date}: ${params.action}`;
}

export async function listCorporationTaxReturns(client: FreeAgentApiClient, params: ListCorporationTaxReturnsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/corporation_tax_returns");
  return formatResponse(response.data, params.response_format, () => dump("Corporation Tax Returns", response.data));
}

export async function getCorporationTaxReturn(client: FreeAgentApiClient, params: GetCorporationTaxReturnInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>(`/corporation_tax_returns/${params.period_ends_on}`);
  return formatResponse(response.data, params.response_format, () => dump(`Corporation Tax Return ${params.period_ends_on}`, response.data));
}

export async function transitionCorporationTaxReturn(client: FreeAgentApiClient, params: TransitionCorporationTaxReturnInput): Promise<string> {
  await client.put(`/corporation_tax_returns/${params.period_ends_on}/${params.action}`);
  return `✅ Corporation tax return ${params.period_ends_on}: ${params.action}`;
}

export async function listFinalAccountsReports(client: FreeAgentApiClient, params: ListFinalAccountsReportsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>("/final_accounts_reports");
  return formatResponse(response.data, params.response_format, () => dump("Final Accounts Reports", response.data));
}

export async function getFinalAccountsReport(client: FreeAgentApiClient, params: GetFinalAccountsReportInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>(`/final_accounts_reports/${params.period_ends_on}`);
  return formatResponse(response.data, params.response_format, () => dump(`Final Accounts Report ${params.period_ends_on}`, response.data));
}

export async function transitionFinalAccountsReport(client: FreeAgentApiClient, params: TransitionFinalAccountsReportInput): Promise<string> {
  await client.put(`/final_accounts_reports/${params.period_ends_on}/${params.action}`);
  return `✅ Final accounts report ${params.period_ends_on}: ${params.action}`;
}

export async function listIncomeTaxReturns(client: FreeAgentApiClient, params: ListIncomeTaxReturnsInput): Promise<string> {
  const userId = resourceId(params.user_id);
  const response = await client.get<Record<string, unknown>>(`/users/${userId}/self_assessment_returns`);
  return formatResponse(response.data, params.response_format, () => dump("Income Tax / Self Assessment Returns", response.data));
}

export async function getIncomeTaxReturn(client: FreeAgentApiClient, params: GetIncomeTaxReturnInput): Promise<string> {
  const userId = resourceId(params.user_id);
  const response = await client.get<Record<string, unknown>>(
    `/users/${userId}/self_assessment_returns/${params.period_ends_on}`
  );
  return formatResponse(response.data, params.response_format, () => dump(`Income Tax Return ${params.period_ends_on}`, response.data));
}

export async function transitionIncomeTaxReturn(client: FreeAgentApiClient, params: TransitionIncomeTaxReturnInput): Promise<string> {
  const userId = resourceId(params.user_id);
  await client.put(`/users/${userId}/self_assessment_returns/${params.period_ends_on}/${params.action}`);
  return `✅ Income tax return ${params.period_ends_on}: ${params.action}`;
}

export async function transitionIncomeTaxReturnPayment(client: FreeAgentApiClient, params: TransitionIncomeTaxReturnPaymentInput): Promise<string> {
  const userId = resourceId(params.user_id);
  await client.put(
    `/users/${userId}/self_assessment_returns/${params.period_ends_on}/payments/${params.payment_date}/${params.action}`
  );
  return `✅ Income tax payment ${params.payment_date}: ${params.action}`;
}
