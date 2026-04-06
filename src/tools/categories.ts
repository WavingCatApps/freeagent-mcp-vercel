import { FreeAgentApiClient } from "../services/api-client.js";
import { ResponseFormat } from "../constants.js";
import type { FreeAgentCategory } from "../types.js";
import type { ListCategoriesInput, GetCategoryInput } from "../schemas/index.js";

/**
 * List all categories in FreeAgent
 */
export async function listCategories(
  apiClient: FreeAgentApiClient,
  params: ListCategoriesInput
): Promise<string> {
  const response = await apiClient.get<Record<string, FreeAgentCategory[]>>("/categories");

  // Categories are returned in four separate arrays
  const adminExpenses = response.data.admin_expenses_categories || [];
  const costOfSales = response.data.cost_of_sales_categories || [];
  const income = response.data.income_categories || [];
  const general = response.data.general_categories || [];

  // Combine all categories based on view filter
  let allCategories: (FreeAgentCategory & { type: string })[] = [];

  if (!params.view || params.view === "all") {
    allCategories = [
      ...adminExpenses.map((c: FreeAgentCategory) => ({ ...c, type: "Admin Expenses" })),
      ...costOfSales.map((c: FreeAgentCategory) => ({ ...c, type: "Cost of Sales" })),
      ...income.map((c: FreeAgentCategory) => ({ ...c, type: "Income" })),
      ...general.map((c: FreeAgentCategory) => ({ ...c, type: "General" }))
    ];
  } else if (params.view === "standard") {
    // Standard categories are the first three types
    allCategories = [
      ...adminExpenses.map((c: FreeAgentCategory) => ({ ...c, type: "Admin Expenses" })),
      ...costOfSales.map((c: FreeAgentCategory) => ({ ...c, type: "Cost of Sales" })),
      ...income.map((c: FreeAgentCategory) => ({ ...c, type: "Income" }))
    ];
  } else if (params.view === "custom") {
    // Custom categories would typically be in general
    allCategories = general.map((c: FreeAgentCategory) => ({ ...c, type: "General" }));
  }

  if (allCategories.length === 0) {
    return "No categories found.";
  }

  if (params.response_format === ResponseFormat.JSON) {
    return JSON.stringify({
      admin_expenses_categories: adminExpenses,
      cost_of_sales_categories: costOfSales,
      income_categories: income,
      general_categories: general,
      total_count: allCategories.length
    }, null, 2);
  }

  const categoryList = allCategories
    .map((category: FreeAgentCategory & { type: string }) => {
      const parts = [
        `Category: ${category.description}`,
        `  Type: ${category.type}`,
        `  Nominal Code: ${category.nominal_code}`,
        `  URL: ${category.url}`,
      ];

      if (category.group_description) {
        parts.push(`  Group: ${category.group_description}`);
      }

      if (category.allowable_for_tax !== undefined) {
        parts.push(`  Allowable for Tax: ${category.allowable_for_tax ? "Yes" : "No"}`);
      }

      if (category.tax_reporting_name) {
        parts.push(`  Tax Reporting: ${category.tax_reporting_name}`);
      }

      if (category.auto_sales_tax_rate !== undefined) {
        parts.push(`  Auto Sales Tax Rate: ${(category.auto_sales_tax_rate * 100).toFixed(1)}%`);
      }

      return parts.join("\n");
    })
    .join("\n\n");

  return `Found ${allCategories.length} category(ies):\n\n${categoryList}`;
}

/**
 * Get details of a specific category
 */
export async function getCategory(
  apiClient: FreeAgentApiClient,
  params: GetCategoryInput
): Promise<string> {
  const nominalCode = params.nominal_code.replace(/^.*\/categories\//, "");
  const response = await apiClient.get<{ category: FreeAgentCategory }>(`/categories/${nominalCode}`);
  const category = response.data.category;

  if (params.response_format === ResponseFormat.JSON) {
    return JSON.stringify(category, null, 2);
  }

  const details = [
    `Category Details:`,
    `  Description: ${category.description}`,
    `  Nominal Code: ${category.nominal_code}`,
    `  URL: ${category.url}`,
  ];

  if (category.group_description) {
    details.push(`  Group: ${category.group_description}`);
  }

  if (category.allowable_for_tax !== undefined) {
    details.push(`  Allowable for Tax: ${category.allowable_for_tax ? "Yes" : "No"}`);
  }

  if (category.tax_reporting_name) {
    details.push(`  Tax Reporting Name: ${category.tax_reporting_name}`);
  }

  if (category.auto_sales_tax_rate !== undefined) {
    details.push(`  Auto Sales Tax Rate: ${(category.auto_sales_tax_rate * 100).toFixed(1)}%`);
  }

  if (category.bank_account) {
    details.push(`  Bank Account: ${category.bank_account}`);
  }

  if (category.capital_asset_type) {
    details.push(`  Capital Asset Type: ${category.capital_asset_type}`);
  }

  if (category.user) {
    details.push(`  User: ${category.user}`);
  }

  details.push(`  Created: ${category.created_at}`);
  details.push(`  Updated: ${category.updated_at}`);

  return details.join("\n");
}
