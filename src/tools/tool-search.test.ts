import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { matchTools, searchTools, callTool } from "./tool-search.js";
import type { ToolDefinition, ToolContext } from "./register.js";
import type { FreeAgentApiClient } from "../services/api-client.js";
import {
  toolDefinitions,
  toolSearchMetaDefinitions,
  isToolSearchMode,
} from "./register.js";

const FixtureSchema = z.object({
  id: z.string().min(1),
  count: z.number().int().min(1).default(1),
}).strict();

const mockCtx: ToolContext = {
  clientSupportsElicitation: false,
  elicit: async () => ({ action: "cancel" }) as never,
};

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: overrides.name ?? "freeagent_fixture",
    title: overrides.title ?? "Fixture Tool",
    description: overrides.description ?? "A fixture tool used for tests.",
    inputSchema: overrides.inputSchema ?? FixtureSchema.shape,
    annotations: overrides.annotations ?? {
      readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
    },
    handler: overrides.handler ?? (async () => "ok"),
  };
}

const stubApiClient = {} as FreeAgentApiClient;

describe("matchTools", () => {
  const catalog: ToolDefinition[] = [
    makeTool({
      name: "freeagent_list_invoices",
      title: "List FreeAgent Invoices",
      description: "List invoices with filtering and pagination.",
    }),
    makeTool({
      name: "freeagent_create_invoice",
      title: "Create FreeAgent Invoice",
      description: "Create a new invoice in FreeAgent.",
    }),
    makeTool({
      name: "freeagent_list_contacts",
      title: "List FreeAgent Contacts",
      description: "List all contacts in your FreeAgent account.",
    }),
    makeTool({
      name: "freeagent_reconcile_bank_transaction",
      title: "Reconcile FreeAgent Bank Transaction",
      description: "Explain a bank transaction in one call.",
    }),
  ];

  it("returns empty for an empty query", () => {
    expect(matchTools(catalog, "   ", 5)).toHaveLength(0);
  });

  it("ranks name matches ahead of description-only matches", () => {
    const biased: ToolDefinition[] = [
      makeTool({
        name: "freeagent_get_contact",
        title: "Get FreeAgent Contact",
        description: "Retrieve a contact by ID.",
      }),
      makeTool({
        name: "freeagent_reconcile_bank_transaction",
        title: "Reconcile FreeAgent Bank Transaction",
        description: "Explain a contact's bank transaction in one call.",
      }),
    ];
    const results = matchTools(biased, "contact", 5);
    expect(results[0]?.name).toBe("freeagent_get_contact");
  });

  it("treats plural forms as prefix matches", () => {
    const results = matchTools(catalog, "invoice", 5);
    const names = results.map((t) => t.name);
    expect(names).toContain("freeagent_list_invoices");
    expect(names).toContain("freeagent_create_invoice");
  });

  it("respects max_results", () => {
    const results = matchTools(catalog, "freeagent", 2);
    expect(results).toHaveLength(2);
  });

  it("filters by required '+' terms", () => {
    const results = matchTools(catalog, "+reconcile bank", 5);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("freeagent_reconcile_bank_transaction");
  });

  it("drops tools that do not satisfy required terms", () => {
    const results = matchTools(catalog, "+nonexistentword invoice", 5);
    expect(results).toHaveLength(0);
  });

  it("handles multi-word keyword queries", () => {
    const results = matchTools(catalog, "list contacts", 5);
    expect(results[0].name).toBe("freeagent_list_contacts");
  });
});

describe("searchTools handler", () => {
  const catalog: ToolDefinition[] = [
    makeTool({
      name: "freeagent_list_invoices",
      description: "List invoices with filtering and pagination.",
    }),
    makeTool({
      name: "freeagent_get_contact",
      description: "Retrieve a contact by ID.",
    }),
  ];

  it("wraps matches in <functions> blocks with embedded JSONSchema", async () => {
    const out = await searchTools(catalog, { query: "invoice", max_results: 5 });
    expect(out).toMatch(/^<functions>/);
    expect(out).toMatch(/<\/functions>$/);
    expect(out).toContain("<function>");
    expect(out).toContain("\"name\":\"freeagent_list_invoices\"");
    expect(out).toContain("\"parameters\":");
    expect(out).toContain("\"type\":\"object\"");
  });

  it("returns a helpful message when nothing matches", async () => {
    const out = await searchTools(catalog, { query: "nothingmatcheshere", max_results: 5 });
    expect(out).toContain("No matching tools found");
  });

  it("supports select: queries for direct name lookup", async () => {
    const out = await searchTools(catalog, {
      query: "select:freeagent_get_contact",
      max_results: 5,
    });
    expect(out).toContain("freeagent_get_contact");
    expect(out).not.toContain("freeagent_list_invoices");
  });

  it("returns a diagnostic when a select: query names no known tools", async () => {
    const out = await searchTools(catalog, {
      query: "select:freeagent_does_not_exist",
      max_results: 5,
    });
    expect(out).toContain("No tools matched select query");
  });
});

