/**
 * Invoice Management Tools for FreeAgent
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentInvoice } from "../types.js";
import {
  formatDate,
  formatCurrency,
  formatResponse,
  truncateIfNeeded,
  createPaginationMetadata,
  extractIdFromUrl
} from "../services/formatter.js";
import type {
  ListInvoicesInput,
  GetInvoiceInput,
  CreateInvoiceInput
} from "../schemas/index.js";

/**
 * List invoices with pagination and filters
 */
export async function listInvoices(
  client: FreeAgentApiClient,
  params: ListInvoicesInput
): Promise<string> {
  const queryParams: Record<string, any> = {
    page: params.page,
    per_page: params.per_page
  };

  if (params.view) {
    queryParams.view = params.view;
  }

  if (params.contact) {
    // Normalize contact parameter
    queryParams.contact = params.contact.startsWith("http")
      ? params.contact
      : `https://api.freeagent.com/v2/contacts/${params.contact}`;
  }

  if (params.project) {
    // Normalize project parameter
    queryParams.project = params.project.startsWith("http")
      ? params.project
      : `https://api.freeagent.com/v2/projects/${params.project}`;
  }

  if (params.sort) {
    queryParams.sort = params.sort;
  }

  const response = await client.get<{ invoices: FreeAgentInvoice[] }>(
    "/invoices",
    queryParams
  );

  const invoices = response.invoices || [];
  const pagination = client.parsePaginationHeaders(
    (response as any).headers || {}
  );

  const formattedResponse = formatResponse(
    {
      invoices,
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
      const lines: string[] = ["# FreeAgent Invoices", ""];

      if (params.view) {
        lines.push(`**View**: ${params.view}`, "");
      }

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

      if (invoices.length === 0) {
        lines.push("No invoices found.");
        return lines.join("\n");
      }

      for (const invoice of invoices) {
        const id = extractIdFromUrl(invoice.url);
        const ref = invoice.reference || id;

        lines.push(`## Invoice ${ref} (ID: ${id})`);
        lines.push(`- **Status**: ${invoice.status}`);
        lines.push(`- **Date**: ${formatDate(invoice.dated_on)}`);
        
        if (invoice.due_on) {
          lines.push(`- **Due**: ${formatDate(invoice.due_on)}`);
        }
        
        lines.push(`- **Total**: ${formatCurrency(invoice.total_value, invoice.currency)}`);
        
        if (invoice.due_value && parseFloat(invoice.due_value) > 0) {
          lines.push(`- **Amount Due**: ${formatCurrency(invoice.due_value, invoice.currency)}`);
        }
        
        if (invoice.paid_value && parseFloat(invoice.paid_value) > 0) {
          lines.push(`- **Paid**: ${formatCurrency(invoice.paid_value, invoice.currency)}`);
        }
        
        lines.push(`- **Contact**: ${extractIdFromUrl(invoice.contact)}`);
        lines.push(`- **URL**: ${invoice.url}`);
        lines.push("");
      }

      return lines.join("\n");
    }
  );

  return truncateIfNeeded(formattedResponse, {
    count: invoices.length,
    total: pagination.totalCount
  });
}

/**
 * Get a specific invoice by ID
 */
