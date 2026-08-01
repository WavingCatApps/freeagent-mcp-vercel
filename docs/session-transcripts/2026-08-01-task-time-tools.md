# Session transcript — add task + time intent-bundle tools

**Date:** 2026-08-01
**Branch:** `claude/add-task-time-tools-xjJLp`
**Commit:** `e19c4be` — *Add intent-bundle tools for creating tasks and logging time in one call*

---

## User request

> On the branch `claude/mcp-agent-techniques-DS1Uq`, this repo has three existing intent-bundle tools: `reconcile_bank_transaction`, `log_expense`, `invoice_from_timeslips`. They follow a pattern: accept human-friendly hints (names, codes, references), resolve to FreeAgent URLs via `src/services/resolvers.ts`, call the underlying API, return a crisp summary. See CLAUDE.md-style conventions in `src/tools/register.ts`.
>
> Add an intent bundle (or pair of tools — your call) covering two flows I hit often:
>
> 1. Create a task and log time against it in one shot — project + task name → new task → one or more timeslips.
> 2. Log time across multiple tasks / multiple days in one call — an array of `{ task, dated_on, hours, comment }` entries.
>
> Before implementing, tell me whether you'd do this as one combined tool or two, and why. Then build, test (matching the Vitest style in `src/tools/*.test.ts`), typecheck, lint, commit.
>
> Reuse `resolveUser`/`resolveProject`-style helpers where they exist; add new ones to `src/services/resolvers.ts` if they don't. Resolve task-by-name within a project; default user to the sole account user; fetch the task's project when only a task is given.

---

## Reconnaissance

Read the existing intent-bundle tools to lock in the pattern before designing:

- **`src/services/resolvers.ts`** — `resolveCategory`, `resolveUser`, `resolveContact`, `resolveBill`. Consistent shape: `hint` starting with `http` passes through, `/^\d+$/` fetches by ID, otherwise list + exact match → substring match with actionable "ambiguous"/"no match" errors.
- **`src/tools/log-expense.ts`** — resolves in `Promise.all`, applies sign convention, returns a crisp `✅ Logged expense N …` summary.
- **`src/tools/invoice-from-timeslips.ts`** — multi-step orchestration + per-item error surfacing (`link_timeslips`).
- **`src/tools/reconcile.ts`** — mutually-exclusive link params, fetch-then-post, resolved-kind branching in the response.
- **`src/tools/register.ts`** — one entry per tool with `title`, `description`, `annotations`, `inputSchema.shape`, `handler`.
- **`src/schemas/index.ts`** — Zod, `.strict()`, verbose `.describe()` strings, `z.infer<>` type export at the bottom.
- **Test style** in `src/tools/*.test.ts` — `makeClient` factory that records `calls` and dispatches to per-test handler callbacks; assertions on `body`/`params`; `vi.useFakeTimers` for date-sensitive tests.

Existing tests before changes: 113. Tsc + eslint clean.

---

## Design decision — two tools, not one

I sent the following to the user before building:

> **Two tools**, not one. Flow 1 ("create a task + log time against it") and Flow 2 ("log time across many tasks/days") are different intents with different failure modes:
>
> - **One tool** would force ambiguous semantics on a `task` field (create vs. look up?) and smear two different "partial success" stories together (did the task get created but the timeslips fail?).
> - **Two tools** keeps each one legible: `create_task_and_log_time` has a clear "new task, then fill it" shape; `log_time_batch` is a uniform array of entries against existing tasks. The reconcile / log_expense / invoice_from_timeslips pattern is "one verb per tool" — sticking to it here matches the house style.

The user's original prompt already granted "build" as the next step, so I proceeded.

---

## What was built

### 1. New resolvers — `src/services/resolvers.ts`

**`resolveProject(client, hint) → projectUrl`**
- URL passes through.
- Numeric ID → `GET /projects/:id`.
- Name → `GET /projects?view=active&per_page=100`, exact case-insensitive match, then substring. On miss, retries with `view=all` so completed/hidden projects remain findable by exact name. Ambiguous matches raise a suggestion-rich error.

**`resolveTask(client, hint, projectHint?) → { url, projectUrl }`**
- URL or numeric ID: fetched directly (`GET /tasks/:id` or the URL itself); if `projectHint` is supplied it's cross-checked against `task.project` and mismatches raise a clear error.
- Name: `projectHint` is required (task names are only unique within a project). Resolves the project first, lists tasks scoped to it, exact-then-substring match with suggestion errors.
- Always returns the project URL alongside the task URL so callers never have to fetch again to build a timeslip payload.

Also added `FreeAgentProject`, `FreeAgentTask` to the imports at the top of the file.

### 2. New Zod schemas — `src/schemas/index.ts`

- `LogTimeEntrySchema` (internal): `{ dated_on, hours, comment? }`, `.strict()`.
- **`CreateTaskAndLogTimeInputSchema`**: `project` + `task_name` + `is_billable` (default `true`) + `billing_rate?` + `billing_period?` (`hour`|`day`) + `status` (default `Active`) + `user?` + `entries: min(1)`.
- `BatchLogTimeEntrySchema` (internal): `{ task, project?, dated_on, hours, comment? }`.
- **`LogTimeBatchInputSchema`**: `entries: min(1)` + top-level `project?` and `user?` used as defaults when an entry omits its own.

Types exported at the bottom via `z.infer<>` as usual.

