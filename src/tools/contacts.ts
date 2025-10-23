/**
 * Contact Management Tools for FreeAgent
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentContact } from "../types.js";
import {
  formatDate,
  formatContactName,
  formatResponse,
  truncateIfNeeded,
  createPaginationMetadata,
  extractIdFromUrl
} from "../services/formatter.js";
import { ResponseFormat } from "../constants.js";
import type {
  ListContactsInput,
  GetContactInput,
  CreateContactInput
} from "../schemas/index.js";

/**
 * List all contacts with pagination
 */
export async function listContacts(
  client: FreeAgentApiClient,
  params: ListContactsInput
): Promise<string> {
  const queryParams: Record<string, any> = {
    page: params.page,
    per_page: params.per_page
  };

  if (params.sort) {
    queryParams.sort = params.sort;
  }

  const response = await client.get<{ contacts: FreeAgentContact[] }>(
    "/contacts",
    queryParams
  );

  const contacts = response.contacts || [];
  const pagination = client.parsePaginationHeaders(
    (response as any).headers || {}
  );

  // Format response
  const formattedResponse = formatResponse(
    {
      contacts,
      pagination: {
        page: params.page,
        per_page: params.per_page,
        total_count: pagination.totalCount,
        has_more: pagination.hasMore,
        next_page: pagination.nextPage
      }
    },
    params.response_format,
    () => {
      const lines: string[] = ["# FreeAgent Contacts", ""];

      if (pagination.totalCount !== undefined) {
        lines.push(
          createPaginationMetadata({
            page: params.page,
            perPage: params.per_page,
            totalCount: pagination.totalCount,
            hasMore: pagination.hasMore,
            nextPage: pagination.nextPage
          })
        );
        lines.push("");
      }

      if (contacts.length === 0) {
        lines.push("No contacts found.");
        return lines.join("\n");
      }

      for (const contact of contacts) {
        const name = formatContactName(contact);
        const id = extractIdFromUrl(contact.url);

        lines.push(`## ${name} (ID: ${id})`);
        
        if (contact.email) {
          lines.push(`- **Email**: ${contact.email}`);
        }
        
        if (contact.phone_number) {
          lines.push(`- **Phone**: ${contact.phone_number}`);
        }
        
        if (contact.organisation_name) {
          lines.push(`- **Organisation**: ${contact.organisation_name}`);
        }
        
        if (contact.active_projects_count !== undefined) {
          lines.push(`- **Active Projects**: ${contact.active_projects_count}`);
        }
        
        lines.push(`- **URL**: ${contact.url}`);
        lines.push("");
      }

      return lines.join("\n");
    }
  );

  return truncateIfNeeded(formattedResponse, {
    count: contacts.length,
    total: pagination.totalCount
  });
}

/**
 * Get a specific contact by ID
 */
export async function getContact(
  client: FreeAgentApiClient,
  params: GetContactInput
): Promise<string> {
  // Normalize contact ID - handle both numeric IDs and full URLs
  const endpoint = params.contact_id.startsWith("http")
    ? params.contact_id.replace(/^https?:\/\/[^\/]+\/v2/, "")
    : `/contacts/${params.contact_id}`;

  const response = await client.get<{ contact: FreeAgentContact }>(endpoint);
  const contact = response.contact;

  const formattedResponse = formatResponse(
    { contact },
    params.response_format,
    () => {
      const name = formatContactName(contact);
      const lines: string[] = [
        `# Contact: ${name}`,
        "",
        `**ID**: ${extractIdFromUrl(contact.url)}`,
        `**URL**: ${contact.url}`,
        ""
      ];

      if (contact.organisation_name) {
        lines.push(`**Organisation**: ${contact.organisation_name}`);
      }

      if (contact.first_name || contact.last_name) {
        lines.push(`**Name**: ${[contact.first_name, contact.last_name].filter(Boolean).join(" ")}`);
      }

      lines.push("");
      lines.push("## Contact Details");
      
      if (contact.email) {
        lines.push(`- **Email**: ${contact.email}`);
      }
      
      if (contact.phone_number) {
        lines.push(`- **Phone**: ${contact.phone_number}`);
      }
      
      if (contact.mobile) {
        lines.push(`- **Mobile**: ${contact.mobile}`);
      }

      if (contact.address1 || contact.town || contact.postcode) {
        lines.push("");
        lines.push("## Address");
        if (contact.address1) lines.push(`- ${contact.address1}`);
        if (contact.address2) lines.push(`- ${contact.address2}`);
        if (contact.address3) lines.push(`- ${contact.address3}`);
        if (contact.town) lines.push(`- ${contact.town}`);
        if (contact.region) lines.push(`- ${contact.region}`);
        if (contact.postcode) lines.push(`- ${contact.postcode}`);
        if (contact.country) lines.push(`- ${contact.country}`);
      }

      lines.push("");
      lines.push("## Additional Information");
      
      if (contact.default_payment_terms_in_days !== undefined) {
        lines.push(`- **Default Payment Terms**: ${contact.default_payment_terms_in_days} days`);
      }
      
      if (contact.charge_sales_tax) {
        lines.push(`- **Charge Sales Tax**: ${contact.charge_sales_tax}`);
      }
      
      if (contact.active_projects_count !== undefined) {
        lines.push(`- **Active Projects**: ${contact.active_projects_count}`);
      }
      
      if (contact.created_at) {
        lines.push(`- **Created**: ${formatDate(contact.created_at)}`);
      }
      
      if (contact.updated_at) {
        lines.push(`- **Updated**: ${formatDate(contact.updated_at)}`);
      }

      return lines.join("\n");
    }
  );

  return formattedResponse;
}

/**
 * Create a new contact
 */
export async function createContact(
  client: FreeAgentApiClient,
  params: CreateContactInput
): Promise<string> {
  const response = await client.post<{ contact: FreeAgentContact }>(
    "/contacts",
    { contact: params }
  );

  const contact = response.contact;
  const name = formatContactName(contact);

  return `✅ Contact created successfully: ${name} (ID: ${extractIdFromUrl(contact.url)})\n\nURL: ${contact.url}`;
}
