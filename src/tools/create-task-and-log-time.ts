/**
 * Intent-bundle tool: create a task and log one or more timeslips against it.
 *
 * Collapses the common "start work on a new task and record time against it"
 * flow into one call:
 *   resolve project → POST /tasks → POST /timeslips (one per entry).
 *
 * Accepts human-friendly hints: `project` by name/ID/URL, `user` by email/ID/URL
 * (defaults to the sole account user). Per-entry timeslip failures are reported
 * without rolling back the task or other successful entries — the task has
 * been created whether or not every timeslip lands, and the summary says so.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentTask, FreeAgentTimeslip } from "../types.js";
import type { CreateTaskAndLogTimeInput } from "../schemas/index.js";
import { extractIdFromUrl } from "../services/formatter.js";
import { resolveProject, resolveUser } from "../services/resolvers.js";

interface EntryResult {
  dated_on: string;
  hours: string;
  status: "logged" | "failed";
  timeslipId?: string;
  error?: string;
}

export async function createTaskAndLogTime(
  client: FreeAgentApiClient,
  params: CreateTaskAndLogTimeInput
): Promise<string> {
  const [projectUrl, userUrl] = await Promise.all([
    resolveProject(client, params.project),
    resolveUser(client, params.user),
  ]);

  const taskPayload: Record<string, unknown> = {
    project: projectUrl,
    name: params.task_name,
    is_billable: params.is_billable,
    status: params.status,
  };
  if (params.billing_rate) taskPayload.billing_rate = params.billing_rate;
  if (params.billing_period) taskPayload.billing_period = params.billing_period;

  const taskResponse = await client.post<{ task: FreeAgentTask }>("/tasks", {
    task: taskPayload,
  });
  const task = taskResponse.data.task;

  const results = await Promise.allSettled(
    params.entries.map((entry) =>
      client.post<{ timeslip: FreeAgentTimeslip }>("/timeslips", {
        timeslip: {
          task: task.url,
          user: userUrl,
          project: projectUrl,
          dated_on: entry.dated_on,
          hours: entry.hours,
          ...(entry.comment ? { comment: entry.comment } : {}),
        },
      })
    )
  );

  const outcomes: EntryResult[] = results.map((result, i) => {
    const entry = params.entries[i];
    if (result.status === "fulfilled") {
      const ts = result.value.data.timeslip;
      return {
        dated_on: ts.dated_on,
        hours: ts.hours,
        status: "logged",
        timeslipId: extractIdFromUrl(ts.url),
      };
    }
    const err = result.reason instanceof Error ? result.reason.message : String(result.reason);
    return {
      dated_on: entry.dated_on,
      hours: entry.hours,
      status: "failed",
      error: err,
    };
  });

  const logged = outcomes.filter((o) => o.status === "logged");
  const failed = outcomes.filter((o) => o.status === "failed");
  const totalHours = logged.reduce((sum, o) => sum + (parseFloat(o.hours) || 0), 0);
  const taskId = extractIdFromUrl(task.url);

  const header =
    failed.length === 0
      ? `✅ Created task ${taskId} and logged ${logged.length} timeslip(s)`
      : `⚠️ Created task ${taskId}; logged ${logged.length} of ${outcomes.length} timeslip(s)`;

  const entryLines = outcomes
    .map((o) =>
      o.status === "logged"
        ? `  - ${o.dated_on}: ${o.hours}h (timeslip ${o.timeslipId})`
        : `  - ${o.dated_on}: ${o.hours}h — FAILED: ${o.error}`
    )
    .join("\n");

  return (
    `${header}\n\n` +
    `**Task**: ${task.name}\n` +
    `**Project**: ${task.project}\n` +
    `**Billable**: ${task.is_billable ? "Yes" : "No"}\n` +
    (task.billing_rate
      ? `**Billing rate**: ${task.billing_rate} per ${task.billing_period ?? "hour"}\n`
      : "") +
    `**Task URL**: ${task.url}\n` +
    `**Total hours logged**: ${totalHours.toFixed(2)}\n\n` +
    `Entries:\n${entryLines}`
  );
}
