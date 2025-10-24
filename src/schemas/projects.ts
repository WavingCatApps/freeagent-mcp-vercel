import { z } from "zod";

/**
 * Schema for listing projects
 */
export const ListProjectsInputSchema = z.object({
  view: z.enum(["active", "completed", "cancelled", "hidden", "all"]).optional().describe("Filter projects by status view"),
  contact: z.string().optional().describe("Filter by contact URL"),
  sort: z.enum(["name", "created_at", "updated_at"]).optional().describe("Sort order for results"),
  page: z.number().optional().describe("Page number for pagination"),
  per_page: z.number().optional().describe("Number of results per page"),
  nested: z.boolean().optional().describe("Include nested resources in response"),
});

export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;

/**
 * Schema for getting a single project
 */
export const GetProjectInputSchema = z.object({
  id: z.number().describe("The project ID"),
});

export type GetProjectInput = z.infer<typeof GetProjectInputSchema>;

/**
 * Schema for creating a project
 */
export const CreateProjectInputSchema = z.object({
  contact: z.string().describe("URL of the contact this project is for"),
  name: z.string().describe("Name of the project"),
  budget: z.number().describe("Budget amount"),
  budget_units: z.enum(["Hours", "Days", "Monetary"]).describe("Units for the budget (Hours, Days, or Monetary)"),
  status: z.enum(["Active", "Completed", "Cancelled", "Hidden"]).describe("Status of the project"),
  currency: z.string().optional().default("GBP").describe("ISO 4217 currency code (e.g., GBP, USD, EUR)"),
  uses_project_invoice_sequence: z.boolean().optional().default(false).describe("Whether to use project-specific invoice numbering"),
  is_ir35: z.boolean().optional().default(false).describe("Whether this project is subject to IR35"),
  contract_po_reference: z.string().optional().describe("Purchase order reference number"),
  starts_on: z.string().optional().describe("Project start date (YYYY-MM-DD)"),
  ends_on: z.string().optional().describe("Project end date (YYYY-MM-DD)"),
  normal_billing_rate: z.number().optional().describe("Hourly or daily billing rate"),
  billing_period: z.enum(["hour", "day"]).optional().describe("Billing period (hour or day)"),
  hours_per_day: z.number().optional().default(8).describe("Hours per working day"),
  include_unbilled_time_in_profitability: z.boolean().optional().describe("Include unbilled time in profitability calculations"),
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
