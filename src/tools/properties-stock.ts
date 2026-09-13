import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse, extractIdFromUrl } from "../services/formatter.js";
import { resourcePath } from "../utils/resource-path.js";

import type {
  ListPropertiesInput, GetPropertyInput, CreatePropertyInput, UpdatePropertyInput, DeletePropertyInput,
  ListStockItemsInput, GetStockItemInput,
  ListHirePurchasesInput, GetHirePurchaseInput,
} from "../schemas/index.js";

interface Property { url: string; address?: string; property_type?: string; }
interface StockItem { url: string; description?: string; stock_level?: string; }
interface HirePurchase { url: string; description?: string; }

export async function listProperties(client: FreeAgentApiClient, params: ListPropertiesInput): Promise<string> {
  const response = await client.get<{ properties: Property[] }>("/properties");
  const items = response.data.properties ?? [];
  return formatResponse({ properties: items }, params.response_format, () => {
    if (!items.length) return "No properties found.";
    const lines = ["# Properties", ""];
    for (const p of items) {
      lines.push(`## ${extractIdFromUrl(p.url)}`);
      lines.push(`- Address: ${p.address ?? ""}`);
      lines.push(`- Type: ${p.property_type ?? ""}`, "");
    }
    return lines.join("\n");
  });
}

export async function getProperty(client: FreeAgentApiClient, params: GetPropertyInput): Promise<string> {
  const response = await client.get<{ property: Property }>(resourcePath(params.property_id, "properties"));
  const p = response.data.property;
  return formatResponse(p, params.response_format, () =>
    `# Property ${extractIdFromUrl(p.url)}\n\n- Address: ${p.address ?? ""}\n- Type: ${p.property_type ?? ""}\n- URL: ${p.url}`
  );
}

export async function createProperty(client: FreeAgentApiClient, params: CreatePropertyInput): Promise<string> {
  const response = await client.post<{ property: Property }>("/properties", { property: params });
  return `✅ Property created ${extractIdFromUrl(response.data.property.url)}\n**URL**: ${response.data.property.url}`;
}

export async function updateProperty(client: FreeAgentApiClient, params: UpdatePropertyInput): Promise<string> {
  const { property_id, ...fields } = params;
  const response = await client.put<{ property: Property }>(
    resourcePath(property_id, "properties"),
    { property: fields }
  );
  return `✅ Property updated ${extractIdFromUrl(response.data.property.url)}`;
}

export async function deleteProperty(client: FreeAgentApiClient, params: DeletePropertyInput): Promise<string> {
  await client.delete(resourcePath(params.property_id, "properties"));
  return `✅ Property deleted: ${params.property_id}`;
}

export async function listStockItems(client: FreeAgentApiClient, params: ListStockItemsInput): Promise<string> {
  const response = await client.get<{ stock_items: StockItem[] }>("/stock_items");
  const items = response.data.stock_items ?? [];
  return formatResponse({ stock_items: items }, params.response_format, () => {
    if (!items.length) return "No stock items found.";
    const lines = ["# Stock Items", ""];
    for (const s of items) {
      lines.push(`- ${s.description ?? extractIdFromUrl(s.url)} (level: ${s.stock_level ?? "?"}) — ${s.url}`);
    }
    return lines.join("\n");
  });
}

export async function getStockItem(client: FreeAgentApiClient, params: GetStockItemInput): Promise<string> {
  const response = await client.get<{ stock_item: StockItem }>(resourcePath(params.stock_item_id, "stock_items"));
  const s = response.data.stock_item;
  return formatResponse(s, params.response_format, () =>
    `# Stock Item\n\n- ${s.description ?? ""}\n- Level: ${s.stock_level ?? ""}\n- URL: ${s.url}`
  );
}

export async function listHirePurchases(client: FreeAgentApiClient, params: ListHirePurchasesInput): Promise<string> {
  const response = await client.get<{ hire_purchases: HirePurchase[] }>("/hire_purchases");
  const items = response.data.hire_purchases ?? [];
  return formatResponse({ hire_purchases: items }, params.response_format, () => {
    if (!items.length) return "No hire purchases found.";
    const lines = ["# Hire Purchases", ""];
    for (const h of items) lines.push(`- ${h.description ?? extractIdFromUrl(h.url)} — ${h.url}`);
    return lines.join("\n");
  });
}

export async function getHirePurchase(client: FreeAgentApiClient, params: GetHirePurchaseInput): Promise<string> {
  const response = await client.get<{ hire_purchase: HirePurchase }>(resourcePath(params.hire_purchase_id, "hire_purchases"));
  const h = response.data.hire_purchase;
  return formatResponse(h, params.response_format, () =>
    `# Hire Purchase\n\n- ${h.description ?? ""}\n- URL: ${h.url}`
  );
}
