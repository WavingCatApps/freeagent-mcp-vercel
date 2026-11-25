/**
 * FreeAgent API Client Service
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import {
  API_BASE_URL,
  API_VERSION,
  FREEAGENT_X_API_VERSION,
  RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS,
  RATE_LIMIT_REQUESTS_PER_HOUR,
  RATE_LIMIT_REQUESTS_PER_MINUTE,
  SANDBOX_API_BASE_URL,
} from "../constants.js";
import type { FreeAgentApiError, FreeAgentApiErrorItem } from "../types.js";
import type { TokenRefresher } from "./token-refresher.js";

export interface ApiResponse<T> {
  data: T;
  headers: Record<string, string>;
}

/**
 * Pull a short, LLM-usable detail from a FreeAgent error body.
 * FreeAgent sometimes returns plain text (or lightly tagged HTML) for 403s,
 * JSON `{ message }`, or nested `{ errors: { error: { message } } }`.
 * Full HTML documents are ignored so we don't dump pages into tool errors.
 */
export function extractFreeAgentBodyDetail(data: unknown): string | undefined {
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return undefined;
    if (/^<!DOCTYPE|^<html/i.test(trimmed)) return undefined;
    const withoutTags = trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!withoutTags || withoutTags.length > 500) return undefined;
    return withoutTags;
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.trim()) {
      return obj.message.trim();
    }

    const errors = obj.errors;
    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      const nested = (errors as Record<string, unknown>).error;
      if (nested && typeof nested === "object" && nested !== null) {
        const msg = (nested as { message?: unknown }).message;
        if (typeof msg === "string" && msg.trim()) return msg.trim();
      }
    }
  }

  return undefined;
}

function isServerErrorStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

