import type { FreeAgentApiClient } from "../services/api-client.js";
import { formatResponse, extractIdFromUrl } from "../services/formatter.js";
import { resourcePath } from "../utils/resource-path.js";

import type {
  ListCapitalAssetsInput, GetCapitalAssetInput,
  ListCapitalAssetTypesInput, GetCapitalAssetTypeInput,
  CreateCapitalAssetTypeInput, UpdateCapitalAssetTypeInput, DeleteCapitalAssetTypeInput,
} from "../schemas/index.js";

interface CapitalAsset { url: string; description?: string; asset_type?: string; status?: string; }
interface CapitalAssetType { url: string; name?: string; }

export async function listCapitalAssets(client: FreeAgentApiClient, params: ListCapitalAssetsInput): Promise<string> {
  const q: Record<string, string | number | boolean> = { page: params.page, per_page: params.per_page };
  if (params.view) q.view = params.view;
  if (params.include_history) q.include_history = true;
  const response = await client.get<{ capital_assets: CapitalAsset[] }>("/capital_assets", q);
  const items = response.data.capital_assets ?? [];
  return formatResponse({ capital_assets: items }, params.response_format, () => {
    if (!items.length) return "No capital assets found.";
    const lines = ["# Capital Assets", ""];
    for (const a of items) {
      lines.push(`## ${extractIdFromUrl(a.url)}`);
      lines.push(`- ${a.description ?? ""}`);
      lines.push(`- Type: ${a.asset_type ?? ""}`);
      lines.push(`- Status: ${a.status ?? ""}`, "");
    }
    return lines.join("\n");
  });
}

export async function getCapitalAsset(client: FreeAgentApiClient, params: GetCapitalAssetInput): Promise<string> {
  const response = await client.get<{ capital_asset: CapitalAsset }>(resourcePath(params.capital_asset_id, "capital_assets"));
  const a = response.data.capital_asset;
  return formatResponse(a, params.response_format, () =>
    `# Capital Asset ${extractIdFromUrl(a.url)}\n\n- ${a.description ?? ""}\n- Type: ${a.asset_type ?? ""}\n- Status: ${a.status ?? ""}\n- URL: ${a.url}`
  );
}

export async function listCapitalAssetTypes(client: FreeAgentApiClient, params: ListCapitalAssetTypesInput): Promise<string> {
  const response = await client.get<{ capital_asset_types: CapitalAssetType[] }>("/capital_asset_types");
  const items = response.data.capital_asset_types ?? [];
  return formatResponse({ capital_asset_types: items }, params.response_format, () => {
    if (!items.length) return "No capital asset types found.";
    const lines = ["# Capital Asset Types", ""];
    for (const t of items) lines.push(`- ${t.name ?? extractIdFromUrl(t.url)} (${t.url})`);
    return lines.join("\n");
  });
}

export async function getCapitalAssetType(client: FreeAgentApiClient, params: GetCapitalAssetTypeInput): Promise<string> {
  const response = await client.get<{ capital_asset_type: CapitalAssetType }>(
    resourcePath(params.capital_asset_type_id, "capital_asset_types")
  );
  const t = response.data.capital_asset_type;
  return formatResponse(t, params.response_format, () => `# Capital Asset Type\n\n- **Name**: ${t.name}\n- **URL**: ${t.url}`);
}

export async function createCapitalAssetType(client: FreeAgentApiClient, params: CreateCapitalAssetTypeInput): Promise<string> {
  const response = await client.post<{ capital_asset_type: CapitalAssetType }>(
    "/capital_asset_types", { capital_asset_type: params }
  );
  const t = response.data.capital_asset_type;
  return `✅ Capital asset type created: ${t.name} (${t.url})`;
}

export async function updateCapitalAssetType(client: FreeAgentApiClient, params: UpdateCapitalAssetTypeInput): Promise<string> {
  const { capital_asset_type_id, ...fields } = params;
  const response = await client.put<{ capital_asset_type: CapitalAssetType }>(
    resourcePath(capital_asset_type_id, "capital_asset_types"),
    { capital_asset_type: fields }
  );
  return `✅ Capital asset type updated: ${response.data.capital_asset_type.name}`;
}

export async function deleteCapitalAssetType(client: FreeAgentApiClient, params: DeleteCapitalAssetTypeInput): Promise<string> {
  await client.delete(resourcePath(params.capital_asset_type_id, "capital_asset_types"));
  return `✅ Capital asset type deleted: ${params.capital_asset_type_id}`;
}
