/**
 * Intent-bundle tool: create a draft invoice from a contact's unbilled timeslips.
 *
 * Collapses the common contractor-billing workflow into one call:
 *   resolve contact → list projects → list unbilled timeslips → group by task
 *   (fetching task billing rates as needed) → POST /invoices.
 *
 * Writes a DRAFT invoice. The timeslips themselves are NOT marked as billed
 * (FreeAgent requires a separate link step), and that's called out in the
 * response so the agent can follow up if needed.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type {
  FreeAgentInvoice,
  FreeAgentProject,
  FreeAgentTask,
  FreeAgentTimeslip,
} from "../types.js";
import type { InvoiceFromTimeslipsInput } from "../schemas/index.js";
import { extractIdFromUrl } from "../services/formatter.js";
import { resolveContact } from "../services/resolvers.js";

interface InvoiceItem {
  item_type: string;
  description: string;
  price: string;
  quantity: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfPreviousMonthIso(today = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 10);
}

async function findProjectsForContact(
  client: FreeAgentApiClient,
  contactUrl: string,
  explicitProject?: string
): Promise<FreeAgentProject[]> {
  if (explicitProject) {
    const url = explicitProject.startsWith("http")
      ? explicitProject
      : `/projects/${explicitProject}`;
    const response = await client.get<{ project: FreeAgentProject }>(url);
    const project = response.data.project;
    if (project.contact !== contactUrl) {
      throw new Error(
        `Project ${extractIdFromUrl(project.url)} belongs to a different contact than "${contactUrl}".`
      );
    }
    return [project];
  }

  const response = await client.get<{ projects: FreeAgentProject[] }>(
    "/projects",
    { contact: contactUrl, view: "active", per_page: 100 }
  );
  const projects = response.data.projects ?? [];
  if (projects.length === 0) {
    throw new Error(
      `No active projects found for this contact. Create a project first, or pass \`project\` explicitly.`
    );
  }
  return projects;
}

async function collectUnbilledTimeslips(
  client: FreeAgentApiClient,
  project: FreeAgentProject,
  fromDate: string,
  toDate: string
): Promise<FreeAgentTimeslip[]> {
  const response = await client.get<{ timeslips: FreeAgentTimeslip[] }>(
    "/timeslips",
    {
      project: project.url,
      view: "unbilled",
      from_date: fromDate,
      to_date: toDate,
      per_page: 100,
    }
  );
  return response.data.timeslips ?? [];
}

async function buildInvoiceItems(
  client: FreeAgentApiClient,
  project: FreeAgentProject,
  timeslips: FreeAgentTimeslip[]
): Promise<InvoiceItem[]> {
  const byTask = new Map<string, { hours: number; comments: Set<string> }>();
  for (const ts of timeslips) {
    const entry = byTask.get(ts.task) ?? { hours: 0, comments: new Set<string>() };
    entry.hours += parseFloat(ts.hours) || 0;
    if (ts.comment) entry.comments.add(ts.comment);
    byTask.set(ts.task, entry);
  }

  const taskUrls = [...byTask.keys()];
  const tasks = await Promise.all(
    taskUrls.map((url) =>
      client.get<{ task: FreeAgentTask }>(url).then((r) => r.data.task)
    )
  );
  const taskByUrl = new Map(tasks.map((t) => [t.url, t] as const));

  const projectRate = project.normal_billing_rate;
  const items: InvoiceItem[] = [];

  for (const [taskUrl, { hours, comments }] of byTask) {
    const task = taskByUrl.get(taskUrl);
    if (!task) continue;
    if (!task.is_billable) continue;

    const rate = task.billing_rate ?? projectRate;
    if (!rate) {
      throw new Error(
        `Task "${task.name}" has no billing rate and project "${project.name}" has no normal_billing_rate. Set one before invoicing.`
      );
    }

    const description = comments.size > 0
      ? `${task.name}: ${[...comments].slice(0, 3).join("; ")}`
      : task.name;

    items.push({
      item_type: "Hours",
      description,
      price: rate,
      quantity: hours.toFixed(2),
    });
  }

  return items;
}

async function linkTimeslipsToInvoice(
  client: FreeAgentApiClient,
  timeslips: FreeAgentTimeslip[],
  invoiceUrl: string
): Promise<{ linked: number; failures: string[] }> {
  const results = await Promise.allSettled(
    timeslips.map((ts) =>
      client.put(ts.url, {
        timeslip: { billed_on_invoice: invoiceUrl },
      })
    )
  );

  let linked = 0;
  const failures: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      linked++;
    } else {
      const id = extractIdFromUrl(timeslips[i].url);
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push(`${id}: ${msg}`);
    }
  });
  return { linked, failures };
}

export async function invoiceFromTimeslips(
  client: FreeAgentApiClient,
  params: InvoiceFromTimeslipsInput
): Promise<string> {
  const contactUrl = await resolveContact(client, params.contact);
  const fromDate = params.from_date ?? startOfPreviousMonthIso();
  const toDate = params.to_date ?? todayIso();

  const projects = await findProjectsForContact(
    client,
    contactUrl,
    params.project
  );

  const allTimeslips: { project: FreeAgentProject; timeslips: FreeAgentTimeslip[] }[] = [];
  for (const project of projects) {
    const timeslips = await collectUnbilledTimeslips(
      client,
      project,
      fromDate,
      toDate
    );
    if (timeslips.length > 0) {
      allTimeslips.push({ project, timeslips });
    }
  }

  if (allTimeslips.length === 0) {
    throw new Error(
      `No unbilled timeslips found for this contact between ${fromDate} and ${toDate}.`
    );
  }

  const items: InvoiceItem[] = [];
  for (const { project, timeslips } of allTimeslips) {
    const projectItems = await buildInvoiceItems(client, project, timeslips);
    items.push(...projectItems);
  }

  if (items.length === 0) {
    throw new Error(
      "All timeslips in range are on non-billable tasks. Nothing to invoice."
    );
  }

  const invoicePayload: Record<string, unknown> = {
    contact: contactUrl,
    dated_on: params.dated_on ?? todayIso(),
    currency: params.currency ?? "GBP",
    invoice_items: items,
  };
  if (params.due_on) invoicePayload.due_on = params.due_on;
  if (params.reference) invoicePayload.reference = params.reference;
  if (params.payment_terms_in_days !== undefined) {
    invoicePayload.payment_terms_in_days = params.payment_terms_in_days;
  }

  const response = await client.post<{ invoice: FreeAgentInvoice }>("/invoices", {
    invoice: invoicePayload,
  });
  const invoice = response.data.invoice;
  const invoiceId = extractIdFromUrl(invoice.url);
  const totalHours = items.reduce((sum, i) => sum + parseFloat(i.quantity), 0);
  const allTs = allTimeslips.flatMap((p) => p.timeslips);

  let linkSummary = `ℹ️ The invoice is a DRAFT. Timeslips remain unbilled until linked to the invoice in FreeAgent.`;
  if (params.link_timeslips) {
    const { linked, failures } = await linkTimeslipsToInvoice(client, allTs, invoice.url);
    if (failures.length === 0) {
      linkSummary = `🔗 Linked ${linked} timeslip(s) to the invoice.`;
    } else {
      linkSummary =
        `🔗 Linked ${linked} of ${allTs.length} timeslip(s). ${failures.length} failed (FreeAgent may not permit external writes to billed_on_invoice):\n` +
        failures.slice(0, 5).map((f) => `  - ${f}`).join("\n");
    }
  }

  return (
    `✅ Drafted invoice ${invoiceId} for ${items.length} line item(s)\n\n` +
    `**Contact**: ${invoice.contact}\n` +
    `**Date**: ${invoice.dated_on}\n` +
    `**Total hours**: ${totalHours.toFixed(2)}\n` +
    `**Total value**: ${invoice.currency} ${invoice.total_value}\n` +
    `**URL**: ${invoice.url}\n\n` +
    linkSummary
  );
}
