/**
 * Additional FreeAgent tool schemas covering API gaps.
 *
 * Intentionally omitted from this expansion:
 * - Timeslip timers (poor MCP fit)
 * - Binary PDF download tools (no efficient agentic binary channel yet)
 * - File-based bank statement upload (JSON statement lines are supported instead)
 */

import { z } from "zod";
import { ResponseFormat, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";

const ResponseFormatSchema = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

const page = z.number().int().min(1).default(1).describe("Page number for pagination (starts at 1)");
const per_page = z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
  .describe(`Number of items per page (max ${MAX_PAGE_SIZE})`);

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format");
const IdOrUrl = (label: string) =>
  z.string().min(1).describe(`${label} ID (numeric) or full FreeAgent URL`);

// ---------- Existing-resource CRUD fillers ----------

export const UpdateContactInputSchema = z.object({
  contact_id: IdOrUrl("Contact"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  organisation_name: z.string().optional(),
  email: z.string().email().optional(),
  phone_number: z.string().optional(),
  mobile: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  address3: z.string().optional(),
  town: z.string().optional(),
  region: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  charge_sales_tax: z.enum(["Auto", "Always", "Never"]).optional(),
  payment_terms_in_days: z.number().int().optional(),
}).strict();
export const DeleteContactInputSchema = z.object({ contact_id: IdOrUrl("Contact") }).strict();

export const UpdateProjectInputSchema = z.object({
  project_id: IdOrUrl("Project"),
  name: z.string().optional(),
  contact: z.string().optional(),
  status: z.enum(["Active", "Completed", "Cancelled", "Hidden"]).optional(),
  budget: z.string().optional(),
  budget_units: z.enum(["Hours", "Days", "Monetary"]).optional(),
  currency: z.string().length(3).optional(),
  starts_on: DateString.optional(),
  ends_on: DateString.optional(),
  is_ir35: z.boolean().optional(),
  normal_billing_rate: z.string().optional(),
  billing_period: z.enum(["hour", "day"]).optional(),
  hours_per_day: z.string().optional(),
  contract_po_reference: z.string().optional(),
}).strict();
export const DeleteProjectInputSchema = z.object({ project_id: IdOrUrl("Project") }).strict();

export const UpdateTaskInputSchema = z.object({
  task_id: IdOrUrl("Task"),
  name: z.string().optional(),
  status: z.enum(["Active", "Completed", "Hidden"]).optional(),
  is_billable: z.boolean().optional(),
  billing_rate: z.string().optional(),
  billing_period: z.enum(["hour", "day"]).optional(),
}).strict();
export const DeleteTaskInputSchema = z.object({ task_id: IdOrUrl("Task") }).strict();

export const UpdateBillInputSchema = z.object({
  bill_id: IdOrUrl("Bill"),
  contact: z.string().optional(),
  dated_on: DateString.optional(),
  due_on: DateString.optional(),
  reference: z.string().optional(),
  currency: z.string().length(3).optional(),
  comments: z.string().optional(),
  payment_terms_in_days: z.number().int().optional(),
  ec_status: z.enum(["UK/Non-EC", "EC Goods", "EC Services", "Reverse Charge"]).optional(),
  bill_items: z.array(z.object({
    category: z.string(),
    description: z.string().optional(),
    price: z.string(),
    quantity: z.string().optional(),
    sales_tax_rate: z.string().optional(),
  }).strict()).optional(),
}).strict();
export const DeleteBillInputSchema = z.object({ bill_id: IdOrUrl("Bill") }).strict();

export const UpdatePriceListItemInputSchema = z.object({
  price_list_item_id: IdOrUrl("Price list item"),
  item_type: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  sales_tax_rate: z.string().optional(),
  category: z.string().optional(),
}).strict();
export const DeletePriceListItemInputSchema = z.object({ price_list_item_id: IdOrUrl("Price list item") }).strict();

export const DeleteExpenseInputSchema = z.object({ expense_id: IdOrUrl("Expense") }).strict();
export const GetMileageSettingsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const DeleteTimeslipInputSchema = z.object({ timeslip_id: IdOrUrl("Timeslip") }).strict();

export const CreateBankAccountInputSchema = z.object({
  type: z.enum(["Standard bank account", "Paypal account", "Credit card account"]),
  name: z.string().min(1),
  currency: z.string().length(3).default("GBP"),
  opening_balance: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  sort_code: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  is_personal: z.boolean().optional(),
  is_primary: z.boolean().optional(),
}).strict();
export const UpdateBankAccountInputSchema = z.object({
  bank_account_id: IdOrUrl("Bank account"),
  type: z.enum(["Standard bank account", "Paypal account", "Credit card account"]).optional(),
  name: z.string().optional(),
  currency: z.string().length(3).optional(),
  opening_balance: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  sort_code: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  is_personal: z.boolean().optional(),
  is_primary: z.boolean().optional(),
}).strict();
export const DeleteBankAccountInputSchema = z.object({ bank_account_id: IdOrUrl("Bank account") }).strict();
export const DeleteBankTransactionExplanationInputSchema = z.object({
  bank_transaction_explanation_id: IdOrUrl("Bank transaction explanation"),
}).strict();
export const UploadBankStatementInputSchema = z.object({
  bank_account: IdOrUrl("Bank account"),
  statement: z.array(z.object({
    dated_on: DateString,
    amount: z.string().describe("Decimal string; negative for money out"),
    description: z.string().optional(),
    fitid: z.string().optional().describe("Optional unique bank-side transaction id"),
  }).strict()).min(1).describe(
    "Statement lines as JSON objects. File upload is intentionally unsupported until MCP has an efficient binary channel."
  ),
}).strict();

export const CreateCategoryInputSchema = z.object({
  description: z.string().min(1),
  nominal_code: z.string().min(1),
  group_description: z.enum([
    "Income", "Cost of Sales", "Admin Expenses", "Current Assets", "Liabilities", "Equity",
  ]),
  allowable_for_tax: z.boolean().optional(),
  auto_sales_tax_rate: z.string().optional(),
}).strict();
export const UpdateCategoryInputSchema = z.object({
  nominal_code: z.string().min(1),
  description: z.string().optional(),
  allowable_for_tax: z.boolean().optional(),
  auto_sales_tax_rate: z.string().optional(),
}).strict();
export const DeleteCategoryInputSchema = z.object({ nominal_code: z.string().min(1) }).strict();

export const GetUserInputSchema = z.object({
  user_id: z.string().min(1).describe("User ID, URL, or 'me'"),
  response_format: ResponseFormatSchema,
}).strict();
export const CreateUserInputSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: z.enum(["Owner", "Director", "Partner", "Company Secretary", "Employee", "Shareholder"]).optional(),
  permission_level: z.number().int().optional(),
  opening_mileage: z.number().optional(),
}).strict();
export const UpdateUserInputSchema = z.object({
  user_id: IdOrUrl("User"),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(["Owner", "Director", "Partner", "Company Secretary", "Employee", "Shareholder"]).optional(),
  permission_level: z.number().int().optional(),
  opening_mileage: z.number().optional(),
}).strict();
export const DeleteUserInputSchema = z.object({ user_id: IdOrUrl("User") }).strict();
export const GetCompanyBusinessTypesInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetCompanyTaxTimelineInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();

