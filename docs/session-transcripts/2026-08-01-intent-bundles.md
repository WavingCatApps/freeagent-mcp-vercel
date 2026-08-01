# Session transcript — MCP intent bundles + FreeAgent surface expansion

**Date:** 2026-08-01
**Branch:** `claude/mcp-agent-techniques-DS1Uq` (merged to `main`)
**Net effect:** 17 new tools, 3 new intent-bundle patterns, elicitation wired into the tool context, full README + TOOLS reference refresh. 93 tests passing throughout.

---

## 1. Framing: adapting an Anthropic blog post

The user opened with the Anthropic blog *Building agents that reach production systems with MCP* and asked "any tricks we can adapt?" The post's page returned 403 to WebFetch, so the first pass worked from search-result summaries plus the sibling "Code execution with MCP" post. After the user pasted the full text, the read shifted to the actual content:

- Build **remote servers** for maximum reach — already true of this repo (Vercel `api/index.ts`).
- **Group tools around intent, not endpoints** — flagged as the single highest-leverage change. The repo's `src/tools/register.ts` was a straight 1:1 mirror of FreeAgent endpoints (~30 tools).
- **Elicitation** — pause mid-tool call to ask the user for input; form mode for missing parameters, URL mode for downstream OAuth.
- **Skills alongside servers** — the repo already had a `file-to-base64` skill but no workflow skills.
- **MCP Apps** for rich inline UI — noted but not tackled this session.
- **CIMD** for OAuth — noted but not tackled.

The Cloudflare-style "two tools that accept code" pattern was ruled out — that's for services with hundreds-to-thousands of endpoints; FreeAgent at ~30 domains doesn't warrant it.

Recommendation to the user: start with intent bundles. They said "go for it."

---

## 2. Intent bundle #1 — `reconcile_bank_transaction`

**Problem:** to explain one bank transaction against a category, an agent had to call `get_bank_transaction` → `list_categories` → `create_bank_transaction_explanation`, stitching URLs together. Same shape for invoice/bill matching.

**Design:** one tool that takes the transaction ID plus a human-friendly hint. Exactly one of:
- `category` — name (e.g. "Travel"), nominal code (e.g. "285"), or URL
- `paid_invoice` — invoice reference, ID, or URL
- (later added) `paid_bill` — bill reference, ID, or URL

The tool fetches the transaction (for `dated_on` and `gross_value`), resolves the hint to a canonical URL server-side, then POSTs the explanation. Category resolution: exact case-insensitive match on description, then substring; ambiguity surfaces a suggestion-rich error message.

**Files:**
- `src/tools/reconcile.ts` — handler
- `src/schemas/index.ts` — `ReconcileBankTransactionInputSchema`
- `src/tools/reconcile.test.ts` — 7 tests covering URL pass-through, code lookup, name lookup, ambiguity, missing-match, invoice reference resolution, mutual exclusion

**Commit:** `8a56d60`

---

## 3. Intent bundle #2 — `log_expense` + shared resolvers

The `CreateExpenseInputSchema` had a UX footgun: `"IMPORTANT: Use NEGATIVE values for normal expenses"`. Agents get this wrong.

**Design:** `log_expense` takes a **positive** `amount` plus `kind: "expense" | "refund"` and applies the sign server-side. Category accepts name/code/URL; user accepts email/ID/URL and defaults to the sole user on the account when unambiguous. Date defaults to today.

**Refactor:** `resolveCategory` was lifted out of `reconcile.ts` into a new `src/services/resolvers.ts` module so multiple intent bundles could share the lookup strategy. `resolveUser` was added alongside it.

**Files:**
- `src/services/resolvers.ts` — new shared module
- `src/tools/log-expense.ts` — handler
- `src/schemas/index.ts` — `LogExpenseInputSchema` with a positive-decimal regex
- `src/tools/log-expense.test.ts` — 6 tests
- `src/tools/reconcile.ts` — updated to import from resolvers

**Commit:** `b0bcf11`

---

## 4. Intent bundle #3 — `invoice_from_timeslips`

