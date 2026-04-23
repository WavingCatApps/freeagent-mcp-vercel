/**
 * Estimate Management Tools
 *
 * Estimates are proposals sent to a contact that can be approved by them and
 * converted into invoices. Mirrors the invoice shape closely.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentEstimate } from "../types.js";
import type {
  ListEstimatesInput,
  GetEstimateInput,
  CreateEstimateInput,
  TransitionEstimateInput,
} from "../schemas/index.js";
import {
  formatResponse,
  createPaginationMetadata,
  extractIdFromUrl,
} from "../services/formatter.js";

export async function listEstimates(
  client: FreeAgentApiClient,
  params: ListEstimatesInput
): Promise<string> {
  const { page, per_page, view, contact, project, sort, response_format } = params;

  const queryParams: Record<string, string> = {
    page: page.toString(),
    per_page: per_page.toString(),
  };
  if (view) queryParams.view = view;
  if (contact) queryParams.contact = contact;
  if (project) queryParams.project = project;
  if (sort) queryParams.sort = sort;

  const response = await client.get<{ estimates: FreeAgentEstimate[] }>("/estimates", queryParams);
  const estimates = response.data.estimates ?? [];
  const pagination = client.parsePaginationHeaders(response.headers);

  return formatResponse(
    {
      estimates,
      pagination: {
        page,
        per_page,
        total_count: pagination.totalCount,
        has_more: pagination.hasMore,
        next_page: pagination.nextPage,
      },
    },
    response_format,
    () => {
      const lines: string[] = ["# FreeAgent Estimates", ""];

      if (pagination.totalCount !== undefined) {
        lines.push(
          createPaginationMetadata({
            page,
            perPage: per_page,
            totalCount: pagination.totalCount,
            hasMore: pagination.hasMore,
            nextPage: pagination.nextPage,
          })
        );
        lines.push("");
      }

      if (estimates.length === 0) {
        lines.push("No estimates found matching the criteria.");
        return lines.join("\n");
      }

      for (const est of estimates) {
        const id = extractIdFromUrl(est.url);
        lines.push(`## ${est.dated_on} — ${est.currency ?? "GBP"} ${est.total_value ?? "0.00"} (ID: ${id})`);
        if (est.reference) lines.push(`Reference: ${est.reference}`);
        if (est.status) lines.push(`Status: ${est.status}`);
        lines.push(`Contact: ${est.contact}`);
        if (est.expires_on) lines.push(`Expires: ${est.expires_on}`);
        lines.push("");
      }

      return lines.join("\n");
    }
  );
}

export async function getEstimate(
  client: FreeAgentApiClient,
  params: GetEstimateInput
): Promise<string> {
  const { estimate_id, response_format } = params;
  const url = estimate_id.startsWith("http") ? estimate_id : `/estimates/${estimate_id}`;

  const response = await client.get<{ estimate: FreeAgentEstimate }>(url);
  const est = response.data.estimate;

  return formatResponse(
    est,
    response_format,
    () => {
      const lines = [`# Estimate Details`, ""];
      lines.push(`- **Date**: ${est.dated_on}`);
      if (est.expires_on) lines.push(`- **Expires**: ${est.expires_on}`);
      if (est.reference) lines.push(`- **Reference**: ${est.reference}`);
      if (est.status) lines.push(`- **Status**: ${est.status}`);
      lines.push(`- **Contact**: ${est.contact}`);
      if (est.total_value) {
        lines.push(`- **Total**: ${est.currency ?? "GBP"} ${est.total_value}`);
      }
      if (est.estimate_items && est.estimate_items.length > 0) {
        lines.push("", "## Line items");
        for (const item of est.estimate_items) {
          lines.push(`- ${item.description} (${item.item_type}): ${item.quantity} × ${item.price}`);
        }
      }
      if (est.comments) lines.push("", `## Comments`, est.comments);
      return lines.join("\n");
    }
  );
}

export async function createEstimate(
  client: FreeAgentApiClient,
  params: CreateEstimateInput
): Promise<string> {
  const contactUrl = params.contact.startsWith("http")
    ? params.contact
    : `https://api.freeagent.com/v2/contacts/${params.contact}`;

  const payload: Record<string, unknown> = {
    contact: contactUrl,
    dated_on: params.dated_on,
    currency: params.currency,
    ec_status: params.ec_status ?? "UK/Non-EC",
    estimate_items: params.estimate_items,
  };
  if (params.expires_on) payload.expires_on = params.expires_on;
  if (params.reference) payload.reference = params.reference;
  if (params.comments) payload.comments = params.comments;
  if (params.terms_and_conditions) payload.terms_and_conditions = params.terms_and_conditions;
  if (params.payment_terms_in_days !== undefined) {
    payload.payment_terms_in_days = params.payment_terms_in_days;
  }

  const response = await client.post<{ estimate: FreeAgentEstimate }>("/estimates", {
    estimate: payload,
  });
  const est = response.data.estimate;
  const id = extractIdFromUrl(est.url);

  return (
    `✅ Drafted estimate ${id}\n\n` +
    `**Date**: ${est.dated_on}\n` +
    (est.reference ? `**Reference**: ${est.reference}\n` : "") +
    (est.total_value ? `**Total**: ${est.currency ?? "GBP"} ${est.total_value}\n` : "") +
    `**Contact**: ${est.contact}\n` +
    `**URL**: ${est.url}`
  );
}

export async function transitionEstimate(
  client: FreeAgentApiClient,
  params: TransitionEstimateInput
): Promise<string> {
  const id = params.estimate_id.startsWith("http")
    ? extractIdFromUrl(params.estimate_id)
    : params.estimate_id;

  const path = `/estimates/${id}/transitions/${params.action}`;
  const response = await client.put<{ estimate: FreeAgentEstimate }>(path);
  const est = response.data.estimate;

  return (
    `✅ ${params.action} applied to estimate ${extractIdFromUrl(est.url)}\n\n` +
    (est.status ? `**Status**: ${est.status}\n` : "") +
    `**Date**: ${est.dated_on}\n` +
    (est.total_value ? `**Total**: ${est.currency ?? "GBP"} ${est.total_value}\n` : "") +
    `**URL**: ${est.url}`
  );
}
