/**
 * FreeAgent API Client Service
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { API_BASE_URL, SANDBOX_API_BASE_URL, API_VERSION } from "../constants.js";
import type { FreeAgentApiError } from "../types.js";

export class FreeAgentApiClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string;
  private useSandbox: boolean;

  constructor(accessToken: string, useSandbox: boolean = false) {
    this.accessToken = accessToken;
    this.useSandbox = useSandbox;

    const baseURL = useSandbox ? SANDBOX_API_BASE_URL : API_BASE_URL;

    this.axiosInstance = axios.create({
      baseURL: `${baseURL}/${API_VERSION}`,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "User-Agent": "FreeAgent-MCP-Server/1.0.0",
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      timeout: 30000
    });
  }

  /**
   * Make a GET request to the FreeAgent API
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    try {
      const config: AxiosRequestConfig = { params };
      const response = await this.axiosInstance.get<T>(endpoint, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a POST request to the FreeAgent API
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await this.axiosInstance.post<T>(endpoint, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a PUT request to the FreeAgent API
   */
  async put<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await this.axiosInstance.put<T>(endpoint, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Make a DELETE request to the FreeAgent API
   */
  async delete<T>(endpoint: string): Promise<T> {
    try {
      const response = await this.axiosInstance.delete<T>(endpoint);
      return response.data;
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

        // Rate limiting
        if (status === 429) {
          const retryAfter = axiosError.response.headers["retry-after"];
          return new Error(
            `Rate limit exceeded. Please retry after ${retryAfter || 60} seconds. ` +
            `FreeAgent allows 15 requests per 60 seconds.`
          );
        }

        // Authentication errors
        if (status === 401) {
          return new Error(
            "Authentication failed. Your access token may be expired or invalid. " +
            "Please refresh your OAuth token."
          );
        }

        // Authorization errors
        if (status === 403) {
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

        // Validation errors
        if (status === 422 && data && data.errors) {
          const errorMessages = Object.entries(data.errors)
            .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
            .join("; ");
          return new Error(
            `Validation error: ${errorMessages}. Please check your input and try again.`
          );
        }

        // Generic error with message
        if (data && data.message) {
          return new Error(`API error: ${data.message}`);
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
  parsePaginationHeaders(headers: Record<string, any>): {
    totalCount?: number;
    hasMore: boolean;
    nextPage?: number;
  } {
    const totalCount = headers["x-total-count"] 
      ? parseInt(headers["x-total-count"], 10) 
      : undefined;

    const linkHeader = headers["link"] as string | undefined;
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