The user's contractor-billing workflow is roughly: contact → active projects → unbilled timeslips in range → group by task → invoice. Multiple round-trips.

**Design:** takes a contact (name/ID/URL) and optional project + date range. Defaults: `from_date` = start of previous month, `to_date` = today, `dated_on` = today. Steps:
1. Resolve contact (new `resolveContact` helper added to the shared resolvers module).
2. Find active projects for the contact (or use the passed one, validating it belongs to the contact).
3. Collect unbilled timeslips in range per project.
4. For each unique task, fetch the task in parallel, use its `billing_rate` or fall back to the project's `normal_billing_rate` (error if neither).
5. Group timeslips by task → one invoice line per task, quantity = summed hours, price = rate. Description = task name + up to 3 comments joined.
6. POST the draft invoice.

**Files:**
- `src/tools/invoice-from-timeslips.ts` — handler
- `src/services/resolvers.ts` — `resolveContact` added
- `src/schemas/index.ts` — `InvoiceFromTimeslipsInputSchema`
- `src/tools/invoice-from-timeslips.test.ts` — 5 tests

**Commit:** `64d21c5`

---

## 5. Auditing FreeAgent endpoint gaps

Mid-flight, the user asked: what other endpoints are worth adding, and how do they interact with these bundles? A subagent audited the FreeAgent API. Priority findings:

**Tier 1 — directly upgrades what we just built**
1. **Invoice transitions** (`PUT /v2/invoices/:id/transitions/:action`) — trivial wrapper, takes `invoice_from_timeslips` from draft-only to a full draft-and-send flow.
2. **Bills** — `reconcile_bank_transaction` already had `paid_bill` plumbing but bills weren't exposed at all.
3. **Timeslip update** — could set `billed_on_invoice` after `invoice_from_timeslips`, though the FreeAgent community forum flags that field as sometimes unwriteable from outside the native flow.

**Tier 2 — coherent but lower leverage**
Estimates (CRUD + transitions), recurring invoices (read), price list items (CRUD).

**Skipped:** journal entries, capital assets, VAT/CT/SA returns, payroll, reports.

The user asked to reorder priorities away from elicitation and toward these gaps. Agreed and shipped tier 1 first.

---

## 6. `transition_invoice`

Wraps `PUT /v2/invoices/:id/transitions/:action` with no request body. Action enum: `mark_as_sent`, `mark_as_cancelled`, `mark_as_draft`, `mark_as_scheduled`, `convert_to_credit_note`.

**Files:** `src/tools/transition-invoice.ts`, `src/tools/transition-invoice.test.ts`, schema addition, registration.

**Commit:** `1c9448a`

---

## 7. Bills + `reconcile.paid_bill`

Full read/write on supplier bills — list, get, create. `bill_items` shape mirrors invoice items. New `resolveBill` helper in the shared resolvers module. `reconcile_bank_transaction`'s schema and handler extended to accept `paid_bill` as a third mutually-exclusive link parameter alongside `category` and `paid_invoice`.

**Files:** `src/tools/bills.ts`, new bill types, `resolveBill` in resolvers, `reconcile.ts` + tests updated.

**Commit:** `5a03c6e`

---

## 8. `update_timeslip` + `link_timeslips` flag

New `freeagent_update_timeslip` tool wraps `PUT /v2/timeslips/:id`, including the `billed_on_invoice` field. `invoice_from_timeslips` gained a `link_timeslips` boolean (default `false`). When true, after the invoice is drafted the tool PUTs each source timeslip with `billed_on_invoice` set. Failures are counted and surfaced in the response without failing the whole tool — deliberate soft-failure handling for the field FreeAgent may reject.

**Commit:** `198a423`

---

## 9. Elicitation on `create_invoice`

**Wiring:** `ToolContext` interface added to `register.ts` with `clientSupportsElicitation: boolean` and `elicit(params) => Promise<ElicitResult>`. Built in `registerAllTools` from `server.server.getClientCapabilities()?.elicitation` and `server.server.elicitInput()`. Every handler now receives the context as a third argument (optional to use).