describe("callTool handler", () => {
  it("validates arguments and dispatches to the named tool", async () => {
    const handler: ToolDefinition["handler"] = vi.fn(async () => "handler-response");
    const catalog = [makeTool({ name: "freeagent_fixture", handler })];

    const result = await callTool(
      catalog,
      stubApiClient,
      { name: "freeagent_fixture", arguments: { id: "abc", count: 3 } },
      mockCtx,
    );

    expect(result).toBe("handler-response");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      stubApiClient,
      expect.objectContaining({ id: "abc", count: 3 }),
      mockCtx,
    );
  });

  it("applies Zod defaults before dispatching", async () => {
    const handler: ToolDefinition["handler"] = vi.fn(async () => "ok");
    const catalog = [makeTool({ name: "freeagent_fixture", handler })];

    await callTool(
      catalog,
      stubApiClient,
      { name: "freeagent_fixture", arguments: { id: "abc" } },
      mockCtx,
    );

    expect(handler).toHaveBeenCalledWith(
      stubApiClient,
      expect.objectContaining({ id: "abc", count: 1 }),
      mockCtx,
    );
  });

  it("throws a readable error for unknown tool names", async () => {
    const catalog = [makeTool({ name: "freeagent_fixture" })];

    await expect(
      callTool(
        catalog,
        stubApiClient,
        { name: "freeagent_missing", arguments: {} },
        mockCtx,
      )
    ).rejects.toThrow(/Unknown tool 'freeagent_missing'/);
  });

  it("rejects arguments that fail schema validation", async () => {
    const handler = vi.fn(async () => "never");
    const catalog = [makeTool({ name: "freeagent_fixture", handler })];

    await expect(
      callTool(
        catalog,
        stubApiClient,
        { name: "freeagent_fixture", arguments: { count: -1 } },
        mockCtx,
      )
    ).rejects.toThrow(/Invalid arguments for freeagent_fixture/);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("tool-search mode wiring", () => {
  it("exposes exactly two meta-tools with stable names", () => {
    const names = toolSearchMetaDefinitions.map((t) => t.name).sort();
    expect(names).toEqual(["freeagent_call_tool", "freeagent_search_tools"]);
  });

  it("registers every catalog tool with a unique name", () => {
    const names = toolDefinitions.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("reads FREEAGENT_TOOL_SEARCH from the environment", () => {
    const original = process.env.FREEAGENT_TOOL_SEARCH;
    try {
      process.env.FREEAGENT_TOOL_SEARCH = "true";
      expect(isToolSearchMode()).toBe(true);
      process.env.FREEAGENT_TOOL_SEARCH = "1";
      expect(isToolSearchMode()).toBe(true);
      process.env.FREEAGENT_TOOL_SEARCH = "false";
      expect(isToolSearchMode()).toBe(false);
      delete process.env.FREEAGENT_TOOL_SEARCH;
      expect(isToolSearchMode()).toBe(false);
    } finally {
      if (original === undefined) delete process.env.FREEAGENT_TOOL_SEARCH;
      else process.env.FREEAGENT_TOOL_SEARCH = original;
    }
  });

  it("search meta-tool finds real catalog entries like list_invoices", async () => {
    const searchDef = toolSearchMetaDefinitions.find((t) => t.name === "freeagent_search_tools")!;
    const out = await searchDef.handler(stubApiClient, { query: "list invoices", max_results: 3 }, mockCtx);
    expect(out).toContain("freeagent_list_invoices");
  });

  it("call meta-tool routes to a real catalog tool", async () => {
    const callDef = toolSearchMetaDefinitions.find((t) => t.name === "freeagent_call_tool")!;
    const target = toolDefinitions.find((t) => t.name === "freeagent_get_company")!;
    const spy = vi.spyOn(target, "handler").mockResolvedValue("company-response");
    try {
      const out = await callDef.handler(
        stubApiClient,
        { name: "freeagent_get_company", arguments: {} },
        mockCtx,
      );
      expect(out).toBe("company-response");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
