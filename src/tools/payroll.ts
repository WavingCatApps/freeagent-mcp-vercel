import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse } from "../services/formatter.js";
import type {
  ListPayrollPeriodsInput, ListPayrollPayslipsInput, TransitionPayrollPaymentInput,
  ListPayrollProfilesInput, GetPayrollProfileInput,
} from "../schemas/index.js";

function dump(title: string, data: unknown): string {
  return `# ${title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

export async function listPayrollPeriods(client: FreeAgentApiClient, params: ListPayrollPeriodsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>(`/payroll/${params.year}`);
  return formatResponse(response.data, params.response_format, () => dump(`Payroll Periods ${params.year}`, response.data));
}

export async function listPayrollPayslips(client: FreeAgentApiClient, params: ListPayrollPayslipsInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>(`/payroll/${params.year}/${params.period}`);
  return formatResponse(response.data, params.response_format, () => dump(`Payslips ${params.year}/${params.period}`, response.data));
}

export async function transitionPayrollPayment(client: FreeAgentApiClient, params: TransitionPayrollPaymentInput): Promise<string> {
  await client.put(`/payroll/${params.year}/payments/${params.payment_date}/${params.action}`);
  return `✅ Payroll payment ${params.payment_date}: ${params.action}`;
}

export async function listPayrollProfiles(client: FreeAgentApiClient, params: ListPayrollProfilesInput): Promise<string> {
  const response = await client.get<Record<string, unknown>>(`/payroll_profiles/${params.year}`);
  return formatResponse(response.data, params.response_format, () => dump(`Payroll Profiles ${params.year}`, response.data));
}

export async function getPayrollProfile(client: FreeAgentApiClient, params: GetPayrollProfileInput): Promise<string> {
  const q: Record<string, string> = {};
  if (params.user) q.user = params.user;
  const response = await client.get<Record<string, unknown>>(`/payroll_profiles/${params.year}`, q);
  return formatResponse(response.data, params.response_format, () => dump(`Payroll Profile ${params.year}`, response.data));
}