**Behaviour:** `CreateInvoiceInputSchema.contact` relaxed to optional. If missing:
- Client supports elicitation → server pre-fetches the 20 most-recently-updated contacts and elicits a form with a `oneOf` picker plus an "Other (paste a URL)" escape hatch.
- Client doesn't support elicitation → clear error pointing at `freeagent_list_contacts`.
- Cancel/decline → no half-created invoice; the error explains which action happened.

**Files:** `src/tools/register.ts` (ToolContext), `src/tools/invoices.ts` (elicitation branch), `src/tools/invoices.test.ts` (5 new tests), schema relaxation.

**Commit:** `aa0fb56`

---

## 10. Estimates + recurring invoices + price list items

The user said "go for it all" on the remaining tier-2 items.

**Estimates** — full CRUD plus `transition_estimate` (`mark_as_sent`, `mark_as_approved`, `mark_as_rejected`, `mark_as_cancelled`, `mark_as_draft`, `convert_to_invoice`). Mirrors the invoice shape.

**Recurring invoices** — read only (list + get). Writes intentionally omitted since the template shape is intricate and the flow is better handled in the FreeAgent UI.

**Price list items** — list, get, create. Catalog entries reusable across invoices and estimates.

9 new tools total. Types, schemas, tool files, registration, and per-tool tests all added.

**Commit:** `2e58fca`

---

## 11. Discount workflow — user's real-world flow

The user described a personal flow: apply 20% discount to each monthly invoice, then on client approval raise a follow-up invoice for the accumulated discount. Question: is this supported?

**State check:** `discount_percent` was readable on invoices/estimates (in the type, rendered by `getInvoice`) but not settable via any of the three create paths.

**Fix (small, focused):** added `discount_percent` (decimal string) to `CreateInvoiceInputSchema`, `InvoiceFromTimeslipsInputSchema`, and `CreateEstimateInputSchema`, plumbed through each handler. 3 new pass-through tests.

**User's follow-up:** the full recovery-invoice tool wasn't wanted — the user was happy driving that via the agent using the primitives, since it's a personal flow.

**Commit:** `c2d3901`

---

## 12. Compute + render the discount amount

The user asked: does the API expose the discount amount (not just percent)? Verification confirmed FreeAgent only returns `discount_percent`. The amount is derivable from the returned `net_value`:

```
discount_amount = net_value × pct / (100 − pct)
```

**Added:** `computeDiscountAmount(netValue, discountPercent)` helper in `src/services/formatter.ts` with guards for missing, non-numeric, zero, and `≥100` percent inputs. `getInvoice` and `getEstimate` markdown renderers now show both, e.g. `Discount: 20% (GBP 2365.00 off)`. Formatter test coverage added.

**Commit:** `2dddb7b`

---

## 13. Real-world numbers check

The user posted a real invoice: 20% discount £2,365.00 / net £9,460.00 / VAT £1,892.00 / gross £11,352.00. Verification confirmed:

| Field | Value | Derivation |
|---|---|---|
| Pre-discount subtotal | £11,825.00 | `9460 / (1 − 0.20)` |
| Discount | £2,365.00 | `11,825 − 9,460`; matches formula `9460 × 20 / 80` |
| VAT (20%) | £1,892.00 | `9460 × 0.20` |
| Gross | £11,352.00 | `9460 + 1892` |

Everything totals. Formula lands on £2,365.00 exactly.

---

## 14. Documentation update

**README.md:**
- Intro mentions estimates and bills.
- Added a note near the top per user request: *"By my own admission, most of this project is vibe coded."*
- Feature bullets now call out intent bundles, elicitation, discounts, transitions.
- "Available Tools" rebuilt as per-resource sub-tables covering all 17 new tools; intent bundles flagged.
- Project-structure tree updated with the 9 new tool files plus `services/resolvers.ts`.

**TOOLS.md:**
- `create_invoice` section notes optional `contact` (with elicitation fallback) and `discount_percent`.
- `get_invoice` section notes the rendered discount amount.
- New inline sections: `transition_invoice`, `invoice_from_timeslips`, `log_expense`, `update_timeslip`, `reconcile_bank_transaction`.
- New top-level sections: Bills, Estimates, Recurring Invoices, Price List Items.
- New "Intent Bundles at a Glance" summary table.
- Dropped the "Future Tools" section (bills + recurring invoices are no longer hypothetical).

