/**
 * FreeAgent API Client Service
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { API_BASE_URL, SANDBOX_API_BASE_URL, API_VERSION } from "../constants.js";
import type { FreeAgentApiError, FreeAgentApiErrorItem } from "../types.js";

export interface ApiResponse<T> {
  data: T;
  headers: Record<string, string>;
}

export interface RefreshConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export class FreeAgentApiClient {
  private axiosInstance: AxiosInstance;
  private accessToken: string;
  private useSandbox: boolean;
  private refreshConfig?: RefreshConfig;
  private refreshInFlight?: Promise<string>;

  constructor(accessToken: string, useSandbox: boolean = false, refreshConfig?: RefreshConfig) {
    this.accessToken = accessToken;
    this.useSandbox = useSandbox;
    this.refreshConfig = refreshConfig;

    const baseURL = useSandbox ? SANDBOX_API_BASE_URL : API_BASE_URL;

    this.axiosInstance = axios.create({
      baseURL: `${baseURL}/${API_VERSION}`,
      headers: {
        "User-Agent": "FreeAgent-MCP-Server/1.0.0",
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      timeout: 30000
    });

    // Attach the current token per request rather than freezing it at construction,
    // so a refreshed token is picked up by subsequent calls.
    this.axiosInstance.interceptors.request.use(async (config) => {
      if (!this.accessToken && this.refreshConfig) {
        await this.refreshAccessToken();
      }
      config.headers.set("Authorization", `Bearer ${this.accessToken}`);
      return config;
    });

    // FreeAgent access tokens expire after roughly an hour. Without this, a
    // long-running stdio session dies mid-task and needs a manual re-mint.
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;

        if (
          error.response?.status === 401 &&
          this.refreshConfig &&
          original &&
          !original._retried
        ) {
          original._retried = true;
          await this.refreshAccessToken();
          return this.axiosInstance.request(original);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Exchange the refresh token for a new access token.
   * Concurrent callers share a single in-flight refresh so a burst of parallel
   * tool calls does not trigger several redundant token exchanges.
   */
  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshConfig) {
      throw new Error(
        "Access token expired and no refresh credentials are configured. " +
        "Set FREEAGENT_CLIENT_ID, FREEAGENT_CLIENT_SECRET and FREEAGENT_REFRESH_TOKEN."
      );
    }

    if (this.refreshInFlight) return this.refreshInFlight;

    const baseURL = this.useSandbox ? SANDBOX_API_BASE_URL : API_BASE_URL;
    const { clientId, clientSecret, refreshToken } = this.refreshConfig;

    this.refreshInFlight = (async () => {
      try {
        // Plain axios, not the instance, to avoid re-entering the interceptors.
        const response = await axios.post<{ access_token: string }>(
          `${baseURL}/${API_VERSION}/token_endpoint`,
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken
          }).toString(),
          {
            auth: { username: clientId, password: clientSecret },
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 30000
          }
        );

        if (!response.data?.access_token) {
          throw new Error("Token endpoint returned no access_token.");
        }

        this.accessToken = response.data.access_token;
        return this.accessToken;
      } catch (err) {
        const detail = axios.isAxiosError(err)
          ? `${err.response?.status ?? "network error"}`
          : String(err);
        throw new Error(
          `Failed to refresh the FreeAgent access token (${detail}). ` +
          "The refresh token may have been revoked; re-run the OAuth flow."
        );
      } finally {
        this.refreshInFlight = undefined;
      }
    })();

    return this.refreshInFlight;
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
