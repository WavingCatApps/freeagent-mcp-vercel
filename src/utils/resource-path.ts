/**
 * Normalize a FreeAgent resource identifier (numeric ID or full URL) to an API path.
 */
export function resourcePath(idOrUrl: string, collection: string): string {
  if (idOrUrl.startsWith("http://") || idOrUrl.startsWith("https://")) {
    const match = idOrUrl.match(/\/v2(\/.*)$/);
    if (match) return match[1];
    // Fall back to last path segment if the URL shape is unexpected
    const parts = idOrUrl.replace(/\/$/, "").split("/");
    return `/${collection}/${parts[parts.length - 1]}`;
  }
  return `/${collection}/${idOrUrl}`;
}

/**
 * Extract a bare ID from a numeric ID or FreeAgent URL.
 */
export function resourceId(idOrUrl: string): string {
  if (idOrUrl.startsWith("http://") || idOrUrl.startsWith("https://")) {
    const parts = idOrUrl.replace(/\/$/, "").split("/");
    return parts[parts.length - 1];
  }
  return idOrUrl;
}
