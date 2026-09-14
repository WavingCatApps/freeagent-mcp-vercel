import { describe, it, expect } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { shapeToInputJsonSchema, probeToolsListSchemas } from "./json-schema.js";
import {
  toolSearchMetaDefinitions,
  toolDefinitions,
  isToolSearchMode,
  registerAllTools,
} from "./register.js";
import { FreeAgentApiClient } from "../services/api-client.js";

describe("shapeToInputJsonSchema", () => {
  it("converts a Zod raw shape to an object schema without $schema", () => {
    const shape = z
      .object({
        query: z.string().min(1),
        max_results: z.number().int().default(5),
      })
      .strict().shape;
    const json = shapeToInputJsonSchema(shape);
    expect(json.type).toBe("object");
    expect(json.properties).toBeTypeOf("object");
    expect(json).not.toHaveProperty("$schema");
    expect((json.properties as Record<string, unknown>).query).toBeTruthy();
  });

  it("converts empty shape without throwing", () => {
    const json = shapeToInputJsonSchema({});
    expect(json.type).toBe("object");
    expect(json.properties).toEqual({});
  });

  it("never throws on garbage input", () => {
    expect(shapeToInputJsonSchema(undefined).type).toBe("object");
    expect(shapeToInputJsonSchema(null).type).toBe("object");
    expect(shapeToInputJsonSchema(42).type).toBe("object");
  });
});

describe("probeToolsListSchemas", () => {
  it("succeeds for meta-tools and full catalog", () => {
    expect(probeToolsListSchemas(toolSearchMetaDefinitions).ok).toBe(true);
    expect(probeToolsListSchemas(toolSearchMetaDefinitions).count).toBe(2);
    const full = probeToolsListSchemas(toolDefinitions);
    expect(full.ok).toBe(true);
    expect(full.count).toBeGreaterThan(50);
  });
});

describe("safe tools/list handler", () => {
  it("returns meta-tools with object inputSchema under Vercel tool-search mode", async () => {
    const originalVercel = process.env.VERCEL;
    const originalSearch = process.env.FREEAGENT_TOOL_SEARCH;
    try {
      process.env.VERCEL = "1";
      delete process.env.FREEAGENT_TOOL_SEARCH;
      expect(isToolSearchMode()).toBe(true);

      const server = new McpServer({ name: "t", version: "1" });
      registerAllTools(server, new FreeAgentApiClient("x", false));
      const listHandler = (server.server as any)._requestHandlers.get("tools/list");
      expect(listHandler).toBeTypeOf("function");
      const result = await listHandler({ method: "tools/list", params: {} });
      expect(result.tools).toHaveLength(2);
      for (const tool of result.tools) {
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeTypeOf("object");
      }
      const names = result.tools.map((t: { name: string }) => t.name).sort();
      expect(names).toEqual(["freeagent_call_tool", "freeagent_search_tools"]);
    } finally {
      if (originalVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = originalVercel;
      if (originalSearch === undefined) delete process.env.FREEAGENT_TOOL_SEARCH;
      else process.env.FREEAGENT_TOOL_SEARCH = originalSearch;
    }
  });

  it("resources/list and prompts/list return empty arrays", async () => {
    const originalVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = "1";
      const server = new McpServer({ name: "t", version: "1" });
      registerAllTools(server, new FreeAgentApiClient("x", false));
      const handlers = (server.server as any)._requestHandlers;
      const resources = await handlers.get("resources/list")({
        method: "resources/list",
        params: {},
      });
      const prompts = await handlers.get("prompts/list")({
        method: "prompts/list",
        params: {},
      });
      expect(resources).toEqual({ resources: [] });
      expect(prompts).toEqual({ prompts: [] });
    } finally {
      if (originalVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = originalVercel;
    }
  });
});
