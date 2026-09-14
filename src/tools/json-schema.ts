/**
 * Convert Zod input shapes to MCP tool inputSchema JSON Schema objects.
 *
 * Uses our app's `zod` import (not the MCP SDK's zod/v4-mini compat path) so
 * Vercel bundling / dual-package hazards cannot break tools/list conversion.
 */

import { z } from "zod";

const EMPTY_OBJECT_SCHEMA = {
  type: "object" as const,
  properties: {},
  additionalProperties: false as const,
};

/**
 * Convert a Zod raw shape (or already-built object schema) into a plain JSON
 * Schema object suitable for MCP tools/list `inputSchema`.
 *
 * Never throws: on conversion failure returns an empty object schema so one
 * bad tool cannot take down the entire tools/list response with -32603.
 */
export function shapeToInputJsonSchema(shape: unknown): Record<string, unknown> {
  try {
    if (shape == null) {
      return { ...EMPTY_OBJECT_SCHEMA };
    }

    // Already a JSON Schema-ish object (has type: "object") — pass through.
    if (
      typeof shape === "object" &&
      !Array.isArray(shape) &&
      "type" in shape &&
      (shape as { type?: unknown }).type === "object" &&
      !("_zod" in shape) &&
      !("_def" in shape)
    ) {
      return shape as Record<string, unknown>;
    }

    // Full Zod object schema
    if (typeof shape === "object" && shape !== null && "_zod" in shape) {
      return normalizeJsonSchema(z.toJSONSchema(shape as z.ZodType, { target: "draft-7" }));
    }

    // Zod raw shape (Record<string, ZodType>) — what we store on ToolDefinition
    if (typeof shape === "object" && shape !== null) {
      const values = Object.values(shape as Record<string, unknown>);
      const looksLikeShape =
        values.length === 0 ||
        values.every(
          (v) =>
            typeof v === "object" &&
            v !== null &&
            ("_zod" in v || "_def" in v || typeof (v as { parse?: unknown }).parse === "function")
        );
      if (looksLikeShape) {
        const objectSchema = z.object(shape as z.ZodRawShape);
        return normalizeJsonSchema(z.toJSONSchema(objectSchema, { target: "draft-7" }));
      }
    }

    return { ...EMPTY_OBJECT_SCHEMA };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        component: "json-schema",
        message: "Failed to convert tool input schema; using empty object schema",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { ...EMPTY_OBJECT_SCHEMA };
  }
}

function normalizeJsonSchema(json: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _schema, ...rest } = json;
  if (rest.type !== "object") {
    rest.type = "object";
  }
  if (rest.properties == null || typeof rest.properties !== "object") {
    rest.properties = {};
  }
  // MCP tool inputSchema is always a closed object; keep false when Zod emits it.
  if (rest.additionalProperties === undefined) {
    rest.additionalProperties = false;
  }
  return rest;
}

/**
 * Probe tools/list schema conversion for the tools that would be registered
 * in the current mode. Used by /health so preview debugging does not need OAuth.
 */
export function probeToolsListSchemas(
  tools: Array<{ name: string; inputSchema: unknown }>
): { ok: boolean; count: number; error: string | null; tools: string[] } {
  try {
    for (const tool of tools) {
      const schema = shapeToInputJsonSchema(tool.inputSchema);
      if (schema.type !== "object") {
        return {
          ok: false,
          count: tools.length,
          error: `${tool.name}: converted schema missing type object`,
          tools: tools.map((t) => t.name),
        };
      }
    }
    return {
      ok: true,
      count: tools.length,
      error: null,
      tools: tools.map((t) => t.name),
    };
  } catch (error) {
    return {
      ok: false,
      count: tools.length,
      error: error instanceof Error ? error.message : String(error),
      tools: tools.map((t) => t.name),
    };
  }
}
