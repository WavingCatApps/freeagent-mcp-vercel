/**
 * Zod Validation Schemas for FreeAgent MCP Tools
 */

import { z } from "zod";
import { ResponseFormat, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";

// Base pagination schema
export const PaginationSchema = z.object({
  page: z.number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for pagination (starts at 1)"),
  per_page: z.number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Number of items per page (max ${MAX_PAGE_SIZE})`)
}).strict();

// Response format schema
export const ResponseFormatSchema = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

// Contact schemas
export const ListContactsInputSchema = z.object({
  page: PaginationSchema.shape.page,
  per_page: PaginationSchema.shape.per_page,
  sort: z.enum(["created_at", "updated_at", "first_name", "last_name", "organisation_name"])
    .optional()
    .describe("Field to sort by"),
  response_format: ResponseFormatSchema
}).strict();

export const GetContactInputSchema = z.object({
  contact_id: z.string()
    .min(1)
    .describe("The FreeAgent contact ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

export const CreateContactInputSchema = z.object({
  first_name: z.string().optional().describe("Contact's first name"),
  last_name: z.string().optional().describe("Contact's last name"),
  organisation_name: z.string().optional().describe("Organisation name"),
  email: z.string().email().optional().describe("Email address"),
  phone_number: z.string().optional().describe("Phone number"),
  mobile: z.string().optional().describe("Mobile number"),
  address1: z.string().optional().describe("Address line 1"),
  town: z.string().optional().describe("Town/City"),
  postcode: z.string().optional().describe("Postal code"),
  country: z.string().optional().describe("Country code (e.g., GB, US)")
}).strict();

// Invoice schemas
export const ListInvoicesInputSchema = z.object({
  page: PaginationSchema.shape.page,
  per_page: PaginationSchema.shape.per_page,
  view: z.enum(["all", "recent_open_or_overdue", "draft", "scheduled", "sent", "overdue"])
    .optional()
    .describe("Filter invoices by status view"),
  contact: z.string().optional().describe("Filter by contact URL or ID"),
  project: z.string().optional().describe("Filter by project URL or ID"),
  sort: z.enum(["created_at", "updated_at", "dated_on", "due_on"])
    .optional()
    .describe("Field to sort by (prefix with '-' for descending)"),
  response_format: ResponseFormatSchema
}).strict();

export const GetInvoiceInputSchema = z.object({
  invoice_id: z.string()
    .min(1)
    .describe("The FreeAgent invoice ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

export const CreateInvoiceInputSchema = z.object({
  contact: z.string()
    .min(1)
    .describe("Contact URL or ID to invoice"),
  dated_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Invoice date in YYYY-MM-DD format"),
  due_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Due date in YYYY-MM-DD format"),
  reference: z.string().optional().describe("Invoice reference number"),
  currency: z.string()
    .length(3)
    .default("GBP")
    .describe("Currency code (e.g., GBP, USD, EUR)"),
  comments: z.string().optional().describe("Comments for the invoice"),
  payment_terms_in_days: z.number().int().optional().describe("Payment terms in days"),
  invoice_items: z.array(z.object({
    item_type: z.string().describe("Item type (e.g., 'Hours', 'Days', 'Products')"),
    description: z.string().describe("Item description"),
    price: z.string().describe("Price per unit"),
    quantity: z.string().describe("Quantity")
  })).min(1).describe("Array of invoice line items")
}).strict();

// Expense schemas
export const ListExpensesInputSchema = z.object({
  page: PaginationSchema.shape.page,
  per_page: PaginationSchema.shape.per_page,
  view: z.enum(["recent", "awaiting_receipt", "all"])
    .optional()
    .describe("Filter expenses by view"),
  from_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter expenses from this date (YYYY-MM-DD)"),
  to_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter expenses to this date (YYYY-MM-DD)"),
  response_format: ResponseFormatSchema
}).strict();

export const GetExpenseInputSchema = z.object({
  expense_id: z.string()
    .min(1)
    .describe("The FreeAgent expense ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

// Attachment schema for expenses and timeslips
const AttachmentSchema = z.object({
  data: z.string().describe("Base64 encoded file content"),
  file_name: z.string().describe("Original filename"),
  content_type: z.enum(["application/pdf", "image/png", "image/jpeg", "image/gif"])
    .describe("MIME type of the file"),
  description: z.string().optional().describe("Optional description of the attachment")
}).strict();

export const CreateExpenseInputSchema = z.object({
  user: z.string()
    .min(1)
    .describe("User URL or ID who incurred the expense"),
  category: z.string()
    .min(1)
    .describe("Expense category URL or ID"),
  dated_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Date of expense in YYYY-MM-DD format"),
  description: z.string()
    .optional()
    .describe("Description of the expense"),
  gross_value: z.string()
    .optional()
    .describe("Total amount including tax (decimal string)"),
  sales_tax_rate: z.string()
    .optional()
    .describe("Sales tax rate as decimal (e.g., '0.20' for 20%)"),
  manual_sales_tax_amount: z.string()
    .optional()
    .describe("Manual sales tax amount (overrides sales_tax_rate)"),
  currency: z.string()
    .length(3)
    .optional()
    .describe("Currency code (e.g., GBP, USD, EUR)"),
  ec_status: z.enum(["EC Services", "EC Goods", "Non-EC"])
    .optional()
    .describe("EC (European Community) status for the expense"),
  receipt_reference: z.string()
    .optional()
    .describe("Receipt reference identifier"),
  attachment: AttachmentSchema
    .optional()
    .describe("File attachment (receipt) for the expense"),
  project: z.string()
    .optional()
    .describe("Project URL or ID to associate with expense"),
  // Recurring expense fields
  recurring: z.enum(["Weekly", "Two Weekly", "Four Weekly", "Two Monthly", "Quarterly", "Biannually", "Annually", "2-Yearly"])
    .optional()
    .describe("Recurring frequency for repeating expenses"),
  next_recurs_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Next recurrence date in YYYY-MM-DD format (for recurring expenses)"),
  recurring_end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("End date for recurring expenses in YYYY-MM-DD format"),
  // Mileage-specific fields
  mileage_vehicle_type: z.enum(["Car", "Motorcycle", "Bicycle"])
    .optional()
    .describe("Vehicle type for mileage expenses (API field: vehicle_type)"),
  miles: z.string()
    .optional()
    .describe("Distance traveled in miles (decimal string) (API field: mileage)"),
  initial_mileage: z.string()
    .optional()
    .describe("Starting odometer reading"),
  mileage_type: z.enum(["Business", "Personal"])
    .optional()
    .describe("Type of mileage"),
  engine_type: z.enum(["Petrol", "Diesel", "LPG", "Electric", "Electric (Home charger)", "Electric (Public charger)"])
    .optional()
    .describe("Engine type for mileage expenses (affects rate calculation)"),
  engine_size: z.string()
    .optional()
    .describe("Engine size (depends on engine_type selection)"),
  reclaim_mileage: z.number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .describe("Mileage reclaim method: 0 = rebill only (default), 1 = AMAP rate")
}).strict();

export const UpdateExpenseInputSchema = z.object({
  expense_id: z.string()
    .min(1)
    .describe("The FreeAgent expense ID (numeric) or full URL"),
  user: z.string()
    .optional()
    .describe("User URL or ID who incurred the expense"),
  category: z.string()
    .optional()
    .describe("Expense category URL or ID"),
  dated_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Date of expense in YYYY-MM-DD format"),
  description: z.string()
    .optional()
    .describe("Description of the expense"),
  gross_value: z.string()
    .optional()
    .describe("Total amount including tax (decimal string)"),
  sales_tax_rate: z.string()
    .optional()
    .describe("Sales tax rate as decimal (e.g., '0.20' for 20%)"),
  manual_sales_tax_amount: z.string()
    .optional()
    .describe("Manual sales tax amount (overrides sales_tax_rate)"),
  currency: z.string()
    .length(3)
    .optional()
    .describe("Currency code (e.g., GBP, USD, EUR)"),
  ec_status: z.enum(["EC Services", "EC Goods", "Non-EC"])
    .optional()
    .describe("EC (European Community) status for the expense"),
  receipt_reference: z.string()
    .optional()
    .describe("Receipt reference identifier"),
  project: z.string()
    .optional()
    .describe("Project URL or ID to associate with expense"),
  // Recurring expense fields
  recurring: z.enum(["Weekly", "Two Weekly", "Four Weekly", "Two Monthly", "Quarterly", "Biannually", "Annually", "2-Yearly"])
    .optional()
    .describe("Recurring frequency for repeating expenses"),
  next_recurs_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Next recurrence date in YYYY-MM-DD format (for recurring expenses)"),
  recurring_end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("End date for recurring expenses in YYYY-MM-DD format"),
  // Mileage-specific fields
  mileage_vehicle_type: z.enum(["Car", "Motorcycle", "Bicycle"])
    .optional()
    .describe("Vehicle type for mileage expenses (API field: vehicle_type)"),
  miles: z.string()
    .optional()
    .describe("Distance traveled in miles (decimal string) (API field: mileage)"),
  initial_mileage: z.string()
    .optional()
    .describe("Starting odometer reading"),
  mileage_type: z.enum(["Business", "Personal"])
    .optional()
    .describe("Type of mileage"),
  engine_type: z.enum(["Petrol", "Diesel", "LPG", "Electric", "Electric (Home charger)", "Electric (Public charger)"])
    .optional()
    .describe("Engine type for mileage expenses (affects rate calculation)"),
  engine_size: z.string()
    .optional()
    .describe("Engine size (depends on engine_type selection)"),
  reclaim_mileage: z.number()
    .int()
    .min(0)
    .max(1)
    .optional()
    .describe("Mileage reclaim method: 0 = rebill only (default), 1 = AMAP rate")
}).strict();

// Project schemas
export const ListProjectsInputSchema = z.object({
  page: PaginationSchema.shape.page,
  per_page: PaginationSchema.shape.per_page,
  view: z.enum(["active", "completed", "cancelled", "all"])
    .optional()
    .describe("Filter projects by status"),
  contact: z.string().optional().describe("Filter by contact URL or ID"),
  response_format: ResponseFormatSchema
}).strict();

export const GetProjectInputSchema = z.object({
  project_id: z.string()
    .min(1)
    .describe("The FreeAgent project ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

export const CreateProjectInputSchema = z.object({
  contact: z.string()
    .min(1)
    .describe("Contact URL or ID this project is for"),
  name: z.string()
    .min(1)
    .describe("Name of the project"),
  budget: z.string()
    .describe("Budget amount (decimal string)"),
  budget_units: z.enum(["Hours", "Days", "Monetary"])
    .describe("Units for the budget"),
  status: z.enum(["Active", "Completed", "Cancelled", "Hidden"])
    .default("Active")
    .describe("Status of the project"),
  currency: z.string()
    .length(3)
    .default("GBP")
    .describe("Currency code (e.g., GBP, USD, EUR)"),
  uses_project_invoice_sequence: z.boolean()
    .default(false)
    .describe("Use project-specific invoice numbering"),
  is_ir35: z.boolean()
    .default(false)
    .describe("Whether project is subject to IR35"),
  contract_po_reference: z.string()
    .optional()
    .describe("Purchase order reference"),
  starts_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Project start date (YYYY-MM-DD)"),
  ends_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Project end date (YYYY-MM-DD)"),
  normal_billing_rate: z.string()
    .optional()
    .describe("Billing rate (decimal string)"),
  billing_period: z.enum(["hour", "day"])
    .optional()
    .describe("Billing period"),
  hours_per_day: z.string()
    .default("8")
    .describe("Hours per working day (decimal string)"),
  include_unbilled_time_in_profitability: z.boolean()
    .optional()
    .describe("Include unbilled time in profit calculations")
}).strict();

// Task schemas
export const ListTasksInputSchema = z.object({
  page: PaginationSchema.shape.page,
  per_page: PaginationSchema.shape.per_page,
  view: z.enum(["active", "completed", "hidden", "all"])
    .optional()
    .describe("Filter tasks by status"),
  project: z.string()
    .optional()
    .describe("Filter by project URL or ID"),
  updated_since: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    .optional()
    .describe("Filter tasks updated since this timestamp (ISO 8601)"),
  sort: z.enum(["name", "project", "billing_rate", "created_at", "updated_at"])
    .optional()
    .describe("Field to sort by"),
  response_format: ResponseFormatSchema
}).strict();

export const GetTaskInputSchema = z.object({
  task_id: z.string()
    .min(1)
    .describe("The FreeAgent task ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

export const CreateTaskInputSchema = z.object({
  project: z.string()
    .min(1)
    .describe("Project URL or ID this task belongs to"),
  name: z.string()
    .min(1)
    .describe("Name of the task"),
  is_billable: z.boolean()
    .default(true)
    .describe("Whether this task is billable"),
  status: z.enum(["Active", "Completed", "Hidden"])
    .default("Active")
    .describe("Status of the task"),
  billing_rate: z.string()
    .optional()
    .describe("Billing rate (decimal string)"),
  billing_period: z.enum(["hour", "day"])
    .optional()
    .describe("Billing period (hour or day)")
}).strict();

// Category schemas
export const ListCategoriesInputSchema = z.object({
  view: z.enum(["all", "standard", "custom"])
    .optional()
    .describe("Filter categories by type (all, standard system categories, or custom user-created)"),
  response_format: ResponseFormatSchema
}).strict();

export const GetCategoryInputSchema = z.object({
  nominal_code: z.string()
    .min(1)
    .describe("The FreeAgent category nominal code or full URL"),
  response_format: ResponseFormatSchema
}).strict();

// Bank account schemas
export const ListBankAccountsInputSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export const GetBankAccountInputSchema = z.object({
  bank_account_id: z.string()
    .min(1)
    .describe("The FreeAgent bank account ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

// Bank transaction schemas
export const ListBankTransactionsInputSchema = z.object({
  bank_account: z.string()
    .min(1)
    .describe("Bank account URL or ID to list transactions for"),
  page: PaginationSchema.shape.page,
  per_page: PaginationSchema.shape.per_page,
  from_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter transactions from this date (YYYY-MM-DD)"),
  to_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter transactions to this date (YYYY-MM-DD)"),
  view: z.enum(["all", "unexplained"])
    .optional()
    .describe("Filter transactions by view"),
  response_format: ResponseFormatSchema
}).strict();

export const GetBankTransactionInputSchema = z.object({
  bank_transaction_id: z.string()
    .min(1)
    .describe("The FreeAgent bank transaction ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

// Timeslip schemas
export const ListTimeslipsInputSchema = z.object({
  page: PaginationSchema.shape.page,
  per_page: PaginationSchema.shape.per_page,
  from_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter timeslips from this date (YYYY-MM-DD)"),
  to_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter timeslips to this date (YYYY-MM-DD)"),
  view: z.enum(["all", "unbilled", "running"])
    .optional()
    .describe("Filter timeslips by view"),
  user: z.string()
    .optional()
    .describe("Filter by user URL or ID"),
  project: z.string()
    .optional()
    .describe("Filter by project URL or ID"),
  response_format: ResponseFormatSchema
}).strict();

export const GetTimeslipInputSchema = z.object({
  timeslip_id: z.string()
    .min(1)
    .describe("The FreeAgent timeslip ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

export const CreateTimeslipInputSchema = z.object({
  task: z.string()
    .min(1)
    .describe("Task URL or ID"),
  user: z.string()
    .min(1)
    .describe("User URL or ID who performed the work"),
  project: z.string()
    .min(1)
    .describe("Project URL or ID"),
  dated_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Date of work in YYYY-MM-DD format"),
  hours: z.string()
    .describe("Hours worked (decimal string, e.g., '7.5')"),
  comment: z.string()
    .optional()
    .describe("Description or comment about the work performed"),
  attachment: AttachmentSchema
    .optional()
    .describe("Optional file attachment for the timeslip")
}).strict();

// Bank transaction explanation schemas
export const ListBankTransactionExplanationsInputSchema = z.object({
  bank_account: z.string()
    .optional()
    .describe("Filter by bank account URL or ID"),
  from_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter explanations from this date (YYYY-MM-DD)"),
  to_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Filter explanations to this date (YYYY-MM-DD)"),
  page: PaginationSchema.shape.page,
  per_page: PaginationSchema.shape.per_page,
  response_format: ResponseFormatSchema
}).strict();

export const GetBankTransactionExplanationInputSchema = z.object({
  bank_transaction_explanation_id: z.string()
    .min(1)
    .describe("The FreeAgent bank transaction explanation ID (numeric) or full URL"),
  response_format: ResponseFormatSchema
}).strict();

export const CreateBankTransactionExplanationInputSchema = z.object({
  bank_transaction: z.string()
    .min(1)
    .describe("Bank transaction URL or ID to explain"),
  dated_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Transaction date in YYYY-MM-DD format"),
  description: z.string()
    .optional()
    .describe("Description of the transaction"),
  gross_value: z.string()
    .describe("Transaction amount (decimal string, negative for debits)"),
  category: z.string()
    .optional()
    .describe("Category URL or ID for the transaction"),
  ec_status: z.enum(["UK/Non-EC", "EC Goods", "EC Services", "Reverse Charge", "EC VAT MOSS"])
    .optional()
    .describe("EC (European Community) status for the transaction (Note: EC Goods and EC Services invalid for transactions dated 2021-01-01+ in Great Britain)"),
  marked_for_review: z.boolean()
    .optional()
    .describe("Whether the explanation is marked for review (true if guessed/awaiting approval, false otherwise)"),
  receipt_reference: z.string()
    .optional()
    .describe("Reference identifier for the receipt or transaction"),
  // Link to other entities
  paid_invoice: z.string()
    .optional()
    .describe("Invoice URL or ID that this transaction pays"),
  paid_bill: z.string()
    .optional()
    .describe("Bill URL or ID that this transaction pays"),
  paid_user: z.string()
    .optional()
    .describe("User URL or ID for money paid to/from user"),
  project: z.string()
    .optional()
    .describe("Project URL or ID to associate with transaction"),
  // Tax information
  sales_tax_rate: z.string()
    .optional()
    .describe("Sales tax rate as decimal (e.g., '0.20' for 20%)"),
  sales_tax_value: z.string()
    .optional()
    .describe("Sales tax amount"),
  // Transfer information
  transfer_bank_account: z.string()
    .optional()
    .describe("Destination bank account URL or ID for transfers"),
  // Attachment
  attachment: AttachmentSchema
    .optional()
    .describe("Optional file attachment for the explanation")
}).strict();

export const UpdateBankTransactionExplanationInputSchema = z.object({
  bank_transaction_explanation_id: z.string()
    .min(1)
    .describe("The FreeAgent bank transaction explanation ID (numeric) or full URL"),
  dated_on: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Transaction date in YYYY-MM-DD format"),
  description: z.string()
    .optional()
    .describe("Description of the transaction"),
  gross_value: z.string()
    .optional()
    .describe("Transaction amount (decimal string, negative for debits)"),
  category: z.string()
    .optional()
    .describe("Category URL or ID for the transaction"),
  ec_status: z.enum(["UK/Non-EC", "EC Goods", "EC Services", "Reverse Charge", "EC VAT MOSS"])
    .optional()
    .describe("EC (European Community) status for the transaction (Note: EC Goods and EC Services invalid for transactions dated 2021-01-01+ in Great Britain)"),
  marked_for_review: z.boolean()
    .optional()
    .describe("Whether the explanation is marked for review (true if guessed/awaiting approval, false otherwise)"),
  receipt_reference: z.string()
    .optional()
    .describe("Reference identifier for the receipt or transaction"),
  // Link to other entities
  paid_invoice: z.string()
    .optional()
    .describe("Invoice URL or ID that this transaction pays"),
  paid_bill: z.string()
    .optional()
    .describe("Bill URL or ID that this transaction pays"),
  paid_user: z.string()
    .optional()
    .describe("User URL or ID for money paid to/from user"),
  project: z.string()
    .optional()
    .describe("Project URL or ID to associate with transaction"),
  // Tax information
  sales_tax_rate: z.string()
    .optional()
    .describe("Sales tax rate as decimal (e.g., '0.20' for 20%)"),
  sales_tax_value: z.string()
    .optional()
    .describe("Sales tax amount"),
  // Transfer information
  transfer_bank_account: z.string()
    .optional()
    .describe("Destination bank account URL or ID for transfers")
}).strict();

// Company schema
export const GetCompanyInputSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

// User schemas
export const ListUsersInputSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

// Type exports
export type ListContactsInput = z.infer<typeof ListContactsInputSchema>;
export type GetContactInput = z.infer<typeof GetContactInputSchema>;
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;
export type ListInvoicesInput = z.infer<typeof ListInvoicesInputSchema>;
export type GetInvoiceInput = z.infer<typeof GetInvoiceInputSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;
export type ListExpensesInput = z.infer<typeof ListExpensesInputSchema>;
export type GetExpenseInput = z.infer<typeof GetExpenseInputSchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseInputSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInputSchema>;
export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;
export type GetProjectInput = z.infer<typeof GetProjectInputSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type ListTasksInput = z.infer<typeof ListTasksInputSchema>;
export type GetTaskInput = z.infer<typeof GetTaskInputSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type ListCategoriesInput = z.infer<typeof ListCategoriesInputSchema>;
export type GetCategoryInput = z.infer<typeof GetCategoryInputSchema>;
export type ListBankAccountsInput = z.infer<typeof ListBankAccountsInputSchema>;
export type GetBankAccountInput = z.infer<typeof GetBankAccountInputSchema>;
export type ListBankTransactionsInput = z.infer<typeof ListBankTransactionsInputSchema>;
export type GetBankTransactionInput = z.infer<typeof GetBankTransactionInputSchema>;
export type ListTimeslipsInput = z.infer<typeof ListTimeslipsInputSchema>;
export type GetTimeslipInput = z.infer<typeof GetTimeslipInputSchema>;
export type CreateTimeslipInput = z.infer<typeof CreateTimeslipInputSchema>;
export type ListBankTransactionExplanationsInput = z.infer<typeof ListBankTransactionExplanationsInputSchema>;
export type GetBankTransactionExplanationInput = z.infer<typeof GetBankTransactionExplanationInputSchema>;
export type CreateBankTransactionExplanationInput = z.infer<typeof CreateBankTransactionExplanationInputSchema>;
export type UpdateBankTransactionExplanationInput = z.infer<typeof UpdateBankTransactionExplanationInputSchema>;
export type GetCompanyInput = z.infer<typeof GetCompanyInputSchema>;
export type ListUsersInput = z.infer<typeof ListUsersInputSchema>;
