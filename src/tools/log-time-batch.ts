/**
 * Intent-bundle tool: log time across one or more tasks / days in one call.
 *
 * Each entry is resolved independently — URL / numeric ID / name-within-project
 * — so a single call can span multiple projects and multiple days. The user
 * defaults to the sole account user; a per-call `project` hint provides scope
 * when entries pass tasks by name.
 *
 * Per-entry errors (bad task name, missing project scope, API rejection) are
 * surfaced in the response without aborting the rest of the batch, matching
 * the pattern used by invoice_from_timeslips' link step.
 */

import type { FreeAgentApiClient } from "../services/api-client.js";
import type { FreeAgentTimeslip } from "../types.js";
import type { LogTimeBatchInput } from "../schemas/index.js";
import { extractIdFromUrl } from "../services/formatter.js";
import { resolveTask, resolveUser } from "../services/resolvers.js";

interface EntryOutcome {
  index: number;
  dated_on: string;
  hours: string;
  status: "logged" | "failed";
  taskHint: string;
  timeslipId?: string;
  projectUrl?: string;
  error?: string;
}

export async function logTimeBatch(
  client: FreeAgentApiClient,
  params: LogTimeBatchInput
): Promise<string> {
  const userUrl = await resolveUser(client, params.user);

  const outcomes = await Promise.all(
    params.entries.map(async (entry, index): Promise<EntryOutcome> => {
      const projectHint = entry.project ?? params.project;
      try {
        const { url: taskUrl, projectUrl } = await resolveTask(
          client,
          entry.task,
          projectHint
        );
        const response = await client.post<{ timeslip: FreeAgentTimeslip }>(
          "/timeslips",
          {
            timeslip: {
              task: taskUrl,
              user: userUrl,
              project: projectUrl,
              dated_on: entry.dated_on,
              hours: entry.hours,
              ...(entry.comment ? { comment: entry.comment } : {}),
            },
          }
        );
        const ts = response.data.timeslip;
        return {
          index,
          dated_on: ts.dated_on,
          hours: ts.hours,
          status: "logged",
          taskHint: entry.task,
          timeslipId: extractIdFromUrl(ts.url),
          projectUrl,
        };
      } catch (error) {
        return {
          index,
          dated_on: entry.dated_on,
          hours: entry.hours,
          status: "failed",
          taskHint: entry.task,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  const logged = outcomes.filter((o) => o.status === "logged");
  const failed = outcomes.filter((o) => o.status === "failed");
  const totalHours = logged.reduce((sum, o) => sum + (parseFloat(o.hours) || 0), 0);

  const header =
    failed.length === 0
      ? `✅ Logged ${logged.length} timeslip(s)`
      : logged.length === 0
        ? `❌ Failed to log all ${outcomes.length} timeslip(s)`
        : `⚠️ Logged ${logged.length} of ${outcomes.length} timeslip(s); ${failed.length} failed`;

  const lines = outcomes.map((o) =>
    o.status === "logged"
      ? `  - [${o.index}] ${o.dated_on}: ${o.hours}h on task "${o.taskHint}" (timeslip ${o.timeslipId})`
      : `  - [${o.index}] ${o.dated_on}: ${o.hours}h on task "${o.taskHint}" — FAILED: ${o.error}`
  );

  return (
    `${header}\n\n` +
    `**Total hours logged**: ${totalHours.toFixed(2)}\n\n` +
    `Entries:\n${lines.join("\n")}`
  );
}
