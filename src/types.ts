/**
 * Type definitions for FreeAgent API
 */

export interface FreeAgentContact {
  url: string;
  first_name?: string;
  last_name?: string;
  organisation_name?: string;
  email?: string;
  phone_number?: string;
  mobile?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  town?: string;
  region?: string;
  postcode?: string;
  country?: string;
  contact_name_on_invoices?: boolean;
  default_payment_terms_in_days?: number;
  charge_sales_tax?: string;
  active_projects_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentInvoice {
  url: string;
  contact: string;
  project?: string;
  invoice_items?: FreeAgentInvoiceItem[];
  dated_on: string;
  due_on?: string;
  reference?: string;
  currency: string;
  exchange_rate?: string;
  net_value: string;
  sales_tax_value: string;
  total_value: string;
  paid_value?: string;
  due_value?: string;
  status: string;
  comments?: string;
  discount_percent?: string;
  payment_terms_in_days?: number;
  ec_status?: string;
  written_off_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentInvoiceItem {
  item_type: string;
  description: string;
  price: string;
  quantity: string;
  sales_tax_rate?: string;
}

export interface FreeAgentExpense {
  url: string;
  user: string;
  category: string;
  dated_on: string;
  gross_value: string;
  currency?: string;
  sales_tax_value?: string;
  sales_tax_rate?: string;
  sales_tax_status?: string;
  description?: string;
  receipt_reference?: string;
  manual_sales_tax_amount?: string;
  ec_status?: string;
  project?: string;
  attachment?: string;
  attachment_count?: number;
  miles?: string;
  mileage?: string;
  vehicle_type?: string;
  engine_type?: string;
  engine_size?: string;
  initial_mileage?: string;
  mileage_type?: string;
  reclaim_mileage?: boolean;
  rebill_type?: string;
  rebilled_on_invoice?: string;
  recurring?: boolean;
  next_recurs_on?: string;
  recurring_end_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentProject {
  url: string;
  contact: string;
  name: string;
  budget: string;
  is_ir35: boolean;
  status: string;
  budget_units: string;
  currency?: string;
  normal_billing_rate?: string;
  billing_period?: string;
  hours_per_day?: string;
  starts_on?: string;
  ends_on?: string;
  contract_po_reference?: string;
  include_unbilled_time_in_profitability?: boolean;
  is_deletable?: boolean;
  uses_project_invoice_sequence?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentBankAccount {
  url: string;
  name: string;
  type: string;
  currency: string;
  opening_balance: string;
  current_balance?: string;
  is_personal?: boolean;
  is_primary?: boolean;
  is_active?: boolean;
  bank_name?: string;
  account_number?: string;
  sort_code?: string;
  iban?: string;
  bic?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentBankTransaction {
  url: string;
  bank_account: string;
  dated_on: string;
  gross_value: string;
  amount?: string;
  description?: string;
  unexplained_amount?: string;
  is_manual?: boolean;
  bank_transaction_explanations?: string[];
  uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentCompany {
  url: string;
  name: string;
  subdomain: string;
  type: string;
  currency: string;
  mileage_units: string;
  company_start_date: string;
  freeagent_start_date: string;
  first_accounting_year_end: string;
  company_registration_number?: string;
  sales_tax_registration_status: string;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentUser {
  url: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permission_level: number;
  opening_mileage?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentCategory {
  url: string;
  description: string;
  nominal_code: string;
  group_description?: string;
  allowable_for_tax?: boolean;
  tax_reporting_name?: string;
  auto_sales_tax_rate?: number;
  bank_account?: string;
  capital_asset_type?: string;
  user?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentTask {
  url: string;
  project: string;
  name: string;
  status: string;
  is_billable: boolean;
  billing_rate?: string;
  billing_period?: string;
  currency?: string;
  is_deletable?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentTimeslip {
  url: string;
  user: string;
  project: string;
  task: string;
  dated_on: string;
  hours: string;
  comment?: string;
  billed_on_invoice?: string;
  attachment_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentBankTransactionExplanation {
  url: string;
  bank_transaction: string;
  dated_on: string;
  gross_value: string;
  description?: string;
  category?: string;
  ec_status?: string;
  receipt_reference?: string;
  marked_for_review?: boolean;
  paid_invoice?: string;
  paid_bill?: string;
  paid_user?: string;
  transfer_bank_account?: string;
  project?: string;
  sales_tax_rate?: string;
  sales_tax_value?: string;
  attachment_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentBillItem {
  category?: string;
  description?: string;
  price?: string;
  quantity?: string;
  sales_tax_rate?: string;
  sales_tax_value?: string;
  total_value?: string;
}

export interface FreeAgentBill {
  url: string;
  contact: string;
  reference?: string;
  dated_on: string;
  due_on?: string;
  currency?: string;
  exchange_rate?: string;
  net_value?: string;
  sales_tax_value?: string;
  total_value: string;
  paid_value?: string;
  due_value?: string;
  status?: string;
  comments?: string;
  bill_items?: FreeAgentBillItem[];
  category?: string;
  ec_status?: string;
  payment_terms_in_days?: number;
  attachment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentApiErrorItem {
  message?: string;
  [key: string]: unknown;
}

export interface FreeAgentApiError {
  message: string;
  errors?: FreeAgentApiErrorItem[] | Record<string, string[] | string | FreeAgentApiErrorItem>;
}

export interface PaginationInfo {
  page: number;
  per_page: number;
  total_count?: number;
  has_more: boolean;
  next_page?: number;
}
