/**
 * Response Formatting Utilities
 */

import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";

/**
 * Truncate text if it exceeds the character limit
 */
export function truncateIfNeeded(
  text: string,
  metadata?: { count: number; total?: number }
): string {
  if (text.length <= CHARACTER_LIMIT) {
    return text;
  }

  const truncated = text.substring(0, CHARACTER_LIMIT);
  const truncationMessage = metadata
    ? `\n\n⚠️ Response truncated. Showing ${metadata.count} of ${metadata.total || "many"} items. ` +
      `Use pagination parameters (page, per_page) or add filters to see more results.`
    : `\n\n⚠️ Response truncated at ${CHARACTER_LIMIT} characters. ` +
      `Use pagination or filters to retrieve smaller result sets.`;

  return truncated + truncationMessage;
}

/**
 * Format a date string for human readability
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  } catch {
    return dateString;
  }
}

/**
 * Format a datetime string for human readability
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  } catch {
    return dateString;
  }
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: string, currency: string = "GBP"): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  
  return `${currency} ${num.toFixed(2)}`;
}

/**
 * Extract ID from FreeAgent URL
 */
export function extractIdFromUrl(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1];
}

/**
 * Format contact name
 */
export function formatContactName(contact: any): string {
  if (contact.organisation_name) {
    return contact.organisation_name;
  }
  
  const parts = [contact.first_name, contact.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unnamed Contact";
}

/**
 * Format response based on requested format
 */
export function formatResponse<T>(
  data: T,
  format: ResponseFormat,
  markdownFormatter: () => string
): string {
  if (format === ResponseFormat.JSON) {
    return JSON.stringify(data, null, 2);
  }
  
  return markdownFormatter();
}

/**
 * Create pagination metadata object
 */
export function createPaginationMetadata(params: {
  page: number;
  perPage: number;
  totalCount?: number;
  hasMore: boolean;
  nextPage?: number;
}): string {
  const { page, perPage, totalCount, hasMore, nextPage } = params;
  
  const parts: string[] = [
    `Page ${page}`,
    `Showing up to ${perPage} items per page`
  ];
  
  if (totalCount !== undefined) {
    parts.push(`Total: ${totalCount}`);
  }
  
  if (hasMore && nextPage) {
    parts.push(`More results available - use page=${nextPage} to continue`);
  }
  
  return parts.join(" | ");
}