**Commit:** `aceb9fc`

---

## 15. Suggested prompt for the next session

The user flagged two remaining flows to consider for a future session:
1. Create a task and log time against it in one shot.
2. Log time across multiple tasks / multiple days in one call.

Recommended prompt to paste on a fresh session:

> On the branch `claude/mcp-agent-techniques-DS1Uq`, this repo has three existing intent-bundle tools: `reconcile_bank_transaction`, `log_expense`, `invoice_from_timeslips`. They follow a pattern: accept human-friendly hints (names, codes, references), resolve to FreeAgent URLs via `src/services/resolvers.ts`, call the underlying API, return a crisp summary.
>
> Add an intent bundle (or pair of tools — your call) covering two flows I hit often:
> 1. **Create a task and log time against it in one shot** — project + task name → new task → one or more timeslips.
> 2. **Log time across multiple tasks / multiple days in one call** — an array of `{ task, dated_on, hours, comment }` entries.
>
> Before implementing, tell me whether you'd do this as one combined tool or two, and why. Then build, test (matching the Vitest style in `src/tools/*.test.ts`), typecheck, lint, commit.
>
> Reuse `resolveUser`/`resolveProject`-style helpers where they exist; add new ones to `src/services/resolvers.ts` if they don't. Resolve task-by-name within a project; default user to the sole account user; fetch the task's project when only a task is given.

---

## Commit log

| SHA | Scope |
|---|---|
| `8a56d60` | `reconcile_bank_transaction` intent bundle |
| `b0bcf11` | `log_expense` intent bundle + shared resolvers module |
| `64d21c5` | `invoice_from_timeslips` intent bundle |
| `1c9448a` | `transition_invoice` |
| `5a03c6e` | Bills (list/get/create) + `reconcile.paid_bill` |
| `198a423` | `update_timeslip` + `link_timeslips` flag |
| `aa0fb56` | Elicitation on `create_invoice` |
| `2e58fca` | Estimates + recurring invoices + price list items |
| `c2d3901` | `discount_percent` on the three create paths |
| `2dddb7b` | Computed discount amount in `getInvoice`/`getEstimate` |
| `aceb9fc` | README + TOOLS refresh |

## New files

```
src/services/resolvers.ts                    # shared category/user/contact/bill resolvers
src/tools/reconcile.ts                       # intent bundle
src/tools/reconcile.test.ts
src/tools/log-expense.ts                     # intent bundle
src/tools/log-expense.test.ts
src/tools/invoice-from-timeslips.ts          # intent bundle
src/tools/invoice-from-timeslips.test.ts
src/tools/transition-invoice.ts
src/tools/transition-invoice.test.ts
src/tools/bills.ts
src/tools/estimates.ts
src/tools/estimates.test.ts
src/tools/recurring-invoices.ts
src/tools/recurring-invoices.test.ts
src/tools/price-list-items.ts
src/tools/price-list-items.test.ts
src/tools/invoices.test.ts                   # elicitation coverage
```

## Notable modifications

- `src/schemas/index.ts` — 10 new input schemas; `discount_percent` on 3 create paths; `contact` on `create_invoice` relaxed to optional
- `src/tools/register.ts` — `ToolContext` for elicitation; 17 new tool registrations
- `src/tools/invoices.ts` — elicitation fallback; `discount_percent` passthrough
- `src/tools/timeslips.ts` — `update_timeslip` handler
- `src/tools/bank-transactions.ts` — untouched (still the base explanations layer)
- `src/services/formatter.ts` — `computeDiscountAmount` helper
- `src/types.ts` — types for bills, estimates, recurring invoices, price list items

## Test count

Started at **50** (before session). Ended at **93** all passing. Typecheck clean; only 3 pre-existing lint warnings in `register.ts` for `any` in the tool-definition scaffolding.

---

*Generated from session `session_01S1r16hRQ4P38rqMAM34FgD`.*
