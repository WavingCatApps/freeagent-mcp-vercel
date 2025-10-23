/**
 * Expense Management Tools
 *
 * Tools for listing, viewing, and creating expenses (including mileage)
 * with support for file attachments.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type {
  ListExpensesInput,
  GetExpenseInput,
  CreateExpenseInput
} from "../schemas/index.js";
import { ResponseFormat } from "../constants.js";
import {
  formatResponse,
  createPaginationMetadata,
  extractIdFromUrl
} from "../services/formatter.js";

/**
 * List expenses with optional filtering and pagination
 */
export async function listExpenses(
  client: FreeAgentApiClient,
  params: ListExpensesInput
): Promise<string> {
  const { page, per_page, view, from_date, to_date, response_format } = params;

  // Build query parameters
  const queryParams: Record<string, string> = {
    page: page.toString(),
    per_page: per_page.toString()
  };

  if (view) queryParams.view = view;
  if (from_date) queryParams.from_date = from_date;
  if (to_date) queryParams.to_date = to_date;

  const response = await client.get<{ expenses: any[] }>(
    "/expenses",
    queryParams
  );
  const expenses = response.expenses || [];
  const pagination = client.parsePaginationHeaders(
    (response as any).headers || {}
  );

  // Format response
  return formatResponse(
    {
      expenses: expenses.map((expense: any) => ({
        url: expense.url,
        user: expense.user,
        category: expense.category,
        dated_on: expense.dated_on,
        description: expense.description,
        gross_value: expense.gross_value,
        native_gross_value: expense.native_gross_value,
        currency: expense.currency,
        sales_tax_rate: expense.sales_tax_rate,
        ec_status: expense.ec_status,
        attachment_count: expense.attachment_count,
        project: expense.project,
        miles: expense.miles,
        vehicle_type: expense.vehicle_type
      })),
      pagination: {
        page,
        per_page,
        total_count: pagination.totalCount,
        has_more: pagination.hasMore,
        next_page: pagination.nextPage
      }
    },
    response_format,
    () => {
      const lines: string[] = ["# FreeAgent Expenses", ""];

      if (pagination.totalCount !== undefined) {
        lines.push(
          createPaginationMetadata({
            page,
            perPage: per_page,
            totalCount: pagination.totalCount,
            hasMore: pagination.hasMore,
            nextPage: pagination.nextPage
          })
        );
        lines.push("");
      }

      if (expenses.length === 0) {
        lines.push("No expenses found matching the criteria.");
        return lines.join("\n");
      }

      for (const expense of expenses) {
        const id = extractIdFromUrl(expense.url);
        const amount = `${expense.currency || 'GBP'} ${expense.gross_value}`;
        const desc = expense.description || 'No description';
        const attachments = expense.attachment_count > 0
          ? ` (${expense.attachment_count} attachment${expense.attachment_count > 1 ? 's' : ''})`
          : '';
        const mileage = expense.miles
          ? ` | ${expense.miles} miles (${expense.vehicle_type})`
          : '';

        lines.push(`## ${expense.dated_on} - ${amount} (ID: ${id})`);
        lines.push(`${desc}${mileage}${attachments}`);
        lines.push("");
      }

      return lines.join("\n");
    }
  );
}

/**
 * Get detailed information about a specific expense
 */
export async function getExpense(
  client: FreeAgentApiClient,
  params: GetExpenseInput
): Promise<string> {
  const { expense_id, response_format } = params;
  const expenseUrl = expense_id.startsWith('http')
    ? expense_id
    : `/expenses/${expense_id}`;

  const response = await client.get<{ expense: any }>(expenseUrl);
  const expense = response.expense;

  // Format response
  return formatResponse(
    expense,
    response_format,
    () => {
      const isMileage = expense.miles !== null && expense.miles !== undefined;
      const title = isMileage ? "Mileage Expense Details" : "Expense Details";
      const lines: string[] = [`# ${title}`, ""];

      lines.push(`- **Date**: ${expense.dated_on}`);
      lines.push(`- **Amount**: ${expense.currency || 'GBP'} ${expense.gross_value}`);
      lines.push(`- **Description**: ${expense.description || 'N/A'}`);
      lines.push(`- **User**: ${expense.user}`);
      lines.push(`- **Category**: ${expense.category}`);
      lines.push(`- **EC Status**: ${expense.ec_status || 'N/A'}`);

      if (isMileage) {
        lines.push(`- **Miles**: ${expense.miles}`);
        lines.push(`- **Vehicle Type**: ${expense.vehicle_type || 'N/A'}`);
        if (expense.initial_mileage) {
          lines.push(`- **Initial Mileage**: ${expense.initial_mileage}`);
        }
      }

      if (expense.project) {
        lines.push(`- **Project**: ${expense.project}`);
      }

      if (expense.sales_tax_rate) {
        lines.push(`- **Sales Tax Rate**: ${parseFloat(expense.sales_tax_rate) * 100}%`);
      }

      if (expense.attachment_count > 0) {
        lines.push(`- **Attachments**: ${expense.attachment_count} file(s)`);
      }

      lines.push("");
      lines.push(`- **Created**: ${expense.created_at}`);
      lines.push(`- **Updated**: ${expense.updated_at}`);

      return lines.join("\n");
    }
  );
}

/**
 * Create a new expense (including mileage expenses)
 */
export async function createExpense(
  client: FreeAgentApiClient,
  params: CreateExpenseInput
): Promise<string> {
  const isMileage = params.miles !== undefined;

  // Build expense payload
  const expensePayload: any = {
    user: params.user,
    category: params.category,
    dated_on: params.dated_on,
    ec_status: params.ec_status || "Non-EC"
  };

  // Add optional fields
  if (params.description) expensePayload.description = params.description;
  if (params.gross_value) expensePayload.gross_value = params.gross_value;
  if (params.sales_tax_rate) expensePayload.sales_tax_rate = params.sales_tax_rate;
  if (params.manual_sales_tax_amount) {
    expensePayload.manual_sales_tax_amount = params.manual_sales_tax_amount;
  }
  if (params.currency) expensePayload.currency = params.currency;
  if (params.project) expensePayload.project = params.project;

  // Mileage-specific fields
  if (isMileage) {
    expensePayload.miles = params.miles;
    if (params.mileage_vehicle_type) {
      expensePayload.vehicle_type = params.mileage_vehicle_type;
    }
    if (params.initial_mileage) {
      expensePayload.initial_mileage = params.initial_mileage;
    }
    if (params.mileage_type) {
      expensePayload.mileage_type = params.mileage_type;
    }
  }

  // Add attachment if provided
  if (params.attachment) {
    expensePayload.attachment = {
      data: params.attachment.data,
      file_name: params.attachment.file_name,
      content_type: params.attachment.content_type
    };
    if (params.attachment.description) {
      expensePayload.attachment.description = params.attachment.description;
    }
  }

  const response = await client.post<{ expense: any }>("/expenses", { expense: expensePayload });
  const expense = response.expense;
  const expenseId = extractIdFromUrl(expense.url);

  const type = isMileage ? "mileage expense" : "expense";
  const attachmentInfo = params.attachment ? ` with attachment (${params.attachment.file_name})` : '';

  return `✅ Successfully created ${type}${attachmentInfo}\n\n` +
    `**Expense ID**: ${expenseId}\n` +
    `**Date**: ${expense.dated_on}\n` +
    `**Amount**: ${expense.currency || 'GBP'} ${expense.gross_value}\n` +
    (isMileage ? `**Miles**: ${expense.miles}\n` : '') +
    `**URL**: ${expense.url}`;
}