export const UpdateInvoiceInputSchema = z.object({
  invoice_id: IdOrUrl("Invoice"),
  contact: z.string().optional(),
  dated_on: DateString.optional(),
  due_on: DateString.optional(),
  reference: z.string().optional(),
  currency: z.string().length(3).optional(),
  comments: z.string().optional(),
  payment_terms_in_days: z.number().int().optional(),
  discount_percent: z.string().optional(),
  invoice_items: z.array(z.object({
    item_type: z.string(), description: z.string(), price: z.string(), quantity: z.string(),
    sales_tax_rate: z.string().optional(),
  }).strict()).optional(),
}).strict();
export const DeleteInvoiceInputSchema = z.object({ invoice_id: IdOrUrl("Invoice") }).strict();
export const DuplicateInvoiceInputSchema = z.object({ invoice_id: IdOrUrl("Invoice") }).strict();
export const SendInvoiceEmailInputSchema = z.object({
  invoice_id: IdOrUrl("Invoice"),
  to: z.string().optional(),
  cc: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  from: z.string().optional().describe("Verified sender from freeagent_list_email_addresses"),
}).strict();
export const GetInvoiceTimelineInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const DirectDebitInvoiceInputSchema = z.object({ invoice_id: IdOrUrl("Invoice") }).strict();

