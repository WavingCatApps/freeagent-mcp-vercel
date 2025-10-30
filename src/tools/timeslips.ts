/**
 * Timeslip Management Tools
 *
 * Tools for listing, viewing, and creating timeslips (time tracking entries).
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type {
  ListTimeslipsInput,
  GetTimeslipInput,
  CreateTimeslipInput
} from "../schemas/index.js";
import { ResponseFormat } from "../constants.js";
import {
  formatResponse,
  createPaginationMetadata,
  extractIdFromUrl
} from "../services/formatter.js";

/**
 * List timeslips with optional filtering and pagination
 */
export async function listTimeslips(
  client: FreeAgentApiClient,
  params: ListTimeslipsInput
): Promise<string> {
  const { page, per_page, from_date, to_date, view, user, project, response_format } = params;

  // Build query parameters
  const queryParams: Record<string, string> = {
    page: page.toString(),
    per_page: per_page.toString()
  };

  if (from_date) queryParams.from_date = from_date;
  if (to_date) queryParams.to_date = to_date;
  if (view) queryParams.view = view;
  if (user) queryParams.user = user;
  if (project) queryParams.project = project;

  const response = await client.get<{ timeslips: any[] }>(
    "/timeslips",
    queryParams
  );
  const timeslips = response.timeslips || [];
  const pagination = client.parsePaginationHeaders(
    (response as any).headers || {}
  );

  // Format response
  return formatResponse(
    {
      timeslips: timeslips.map((timeslip: any) => ({
        url: timeslip.url,
        user: timeslip.user,
        project: timeslip.project,
        task: timeslip.task,
        dated_on: timeslip.dated_on,
        hours: timeslip.hours,
        comment: timeslip.comment,
        billed_on_invoice: timeslip.billed_on_invoice,
        attachment_count: timeslip.attachment_count
      })),
      pagination: {
        page,
        per_page,
        total_count: pagination.totalCount,
        has_more: pagination.hasMore,
        next_page: pagination.nextPage
      }
    },
    response_format,
    () => {
      const lines: string[] = ["# FreeAgent Timeslips", ""];

      if (pagination.totalCount !== undefined) {
        lines.push(
          createPaginationMetadata({
            page,
            perPage: per_page,
            totalCount: pagination.totalCount,
            hasMore: pagination.hasMore,
            nextPage: pagination.nextPage
          })
        );
        lines.push("");
      }

      if (timeslips.length === 0) {
        lines.push("No timeslips found matching the criteria.");
        return lines.join("\n");
      }

      for (const timeslip of timeslips) {
        const id = extractIdFromUrl(timeslip.url);
        const hours = `${timeslip.hours} hours`;
        const comment = timeslip.comment || 'No comment';
        const billed = timeslip.billed_on_invoice ? ' [BILLED]' : '';
        const attachments = timeslip.attachment_count > 0
          ? ` (${timeslip.attachment_count} attachment${timeslip.attachment_count > 1 ? 's' : ''})`
          : '';

        lines.push(`## ${timeslip.dated_on} - ${hours}${billed} (ID: ${id})`);
        lines.push(`${comment}${attachments}`);
        lines.push("");
      }

      return lines.join("\n");
    }
  );
}

/**
 * Get detailed information about a specific timeslip
 */
export async function getTimeslip(
  client: FreeAgentApiClient,
  params: GetTimeslipInput
): Promise<string> {
  const { timeslip_id, response_format } = params;
  const timeslipUrl = timeslip_id.startsWith('http')
    ? timeslip_id
    : `/timeslips/${timeslip_id}`;

  const response = await client.get<{ timeslip: any }>(timeslipUrl);
  const timeslip = response.timeslip;

  // Format response
  return formatResponse(
    timeslip,
    response_format,
    () => {
      const lines: string[] = ["# Timeslip Details", ""];

      lines.push(`- **Date**: ${timeslip.dated_on}`);
      lines.push(`- **Hours**: ${timeslip.hours}`);
      lines.push(`- **User**: ${timeslip.user}`);
      lines.push(`- **Project**: ${timeslip.project}`);
      lines.push(`- **Task**: ${timeslip.task}`);
      lines.push(`- **Comment**: ${timeslip.comment || 'N/A'}`);

      if (timeslip.billed_on_invoice) {
        lines.push(`- **Billed On Invoice**: ${timeslip.billed_on_invoice}`);
      } else {
        lines.push(`- **Status**: Unbilled`);
      }

      if (timeslip.attachment_count > 0) {
        lines.push(`- **Attachments**: ${timeslip.attachment_count} file(s)`);
      }

      lines.push("");
      lines.push(`- **Created**: ${timeslip.created_at}`);
      lines.push(`- **Updated**: ${timeslip.updated_at}`);

      return lines.join("\n");
    }
  );
}

/**
 * Create a new timeslip
 */
export async function createTimeslip(
  client: FreeAgentApiClient,
  params: CreateTimeslipInput
): Promise<string> {
  // Build timeslip payload
  const timeslipPayload: any = {
    task: params.task,
    user: params.user,
    project: params.project,
    dated_on: params.dated_on,
    hours: params.hours
  };

  // Add optional fields
  if (params.comment) timeslipPayload.comment = params.comment;

  const response = await client.post<{ timeslip: any }>("/timeslips", { timeslip: timeslipPayload });
  const timeslip = response.timeslip;
  const timeslipId = extractIdFromUrl(timeslip.url);

  return `✅ Successfully created timeslip\n\n` +
    `**Timeslip ID**: ${timeslipId}\n` +
    `**Date**: ${timeslip.dated_on}\n` +
    `**Hours**: ${timeslip.hours}\n` +
    `**Project**: ${timeslip.project}\n` +
    `**URL**: ${timeslip.url}`;
}