### 3. New tool — `src/tools/create-task-and-log-time.ts`

Handler orchestration:

1. `Promise.all([resolveProject, resolveUser])`.
2. `POST /tasks` with the resolved project URL and the task fields.
3. `Promise.allSettled` over `POST /timeslips` for each entry — per-entry failures don't roll back the task or take out the other successful timeslips.
4. Summary lists every entry's outcome (`✅` vs `⚠️` header; per-entry lines showing date, hours, timeslip ID or FAILED reason; total hours).

### 4. New tool — `src/tools/log-time-batch.ts`

Handler orchestration:

1. `resolveUser(user)` once (shared across the batch).
2. `Promise.all` over entries, each wrapped in try/catch so `resolveTask` + `POST /timeslips` failures produce a per-entry `EntryOutcome` instead of aborting.
3. Entry-level `project` overrides the top-level `project` hint; the top-level acts as the default for entries whose `task` is a name.
4. Header switches between `✅ Logged N`, `⚠️ Logged X of N`, `❌ Failed to log all N` depending on outcomes.

### 5. Registration — `src/tools/register.ts`

Imported both new handlers and both new schemas, then added two `ToolDefinition` entries right after `freeagent_create_task`:

- `freeagent_create_task_and_log_time`
- `freeagent_log_time_batch`

Descriptions written in the same "what it does + accepts these hints + fallback defaults + how partial failure is reported" style used by the existing intent-bundle tools.

### 6. Tests

**`src/tools/create-task-and-log-time.test.ts`** — 5 cases:
- Happy path: resolve project by name, create task, POST one timeslip per entry, correct payload shape (task URL, user URL, project URL, comment only when present).
- Project URL passes through without a `/projects` list call.
- Per-entry timeslip failure is reported without aborting the batch (task stays created, header switches to `⚠️`).
- Multiple users + no `user` → clear error.
- Unknown project name → `No project matches "…"` error.

**`src/tools/log-time-batch.test.ts`** — 5 cases:
- Mixed task references (URL, numeric ID, name-within-project) in a single call.
- Entry-level `project` override so one batch spans two projects.
- Per-entry timeslip failure reported as `⚠️ Logged X of N`.
- Task name given without any project scope → per-entry FAILED with the `paired with a project` message.
- Numeric task ID whose project doesn't match the project hint → per-entry FAILED with the `different project` message.

One test needed a fix during the run: `resolveTask` calls `client.get(fullTaskUrl)` when the hint is a URL, and the mock initially only handled the short `/tasks/100` path. Extended the mock's `get` handler to match either.

---

## Verification

- `bun install` — installed dependencies for the fresh checkout.
- `bun run tsc --noEmit` — clean.
- `bun run lint` (`eslint src/`) — 0 errors; the 3 warnings that appear are all pre-existing `@typescript-eslint/no-explicit-any` warnings in `src/tools/register.ts` on lines untouched by this change.
- `bun run test` (`vitest run`) — **123 / 123 passing** (was 113; 10 new).

---

## Commit + push

Committed as **`e19c4be`** on `claude/add-task-time-tools-xjJLp` with the message:

```
Add intent-bundle tools for creating tasks and logging time in one call

Adds two tools that collapse common time-tracking flows:

- freeagent_create_task_and_log_time: project hint + task name + entries[]
  → creates the task and posts one timeslip per entry in a single call.
- freeagent_log_time_batch: entries[] of { task, dated_on, hours, comment? }
  → resolves each task independently (URL / ID / name-within-project) so a
  batch can span multiple projects and days.

Both default `user` to the sole account user and surface per-entry failures
in the response without aborting the batch, matching the style of the
existing invoice_from_timeslips / reconcile / log_expense tools.

Adds resolveProject and resolveTask to src/services/resolvers.ts. resolveTask
returns both the task URL and its project URL, letting the batch tool fetch
the task's project when only a task is given.
```

Pushed with `git push -u origin claude/add-task-time-tools-xjJLp`.

Files touched:

| File | Change |
| --- | --- |
| `src/services/resolvers.ts` | + `resolveProject`, + `resolveTask` |
| `src/schemas/index.ts` | + `CreateTaskAndLogTimeInputSchema`, + `LogTimeBatchInputSchema`, + inferred types |
| `src/tools/register.ts` | + two `ToolDefinition` entries + imports |
| `src/tools/create-task-and-log-time.ts` | new — handler |
| `src/tools/create-task-and-log-time.test.ts` | new — 5 Vitest cases |
| `src/tools/log-time-batch.ts` | new — handler |
| `src/tools/log-time-batch.test.ts` | new — 5 Vitest cases |

Diff: **7 files changed, 983 insertions, 1 deletion.**

---

## Follow-up ideas (not implemented)

- Neither new tool auto-creates a timeslip comment from context; if a `default_comment` on `create_task_and_log_time` proves useful in practice, add it as an optional param the entry can override.
- `log_time_batch` currently makes independent `resolveTask` calls per entry — for batches that hit the same task repeatedly, a small in-call memo on `(taskHint, projectHint) → resolved` would save round-trips. Skipped for now since real batches usually span distinct tasks and the extra complexity wasn't warranted.
- `resolveTask` scopes name lookups to `view=active`. If a user needs to log against a completed/hidden task by name, they'll have to pass the ID or URL. Matches the current `invoice_from_timeslips` convention.