export async function getInvoice(
  client: FreeAgentApiClient,
  params: GetInvoiceInput
): Promise<string> {
  // Normalize invoice ID
  const endpoint = params.invoice_id.startsWith("http")
    ? params.invoice_id.replace(/^https?:\/\/[^\/]+\/v2/, "")
    : `/invoices/${params.invoice_id}`;

  const response = await client.get<{ invoice: FreeAgentInvoice }>(endpoint);
  const invoice = response.invoice;

  const formattedResponse = formatResponse(
    { invoice },
    params.response_format,
    () => {
      const id = extractIdFromUrl(invoice.url);
      const ref = invoice.reference || id;

      const lines: string[] = [
        `# Invoice: ${ref}`,
        "",
        `**ID**: ${id}`,
        `**Status**: ${invoice.status}`,
        `**URL**: ${invoice.url}`,
        ""
      ];

      lines.push("## Details");
      lines.push(`- **Date**: ${formatDate(invoice.dated_on)}`);
      
      if (invoice.due_on) {
        lines.push(`- **Due Date**: ${formatDate(invoice.due_on)}`);
      }
      
      if (invoice.payment_terms_in_days) {
        lines.push(`- **Payment Terms**: ${invoice.payment_terms_in_days} days`);
      }
      
      lines.push(`- **Currency**: ${invoice.currency}`);
      
      if (invoice.exchange_rate && invoice.exchange_rate !== "1.0") {
        lines.push(`- **Exchange Rate**: ${invoice.exchange_rate}`);
      }

      lines.push("");
      lines.push("## Amounts");
      lines.push(`- **Net Value**: ${formatCurrency(invoice.net_value, invoice.currency)}`);
      lines.push(`- **Sales Tax**: ${formatCurrency(invoice.sales_tax_value, invoice.currency)}`);
      lines.push(`- **Total Value**: ${formatCurrency(invoice.total_value, invoice.currency)}`);
      
      if (invoice.discount_percent && parseFloat(invoice.discount_percent) > 0) {
        lines.push(`- **Discount**: ${invoice.discount_percent}%`);
      }
      
      if (invoice.paid_value && parseFloat(invoice.paid_value) > 0) {
        lines.push(`- **Paid**: ${formatCurrency(invoice.paid_value, invoice.currency)}`);
      }
      
      if (invoice.due_value) {
        lines.push(`- **Amount Due**: ${formatCurrency(invoice.due_value, invoice.currency)}`);
      }

      lines.push("");
      lines.push("## Related");
      lines.push(`- **Contact**: ${invoice.contact}`);
      
      if (invoice.project) {
        lines.push(`- **Project**: ${invoice.project}`);
      }

      if (invoice.invoice_items && invoice.invoice_items.length > 0) {
        lines.push("");
        lines.push("## Line Items");
        
        for (const item of invoice.invoice_items) {
          lines.push(`- **${item.description}**`);
          lines.push(`  - Type: ${item.item_type}`);
          lines.push(`  - Quantity: ${item.quantity}`);
          lines.push(`  - Price: ${formatCurrency(item.price, invoice.currency)}`);
          
          const itemTotal = parseFloat(item.quantity) * parseFloat(item.price);
          lines.push(`  - Total: ${formatCurrency(itemTotal.toString(), invoice.currency)}`);
        }
      }

      if (invoice.comments) {
        lines.push("");
        lines.push("## Comments");
        lines.push(invoice.comments);
      }

      if (invoice.created_at || invoice.updated_at) {
        lines.push("");
        lines.push("## Timestamps");
        if (invoice.created_at) {
          lines.push(`- **Created**: ${formatDate(invoice.created_at)}`);
        }
        if (invoice.updated_at) {
          lines.push(`- **Updated**: ${formatDate(invoice.updated_at)}`);
        }
      }

      return lines.join("\n");
    }
  );

  return formattedResponse;
}

/**
 * Create a new invoice
 */
export async function createInvoice(
  client: FreeAgentApiClient,
  params: CreateInvoiceInput
): Promise<string> {
  // Normalize contact URL
  const contact = params.contact.startsWith("http")
    ? params.contact
    : `https://api.freeagent.com/v2/contacts/${params.contact}`;

  const invoiceData: any = {
    contact,
    dated_on: params.dated_on,
    currency: params.currency,
    invoice_items: params.invoice_items
  };

  if (params.due_on) {
    invoiceData.due_on = params.due_on;
  }

  if (params.reference) {
    invoiceData.reference = params.reference;
  }

  if (params.comments) {
    invoiceData.comments = params.comments;
  }

  if (params.payment_terms_in_days !== undefined) {
    invoiceData.payment_terms_in_days = params.payment_terms_in_days;
  }

  const response = await client.post<{ invoice: FreeAgentInvoice }>(
    "/invoices",
    { invoice: invoiceData }
  );

  const invoice = response.invoice;
  const id = extractIdFromUrl(invoice.url);
  const ref = invoice.reference || id;

  return (
    `✅ Invoice created successfully: ${ref} (ID: ${id})\n\n` +
    `Status: ${invoice.status}\n` +
    `Total: ${formatCurrency(invoice.total_value, invoice.currency)}\n` +
    `URL: ${invoice.url}\n\n` +
    `Note: Invoice is created in Draft status. Use status transition endpoints to mark as Sent.`
  );
}
