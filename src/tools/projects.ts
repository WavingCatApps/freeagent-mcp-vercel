import { FreeAgentApiClient } from "../services/api-client.js";
import { ResponseFormat } from "../constants.js";
import type { ListProjectsInput, GetProjectInput, CreateProjectInput } from "../schemas/index.js";

/**
 * List all projects in FreeAgent
 */
export async function listProjects(
  apiClient: FreeAgentApiClient,
  params: ListProjectsInput
): Promise<string> {
  const queryParams = new URLSearchParams();

  if (params.view) queryParams.set("view", params.view);
  if (params.contact) queryParams.set("contact", params.contact);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.per_page) queryParams.set("per_page", params.per_page.toString());

  const url = `/projects${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await apiClient.get(url);

  if (!response.projects || response.projects.length === 0) {
    return "No projects found.";
  }

  if (params.response_format === ResponseFormat.JSON) {
    return JSON.stringify(response.projects, null, 2);
  }

  const projectList = response.projects
    .map((project: any) => {
      return [
        `Project: ${project.name}`,
        `  URL: ${project.url}`,
        `  Contact: ${project.contact}`,
        `  Status: ${project.status}`,
        `  Budget: ${project.budget} ${project.budget_units}`,
        `  Currency: ${project.currency}`,
        project.starts_on ? `  Starts: ${project.starts_on}` : null,
        project.ends_on ? `  Ends: ${project.ends_on}` : null,
        project.normal_billing_rate ? `  Billing Rate: ${project.normal_billing_rate} ${project.billing_period}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `Found ${response.projects.length} project(s):\n\n${projectList}`;
}

/**
 * Get details of a specific project
 */
export async function getProject(
  apiClient: FreeAgentApiClient,
  params: GetProjectInput
): Promise<string> {
  const projectId = params.project_id.replace(/^.*\/projects\//, "");
  const response = await apiClient.get(`/projects/${projectId}`);
  const project = response.project;

  if (params.response_format === ResponseFormat.JSON) {
    return JSON.stringify(project, null, 2);
  }

  const details = [
    `Project Details:`,
    `  Name: ${project.name}`,
    `  URL: ${project.url}`,
    `  Contact: ${project.contact}`,
    `  Status: ${project.status}`,
    `  Budget: ${project.budget} ${project.budget_units}`,
    `  Currency: ${project.currency}`,
    `  Hours per day: ${project.hours_per_day}`,
    project.contract_po_reference ? `  PO Reference: ${project.contract_po_reference}` : null,
    project.starts_on ? `  Start Date: ${project.starts_on}` : null,
    project.ends_on ? `  End Date: ${project.ends_on}` : null,
    project.normal_billing_rate ? `  Billing Rate: ${project.normal_billing_rate} ${project.billing_period}` : null,
    `  Uses project invoice sequence: ${project.uses_project_invoice_sequence}`,
    `  Is IR35: ${project.is_ir35}`,
    `  Include unbilled time in profitability: ${project.include_unbilled_time_in_profitability}`,
    `  Is deletable: ${project.is_deletable}`,
    `  Created: ${project.created_at}`,
    `  Updated: ${project.updated_at}`,
  ]
    .filter(Boolean)
    .join("\n");

  return details;
}

/**
 * Create a new project in FreeAgent
 */
export async function createProject(
  apiClient: FreeAgentApiClient,
  params: CreateProjectInput
): Promise<string> {
  const projectData: any = {
    contact: params.contact,
    name: params.name,
    budget: params.budget,
    budget_units: params.budget_units,
    status: params.status,
    currency: params.currency || "GBP",
    uses_project_invoice_sequence: params.uses_project_invoice_sequence ?? false,
    is_ir35: params.is_ir35 ?? false,
  };

  if (params.contract_po_reference) projectData.contract_po_reference = params.contract_po_reference;
  if (params.starts_on) projectData.starts_on = params.starts_on;
  if (params.ends_on) projectData.ends_on = params.ends_on;
  if (params.normal_billing_rate) projectData.normal_billing_rate = params.normal_billing_rate;
  if (params.billing_period) projectData.billing_period = params.billing_period;
  if (params.hours_per_day) projectData.hours_per_day = params.hours_per_day;
  if (params.include_unbilled_time_in_profitability !== undefined) {
    projectData.include_unbilled_time_in_profitability = params.include_unbilled_time_in_profitability;
  }

  const response = await apiClient.post("/projects", { project: projectData });
  const project = response.project;

  return [
    `Project created successfully!`,
    `  Name: ${project.name}`,
    `  URL: ${project.url}`,
    `  Contact: ${project.contact}`,
    `  Status: ${project.status}`,
    `  Budget: ${project.budget} ${project.budget_units}`,
    `  Currency: ${project.currency}`,
  ].join("\n");
}