export const UpdateEstimateInputSchema = z.object({
  estimate_id: IdOrUrl("Estimate"),
  contact: z.string().optional(),
  dated_on: DateString.optional(),
  reference: z.string().optional(),
  currency: z.string().length(3).optional(),
  comments: z.string().optional(),
  discount_percent: z.string().optional(),
  estimate_items: z.array(z.object({
    item_type: z.string(), description: z.string(), price: z.string(), quantity: z.string(),
    sales_tax_rate: z.string().optional(),
  }).strict()).optional(),
}).strict();
export const DeleteEstimateInputSchema = z.object({ estimate_id: IdOrUrl("Estimate") }).strict();
export const DuplicateEstimateInputSchema = z.object({ estimate_id: IdOrUrl("Estimate") }).strict();
export const SendEstimateEmailInputSchema = z.object({
  estimate_id: IdOrUrl("Estimate"),
  to: z.string().optional(),
  cc: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  from: z.string().optional(),
}).strict();

// ---------- Credit notes ----------

export const ListCreditNotesInputSchema = z.object({
  page, per_page,
  view: z.enum(["all", "draft", "sent", "cancelled"]).optional(),
  contact: z.string().optional(),
  project: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();
export const GetCreditNoteInputSchema = z.object({
  credit_note_id: IdOrUrl("Credit note"),
  response_format: ResponseFormatSchema,
}).strict();
export const CreateCreditNoteInputSchema = z.object({
  contact: z.string().min(1),
  dated_on: DateString,
  reference: z.string().optional(),
  currency: z.string().length(3).default("GBP"),
  comments: z.string().optional(),
  discount_percent: z.string().optional(),
  credit_note_items: z.array(z.object({
    item_type: z.string(), description: z.string(), price: z.string(), quantity: z.string(),
    sales_tax_rate: z.string().optional(),
  }).strict()).min(1),
}).strict();
export const UpdateCreditNoteInputSchema = z.object({
  credit_note_id: IdOrUrl("Credit note"),
  contact: z.string().optional(),
  dated_on: DateString.optional(),
  reference: z.string().optional(),
  currency: z.string().length(3).optional(),
  comments: z.string().optional(),
  discount_percent: z.string().optional(),
  credit_note_items: z.array(z.object({
    item_type: z.string(), description: z.string(), price: z.string(), quantity: z.string(),
    sales_tax_rate: z.string().optional(),
  }).strict()).optional(),
}).strict();
export const DeleteCreditNoteInputSchema = z.object({ credit_note_id: IdOrUrl("Credit note") }).strict();
export const TransitionCreditNoteInputSchema = z.object({
  credit_note_id: IdOrUrl("Credit note"),
  action: z.enum(["mark_as_sent", "mark_as_draft", "mark_as_cancelled"]),
}).strict();
export const SendCreditNoteEmailInputSchema = z.object({
  credit_note_id: IdOrUrl("Credit note"),
  to: z.string().optional(),
  cc: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  from: z.string().optional(),
}).strict();

export const ListCreditNoteReconciliationsInputSchema = z.object({
  page, per_page, response_format: ResponseFormatSchema,
}).strict();
export const GetCreditNoteReconciliationInputSchema = z.object({
  credit_note_reconciliation_id: IdOrUrl("Credit note reconciliation"),
  response_format: ResponseFormatSchema,
}).strict();
export const CreateCreditNoteReconciliationInputSchema = z.object({
  credit_note: IdOrUrl("Credit note"),
  invoice: IdOrUrl("Invoice"),
  dated_on: DateString.optional(),
}).strict();
export const UpdateCreditNoteReconciliationInputSchema = z.object({
  credit_note_reconciliation_id: IdOrUrl("Credit note reconciliation"),
  credit_note: z.string().optional(),
  invoice: z.string().optional(),
  dated_on: DateString.optional(),
}).strict();
export const DeleteCreditNoteReconciliationInputSchema = z.object({
  credit_note_reconciliation_id: IdOrUrl("Credit note reconciliation"),
}).strict();

// ---------- Notes / attachments ----------

export const ListNotesInputSchema = z.object({
  contact: z.string().optional(),
  project: z.string().optional(),
  response_format: ResponseFormatSchema,
}).strict();
export const GetNoteInputSchema = z.object({ note_id: IdOrUrl("Note"), response_format: ResponseFormatSchema }).strict();
export const CreateNoteInputSchema = z.object({
  note: z.string().min(1),
  contact: z.string().optional(),
  project: z.string().optional(),
}).strict();
export const UpdateNoteInputSchema = z.object({ note_id: IdOrUrl("Note"), note: z.string().min(1) }).strict();
export const DeleteNoteInputSchema = z.object({ note_id: IdOrUrl("Note") }).strict();
export const GetAttachmentInputSchema = z.object({
  attachment_id: IdOrUrl("Attachment"),
  response_format: ResponseFormatSchema,
}).strict();
export const DeleteAttachmentInputSchema = z.object({ attachment_id: IdOrUrl("Attachment") }).strict();

// ---------- Reports ----------

export const GetProfitAndLossInputSchema = z.object({
  from_date: DateString.optional(), to_date: DateString.optional(), response_format: ResponseFormatSchema,
}).strict();
export const GetBalanceSheetInputSchema = z.object({
  date: DateString.optional(), response_format: ResponseFormatSchema,
}).strict();
export const GetTrialBalanceInputSchema = z.object({
  from_date: DateString.optional(), to_date: DateString.optional(),
  opening_balances: z.boolean().optional(),
  response_format: ResponseFormatSchema,
}).strict();
export const GetCashflowInputSchema = z.object({
  from_date: DateString, to_date: DateString, response_format: ResponseFormatSchema,
}).strict();
export const ListAccountingTransactionsInputSchema = z.object({
  page, per_page, from_date: DateString.optional(), to_date: DateString.optional(),
  response_format: ResponseFormatSchema,
}).strict();
export const GetAccountingTransactionInputSchema = z.object({
  accounting_transaction_id: IdOrUrl("Accounting transaction"),
  response_format: ResponseFormatSchema,
}).strict();

// ---------- Journals ----------

export const ListJournalSetsInputSchema = z.object({ page, per_page, response_format: ResponseFormatSchema }).strict();
export const GetJournalSetInputSchema = z.object({ journal_set_id: IdOrUrl("Journal set"), response_format: ResponseFormatSchema }).strict();
export const GetOpeningBalancesInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const CreateJournalSetInputSchema = z.object({
  dated_on: DateString,
  description: z.string().optional(),
  journal_entries: z.array(z.object({
    category: z.string(),
    debit_value: z.string().optional(),
    credit_value: z.string().optional(),
    description: z.string().optional(),
  }).strict()).min(2),
}).strict();
export const UpdateJournalSetInputSchema = z.object({
  journal_set_id: IdOrUrl("Journal set"),
  dated_on: DateString.optional(),
  description: z.string().optional(),
  journal_entries: z.array(z.object({
    category: z.string(),
    debit_value: z.string().optional(),
    credit_value: z.string().optional(),
    description: z.string().optional(),
  }).strict()).optional(),
}).strict();
export const DeleteJournalSetInputSchema = z.object({ journal_set_id: IdOrUrl("Journal set") }).strict();

// ---------- Capital assets ----------

export const ListCapitalAssetsInputSchema = z.object({
  page, per_page,
  view: z.enum(["all", "active", "disposed"]).optional(),
  include_history: z.boolean().optional(),
  response_format: ResponseFormatSchema,
}).strict();
export const GetCapitalAssetInputSchema = z.object({
  capital_asset_id: IdOrUrl("Capital asset"), response_format: ResponseFormatSchema,
}).strict();
export const ListCapitalAssetTypesInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetCapitalAssetTypeInputSchema = z.object({
  capital_asset_type_id: IdOrUrl("Capital asset type"), response_format: ResponseFormatSchema,
}).strict();
export const CreateCapitalAssetTypeInputSchema = z.object({ name: z.string().min(1) }).strict();
export const UpdateCapitalAssetTypeInputSchema = z.object({
  capital_asset_type_id: IdOrUrl("Capital asset type"), name: z.string().min(1),
}).strict();
export const DeleteCapitalAssetTypeInputSchema = z.object({
  capital_asset_type_id: IdOrUrl("Capital asset type"),
}).strict();

// ---------- Tax ----------

export const ListVatReturnsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetVatReturnInputSchema = z.object({ period_ends_on: DateString, response_format: ResponseFormatSchema }).strict();
export const TransitionVatReturnInputSchema = z.object({
  period_ends_on: DateString, action: z.enum(["mark_as_filed", "mark_as_unfiled"]),
}).strict();
export const TransitionVatReturnPaymentInputSchema = z.object({
  period_ends_on: DateString, payment_date: DateString, action: z.enum(["mark_as_paid", "mark_as_unpaid"]),
}).strict();

export const ListCorporationTaxReturnsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetCorporationTaxReturnInputSchema = z.object({ period_ends_on: DateString, response_format: ResponseFormatSchema }).strict();
export const TransitionCorporationTaxReturnInputSchema = z.object({
  period_ends_on: DateString,
  action: z.enum(["mark_as_filed", "mark_as_unfiled", "mark_as_paid", "mark_as_unpaid"]),
}).strict();

export const ListFinalAccountsReportsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetFinalAccountsReportInputSchema = z.object({ period_ends_on: DateString, response_format: ResponseFormatSchema }).strict();
export const TransitionFinalAccountsReportInputSchema = z.object({
  period_ends_on: DateString, action: z.enum(["mark_as_filed", "mark_as_unfiled"]),
}).strict();

export const ListIncomeTaxReturnsInputSchema = z.object({
  user_id: IdOrUrl("User"), response_format: ResponseFormatSchema,
}).strict();
export const GetIncomeTaxReturnInputSchema = z.object({
  user_id: IdOrUrl("User"), period_ends_on: DateString, response_format: ResponseFormatSchema,
}).strict();
export const TransitionIncomeTaxReturnInputSchema = z.object({
  user_id: IdOrUrl("User"), period_ends_on: DateString, action: z.enum(["mark_as_filed", "mark_as_unfiled"]),
}).strict();
export const TransitionIncomeTaxReturnPaymentInputSchema = z.object({
  user_id: IdOrUrl("User"), period_ends_on: DateString, payment_date: DateString,
  action: z.enum(["mark_as_paid", "mark_as_unpaid"]),
}).strict();

// ---------- Payroll ----------

export const ListPayrollPeriodsInputSchema = z.object({
  year: z.number().int(), response_format: ResponseFormatSchema,
}).strict();
export const ListPayrollPayslipsInputSchema = z.object({
  year: z.number().int(), period: z.number().int(), response_format: ResponseFormatSchema,
}).strict();
export const TransitionPayrollPaymentInputSchema = z.object({
  year: z.number().int(), payment_date: DateString, action: z.enum(["mark_as_paid", "mark_as_unpaid"]),
}).strict();
export const ListPayrollProfilesInputSchema = z.object({
  year: z.number().int(), response_format: ResponseFormatSchema,
}).strict();
export const GetPayrollProfileInputSchema = z.object({
  year: z.number().int(), user: z.string().optional(), response_format: ResponseFormatSchema,
}).strict();

// ---------- Properties / stock / HP ----------

export const ListPropertiesInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetPropertyInputSchema = z.object({ property_id: IdOrUrl("Property"), response_format: ResponseFormatSchema }).strict();
export const CreatePropertyInputSchema = z.object({
  address: z.string().optional(),
  property_type: z.string().optional(),
}).passthrough();
export const UpdatePropertyInputSchema = z.object({
  property_id: IdOrUrl("Property"),
  address: z.string().optional(),
  property_type: z.string().optional(),
}).passthrough();
export const DeletePropertyInputSchema = z.object({ property_id: IdOrUrl("Property") }).strict();
export const ListStockItemsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetStockItemInputSchema = z.object({ stock_item_id: IdOrUrl("Stock item"), response_format: ResponseFormatSchema }).strict();
export const ListHirePurchasesInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetHirePurchaseInputSchema = z.object({ hire_purchase_id: IdOrUrl("Hire purchase"), response_format: ResponseFormatSchema }).strict();

// ---------- Bank feeds / email / locks / CIS / sales tax periods ----------

export const ListBankFeedsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetBankFeedInputSchema = z.object({ bank_feed_id: IdOrUrl("Bank feed"), response_format: ResponseFormatSchema }).strict();
export const ListEmailAddressesInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const ListAccountLocksInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const SetAccountLockInputSchema = z.object({ locked_to_date: DateString.describe("Lock user edits up to this date") }).strict();
export const DeleteAccountLockInputSchema = z.object({}).strict();
export const ListCisBandsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetCisSettingsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const UpdateCisSettingsInputSchema = z.object({
  settings: z.record(z.string(), z.unknown()).describe("CIS settings object as accepted by FreeAgent"),
}).strict();
export const ListSalesTaxPeriodsInputSchema = z.object({ response_format: ResponseFormatSchema }).strict();
export const GetSalesTaxPeriodInputSchema = z.object({
  sales_tax_period_id: IdOrUrl("Sales tax period"), response_format: ResponseFormatSchema,
}).strict();
export const CreateSalesTaxPeriodInputSchema = z.object({
  starts_on: DateString, ends_on: DateString,
}).passthrough();
export const UpdateSalesTaxPeriodInputSchema = z.object({
  sales_tax_period_id: IdOrUrl("Sales tax period"),
  starts_on: DateString.optional(), ends_on: DateString.optional(),
}).passthrough();
export const DeleteSalesTaxPeriodInputSchema = z.object({
  sales_tax_period_id: IdOrUrl("Sales tax period"),
}).strict();

// Type exports

export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>;
export type DeleteContactInput = z.infer<typeof DeleteContactInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type DeleteProjectInput = z.infer<typeof DeleteProjectInputSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
export type DeleteTaskInput = z.infer<typeof DeleteTaskInputSchema>;
export type UpdateBillInput = z.infer<typeof UpdateBillInputSchema>;
export type DeleteBillInput = z.infer<typeof DeleteBillInputSchema>;
export type UpdatePriceListItemInput = z.infer<typeof UpdatePriceListItemInputSchema>;
export type DeletePriceListItemInput = z.infer<typeof DeletePriceListItemInputSchema>;
export type DeleteExpenseInput = z.infer<typeof DeleteExpenseInputSchema>;
export type GetMileageSettingsInput = z.infer<typeof GetMileageSettingsInputSchema>;
export type DeleteTimeslipInput = z.infer<typeof DeleteTimeslipInputSchema>;
export type CreateBankAccountInput = z.infer<typeof CreateBankAccountInputSchema>;
export type UpdateBankAccountInput = z.infer<typeof UpdateBankAccountInputSchema>;
export type DeleteBankAccountInput = z.infer<typeof DeleteBankAccountInputSchema>;
export type DeleteBankTransactionExplanationInput = z.infer<typeof DeleteBankTransactionExplanationInputSchema>;
export type UploadBankStatementInput = z.infer<typeof UploadBankStatementInputSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;
export type DeleteCategoryInput = z.infer<typeof DeleteCategoryInputSchema>;
export type GetUserInput = z.infer<typeof GetUserInputSchema>;
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
export type DeleteUserInput = z.infer<typeof DeleteUserInputSchema>;
export type GetCompanyBusinessTypesInput = z.infer<typeof GetCompanyBusinessTypesInputSchema>;
export type GetCompanyTaxTimelineInput = z.infer<typeof GetCompanyTaxTimelineInputSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceInputSchema>;
export type DeleteInvoiceInput = z.infer<typeof DeleteInvoiceInputSchema>;
export type DuplicateInvoiceInput = z.infer<typeof DuplicateInvoiceInputSchema>;
export type SendInvoiceEmailInput = z.infer<typeof SendInvoiceEmailInputSchema>;
export type GetInvoiceTimelineInput = z.infer<typeof GetInvoiceTimelineInputSchema>;
export type DirectDebitInvoiceInput = z.infer<typeof DirectDebitInvoiceInputSchema>;
export type UpdateEstimateInput = z.infer<typeof UpdateEstimateInputSchema>;
export type DeleteEstimateInput = z.infer<typeof DeleteEstimateInputSchema>;
export type DuplicateEstimateInput = z.infer<typeof DuplicateEstimateInputSchema>;
export type SendEstimateEmailInput = z.infer<typeof SendEstimateEmailInputSchema>;
export type ListCreditNotesInput = z.infer<typeof ListCreditNotesInputSchema>;
export type GetCreditNoteInput = z.infer<typeof GetCreditNoteInputSchema>;
export type CreateCreditNoteInput = z.infer<typeof CreateCreditNoteInputSchema>;
export type UpdateCreditNoteInput = z.infer<typeof UpdateCreditNoteInputSchema>;
export type DeleteCreditNoteInput = z.infer<typeof DeleteCreditNoteInputSchema>;
export type TransitionCreditNoteInput = z.infer<typeof TransitionCreditNoteInputSchema>;
export type SendCreditNoteEmailInput = z.infer<typeof SendCreditNoteEmailInputSchema>;
export type ListCreditNoteReconciliationsInput = z.infer<typeof ListCreditNoteReconciliationsInputSchema>;
export type GetCreditNoteReconciliationInput = z.infer<typeof GetCreditNoteReconciliationInputSchema>;
export type CreateCreditNoteReconciliationInput = z.infer<typeof CreateCreditNoteReconciliationInputSchema>;
export type UpdateCreditNoteReconciliationInput = z.infer<typeof UpdateCreditNoteReconciliationInputSchema>;
export type DeleteCreditNoteReconciliationInput = z.infer<typeof DeleteCreditNoteReconciliationInputSchema>;
export type ListNotesInput = z.infer<typeof ListNotesInputSchema>;
export type GetNoteInput = z.infer<typeof GetNoteInputSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;
export type UpdateNoteInput = z.infer<typeof UpdateNoteInputSchema>;
export type DeleteNoteInput = z.infer<typeof DeleteNoteInputSchema>;
export type GetAttachmentInput = z.infer<typeof GetAttachmentInputSchema>;
export type DeleteAttachmentInput = z.infer<typeof DeleteAttachmentInputSchema>;
export type GetProfitAndLossInput = z.infer<typeof GetProfitAndLossInputSchema>;
export type GetBalanceSheetInput = z.infer<typeof GetBalanceSheetInputSchema>;
export type GetTrialBalanceInput = z.infer<typeof GetTrialBalanceInputSchema>;
export type GetCashflowInput = z.infer<typeof GetCashflowInputSchema>;
export type ListAccountingTransactionsInput = z.infer<typeof ListAccountingTransactionsInputSchema>;
export type GetAccountingTransactionInput = z.infer<typeof GetAccountingTransactionInputSchema>;
export type ListJournalSetsInput = z.infer<typeof ListJournalSetsInputSchema>;
export type GetJournalSetInput = z.infer<typeof GetJournalSetInputSchema>;
export type GetOpeningBalancesInput = z.infer<typeof GetOpeningBalancesInputSchema>;
export type CreateJournalSetInput = z.infer<typeof CreateJournalSetInputSchema>;
export type UpdateJournalSetInput = z.infer<typeof UpdateJournalSetInputSchema>;
export type DeleteJournalSetInput = z.infer<typeof DeleteJournalSetInputSchema>;
export type ListCapitalAssetsInput = z.infer<typeof ListCapitalAssetsInputSchema>;
export type GetCapitalAssetInput = z.infer<typeof GetCapitalAssetInputSchema>;
export type ListCapitalAssetTypesInput = z.infer<typeof ListCapitalAssetTypesInputSchema>;
export type GetCapitalAssetTypeInput = z.infer<typeof GetCapitalAssetTypeInputSchema>;
export type CreateCapitalAssetTypeInput = z.infer<typeof CreateCapitalAssetTypeInputSchema>;
export type UpdateCapitalAssetTypeInput = z.infer<typeof UpdateCapitalAssetTypeInputSchema>;
export type DeleteCapitalAssetTypeInput = z.infer<typeof DeleteCapitalAssetTypeInputSchema>;
export type ListVatReturnsInput = z.infer<typeof ListVatReturnsInputSchema>;
export type GetVatReturnInput = z.infer<typeof GetVatReturnInputSchema>;
export type TransitionVatReturnInput = z.infer<typeof TransitionVatReturnInputSchema>;
export type TransitionVatReturnPaymentInput = z.infer<typeof TransitionVatReturnPaymentInputSchema>;
export type ListCorporationTaxReturnsInput = z.infer<typeof ListCorporationTaxReturnsInputSchema>;
export type GetCorporationTaxReturnInput = z.infer<typeof GetCorporationTaxReturnInputSchema>;
export type TransitionCorporationTaxReturnInput = z.infer<typeof TransitionCorporationTaxReturnInputSchema>;
export type ListFinalAccountsReportsInput = z.infer<typeof ListFinalAccountsReportsInputSchema>;
export type GetFinalAccountsReportInput = z.infer<typeof GetFinalAccountsReportInputSchema>;
export type TransitionFinalAccountsReportInput = z.infer<typeof TransitionFinalAccountsReportInputSchema>;
export type ListIncomeTaxReturnsInput = z.infer<typeof ListIncomeTaxReturnsInputSchema>;
export type GetIncomeTaxReturnInput = z.infer<typeof GetIncomeTaxReturnInputSchema>;
export type TransitionIncomeTaxReturnInput = z.infer<typeof TransitionIncomeTaxReturnInputSchema>;
export type TransitionIncomeTaxReturnPaymentInput = z.infer<typeof TransitionIncomeTaxReturnPaymentInputSchema>;
export type ListPayrollPeriodsInput = z.infer<typeof ListPayrollPeriodsInputSchema>;
export type ListPayrollPayslipsInput = z.infer<typeof ListPayrollPayslipsInputSchema>;
export type TransitionPayrollPaymentInput = z.infer<typeof TransitionPayrollPaymentInputSchema>;
export type ListPayrollProfilesInput = z.infer<typeof ListPayrollProfilesInputSchema>;
export type GetPayrollProfileInput = z.infer<typeof GetPayrollProfileInputSchema>;
export type ListPropertiesInput = z.infer<typeof ListPropertiesInputSchema>;
export type GetPropertyInput = z.infer<typeof GetPropertyInputSchema>;
export type CreatePropertyInput = z.infer<typeof CreatePropertyInputSchema>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertyInputSchema>;
export type DeletePropertyInput = z.infer<typeof DeletePropertyInputSchema>;
export type ListStockItemsInput = z.infer<typeof ListStockItemsInputSchema>;
export type GetStockItemInput = z.infer<typeof GetStockItemInputSchema>;
export type ListHirePurchasesInput = z.infer<typeof ListHirePurchasesInputSchema>;
export type GetHirePurchaseInput = z.infer<typeof GetHirePurchaseInputSchema>;
export type ListBankFeedsInput = z.infer<typeof ListBankFeedsInputSchema>;
export type GetBankFeedInput = z.infer<typeof GetBankFeedInputSchema>;
export type ListEmailAddressesInput = z.infer<typeof ListEmailAddressesInputSchema>;
export type ListAccountLocksInput = z.infer<typeof ListAccountLocksInputSchema>;
export type SetAccountLockInput = z.infer<typeof SetAccountLockInputSchema>;
export type DeleteAccountLockInput = z.infer<typeof DeleteAccountLockInputSchema>;
export type ListCisBandsInput = z.infer<typeof ListCisBandsInputSchema>;
export type GetCisSettingsInput = z.infer<typeof GetCisSettingsInputSchema>;
export type UpdateCisSettingsInput = z.infer<typeof UpdateCisSettingsInputSchema>;
export type ListSalesTaxPeriodsInput = z.infer<typeof ListSalesTaxPeriodsInputSchema>;
export type GetSalesTaxPeriodInput = z.infer<typeof GetSalesTaxPeriodInputSchema>;
export type CreateSalesTaxPeriodInput = z.infer<typeof CreateSalesTaxPeriodInputSchema>;
export type UpdateSalesTaxPeriodInput = z.infer<typeof UpdateSalesTaxPeriodInputSchema>;
export type DeleteSalesTaxPeriodInput = z.infer<typeof DeleteSalesTaxPeriodInputSchema>;