export class FreeAgentApiClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string;
  private useSandbox: boolean;

  constructor(accessToken: string, useSandbox: boolean = false, tokenRefresher?: TokenRefresher) {
    this.accessToken = accessToken;
    this.useSandbox = useSandbox;

    const baseURL = useSandbox ? SANDBOX_API_BASE_URL : API_BASE_URL;

    this.axiosInstance = axios.create({
      baseURL: `${baseURL}/${API_VERSION}`,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "User-Agent": "FreeAgent-MCP-Server/1.0.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
        // Multi-attachment bank explanation API (platform default from 1 Dec 2026)
        "X-Api-Version": FREEAGENT_X_API_VERSION
      },
      timeout: 30000
    });

    // On a 401, refresh the access token once and retry the request
    if (tokenRefresher) {
      this.axiosInstance.interceptors.response.use(undefined, async (error) => {
        const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
        if (!axios.isAxiosError(error) || error.response?.status !== 401 || !config || config._retried) {
          throw error;
        }
        config._retried = true;
        this.accessToken = await tokenRefresher.refresh();
        this.axiosInstance.defaults.headers["Authorization"] = `Bearer ${this.accessToken}`;
        config.headers["Authorization"] = `Bearer ${this.accessToken}`;
        return this.axiosInstance.request(config);
      });
    }
  }

  /**
   * Make a GET request to the FreeAgent API
   */
  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    try {
      const config: AxiosRequestConfig = { params };
      const response = await this.axiosInstance.get<T>(endpoint, config);
      return { data: response.data, headers: response.headers as Record<string, string> };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a POST request to the FreeAgent API
   */
  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<T>(endpoint, data);
      return { data: response.data, headers: response.headers as Record<string, string> };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a PUT request to the FreeAgent API
   */
  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.put<T>(endpoint, data);
      return { data: response.data, headers: response.headers as Record<string, string> };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a DELETE request to the FreeAgent API
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.delete<T>(endpoint);
      return { data: response.data, headers: response.headers as Record<string, string> };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors and convert them to user-friendly messages
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<FreeAgentApiError>;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;

        // Rate limiting — surface Retry-After; do not sleep/retry here (serverless).
        if (status === 429) {
          const retryAfter =
            axiosError.response.headers["retry-after"] ||
            RATE_LIMIT_DEFAULT_RETRY_AFTER_SECONDS;
          return new Error(
            `Rate limit exceeded. Please retry after ${retryAfter} seconds. ` +
            `FreeAgent allows ${RATE_LIMIT_REQUESTS_PER_MINUTE} requests per minute ` +
            `(${RATE_LIMIT_REQUESTS_PER_HOUR} per hour) per user.`
          );
        }

        // Authentication errors
        if (status === 401) {
          return new Error(
            "Authentication failed. Your access token may be expired or invalid. " +
            "Please refresh your OAuth token."
          );
        }

        // Authorization — FreeAgent often returns plain text / light HTML here.
        if (status === 403) {
          const detail = extractFreeAgentBodyDetail(data);
          if (detail) {
            return new Error(
              `Access forbidden: ${detail}. ` +
              "Check your FreeAgent account permissions / access level."
            );
          }
          return new Error(
            "Access forbidden. Your account may not have permission to access this resource. " +
            "Check your FreeAgent account permissions."
          );
        }

        // Not found
        if (status === 404) {
          return new Error(
            "Resource not found. The requested item may have been deleted or the URL is incorrect."
          );
        }

        // Bad request (e.g. invalid nominal code)
        if (status === 400) {
          const detail = extractFreeAgentBodyDetail(data);
          return new Error(
            detail
              ? `Bad request (400): ${detail}`
              : "Bad request (400). Check the request parameters and try again."
          );
        }

        // Validation errors
        if (status === 422 && data && typeof data === "object" && data.errors) {
          let errorMessages: string;

          // Check if errors is an array or object
          if (Array.isArray(data.errors)) {
            // Handle array of error objects
            errorMessages = data.errors
              .map((errorItem: string | FreeAgentApiErrorItem) => {
                if (typeof errorItem === 'string') return errorItem;
                if (errorItem && errorItem.message) return errorItem.message;
                return JSON.stringify(errorItem);
              })
              .join("; ");
          } else {
            // Handle object with field names as keys
            errorMessages = Object.entries(data.errors)
              .map(([field, messages]) => {
                // Handle different error message formats
                let messageStr: string;
                if (Array.isArray(messages)) {
                  messageStr = messages.join(", ");
                } else if (typeof messages === 'object' && messages !== null) {
                  // Handle nested error objects
                  if ('message' in messages) {
                    messageStr = String(messages.message);
                  } else {
                    messageStr = JSON.stringify(messages);
                  }
                } else {
                  messageStr = String(messages);
                }
                return `${field}: ${messageStr}`;
              })
              .join("; ");
          }

          return new Error(
            `Validation error: ${errorMessages}. Please check your input and try again.`
          );
        }

        // Upstream FreeAgent outages / gateway errors
        if (isServerErrorStatus(status)) {
          const detail = extractFreeAgentBodyDetail(data);
          return new Error(
            detail
              ? `FreeAgent server error (${status}): ${detail}. Please try again shortly.`
              : `FreeAgent server error (${status}). Please try again shortly.`
          );
        }

        // Generic error with message
        const detail = extractFreeAgentBodyDetail(data);
        if (detail) {
          return new Error(`API error (${status}): ${detail}`);
        }

        return new Error(`API request failed with status ${status}`);
      }

      // Network or timeout errors
      if (axiosError.code === "ECONNABORTED") {
        return new Error(
          "Request timeout. The FreeAgent API took too long to respond. Please try again."
        );
      }

      if (axiosError.code === "ENOTFOUND" || axiosError.code === "ECONNREFUSED") {
        return new Error(
          "Network error. Unable to connect to FreeAgent API. Please check your internet connection."
        );
      }
    }

    // Unknown error
    return new Error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }

  /**
   * Parse pagination info from response headers
   */
  parsePaginationHeaders(headers: Record<string, string | undefined>): {
    totalCount?: number;
    hasMore: boolean;
    nextPage?: number;
  } {
    const totalCount = headers["x-total-count"] 
      ? parseInt(headers["x-total-count"], 10) 
      : undefined;

    const linkHeader = headers["link"];
    let hasMore = false;
    let nextPage: number | undefined;

    if (linkHeader) {
      // Parse Link header: <url>; rel="next", <url>; rel="last"
      const links = linkHeader.split(",").map(link => link.trim());
      const nextLink = links.find(link => link.includes('rel="next"'));
      
      if (nextLink) {
        hasMore = true;
        const urlMatch = nextLink.match(/<([^>]+)>/);
        if (urlMatch) {
          const url = new URL(urlMatch[1]);
          const pageParam = url.searchParams.get("page");
          if (pageParam) {
            nextPage = parseInt(pageParam, 10);
          }
        }
      }
    }

    return { totalCount, hasMore, nextPage };
  }
}

/**
 * Format error message for LLM consumption
 */
export function formatErrorForLLM(error: Error): string {
  return `Error: ${error.message}`;
}
