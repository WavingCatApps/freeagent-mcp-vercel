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
  sales_tax_value?: string;
  description?: string;
  receipt_reference?: string;
  manual_sales_tax_amount?: string;
  attachment?: string;
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
  normal_billing_rate?: string;
  hours_per_day?: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface FreeAgentBankTransaction {
  url: string;
  bank_account: string;
  dated_on: string;
  gross_value: string;
  description?: string;
  unexplained_amount?: string;
  is_manual?: boolean;
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

export interface FreeAgentApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginationInfo {
  page: number;
  per_page: number;
  total_count?: number;
  has_more: boolean;
  next_page?: number;
}
