import { FreeAgentApiClient } from "../services/api-client.js";
import { ResponseFormat } from "../constants.js";
import type { ListCategoriesInput, GetCategoryInput } from "../schemas/index.js";

/**
 * List all categories in FreeAgent
 */
export async function listCategories(
  apiClient: FreeAgentApiClient,
  params: ListCategoriesInput
): Promise<string> {
  const queryParams = new URLSearchParams();

  if (params.view) queryParams.set("view", params.view);

  const url = `/categories${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await apiClient.get(url) as any;

  if (!response.categories || response.categories.length === 0) {
    return "No categories found.";
  }

  if (params.response_format === ResponseFormat.JSON) {
    return JSON.stringify(response.categories, null, 2);
  }

  const categoryList = response.categories
    .map((category: any) => {
      const parts = [
        `Category: ${category.description}`,
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

  return `Found ${response.categories.length} category(ies):\n\n${categoryList}`;
}

/**
 * Get details of a specific category
 */
export async function getCategory(
  apiClient: FreeAgentApiClient,
  params: GetCategoryInput
): Promise<string> {
  const nominalCode = params.nominal_code.replace(/^.*\/categories\//, "");
  const response = await apiClient.get(`/categories/${nominalCode}`) as any;
  const category = response.category;

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
