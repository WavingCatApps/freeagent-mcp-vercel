import { describe, it, expect } from "vitest";
import {
  truncateIfNeeded,
  formatDate,
  formatDateTime,
  formatCurrency,
  extractIdFromUrl,
  formatContactName,
  formatResponse,
  createPaginationMetadata,
} from "./formatter.js";
import { ResponseFormat } from "../constants.js";

describe("truncateIfNeeded", () => {
  it("returns text unchanged when under limit", () => {
    const text = "short text";
    expect(truncateIfNeeded(text)).toBe(text);
  });

  it("truncates long text with metadata", () => {
    const text = "x".repeat(30000);
    const result = truncateIfNeeded(text, { count: 10, total: 100 });
    expect(result.length).toBeLessThan(text.length);
    expect(result).toContain("truncated");
    expect(result).toContain("10 of 100");
  });

  it("truncates long text without metadata", () => {
    const text = "x".repeat(30000);
    const result = truncateIfNeeded(text);
    expect(result).toContain("truncated");
    expect(result).toContain("25000 characters");
  });
});

describe("formatDate", () => {
  it("formats ISO date string to YYYY-MM-DD", () => {
    expect(formatDate("2024-03-15T10:30:00Z")).toBe("2024-03-15");
  });

  it("returns original string on invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatDateTime", () => {
  it("formats ISO datetime to readable UTC", () => {
    const result = formatDateTime("2024-03-15T10:30:45Z");
    expect(result).toBe("2024-03-15 10:30:45 UTC");
  });

  it("returns original string on invalid datetime", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });
});

describe("formatCurrency", () => {
  it("formats numeric string with currency code", () => {
    expect(formatCurrency("1234.50", "GBP")).toBe("GBP 1234.50");
  });

  it("defaults to GBP", () => {
    expect(formatCurrency("100.00")).toBe("GBP 100.00");
  });

  it("handles non-numeric input gracefully", () => {
    expect(formatCurrency("abc", "USD")).toBe("abc");
  });

  it("formats to 2 decimal places", () => {
    expect(formatCurrency("99.9", "EUR")).toBe("EUR 99.90");
  });
});

describe("extractIdFromUrl", () => {
  it("extracts ID from FreeAgent URL", () => {
    expect(extractIdFromUrl("https://api.freeagent.com/v2/contacts/12345")).toBe("12345");
  });

  it("handles plain ID string", () => {
    expect(extractIdFromUrl("12345")).toBe("12345");
  });
});

describe("formatContactName", () => {
  it("returns organisation name when present", () => {
    expect(formatContactName({ organisation_name: "Acme Ltd" })).toBe("Acme Ltd");
  });

  it("returns full name from first and last", () => {
    expect(formatContactName({ first_name: "John", last_name: "Doe" })).toBe("John Doe");
  });

  it("returns first name only when no last name", () => {
    expect(formatContactName({ first_name: "Jane" })).toBe("Jane");
  });

  it("returns 'Unnamed Contact' when no name fields", () => {
    expect(formatContactName({})).toBe("Unnamed Contact");
  });
});

describe("formatResponse", () => {
  it("returns JSON when format is JSON", () => {
    const data = { foo: "bar" };
    const result = formatResponse(data, ResponseFormat.JSON, () => "markdown");
    expect(JSON.parse(result)).toEqual(data);
  });

  it("returns markdown when format is MARKDOWN", () => {
    const result = formatResponse({}, ResponseFormat.MARKDOWN, () => "# Hello");
    expect(result).toBe("# Hello");
  });
});

describe("createPaginationMetadata", () => {
  it("includes page and per_page info", () => {
    const result = createPaginationMetadata({
      page: 1,
      perPage: 25,
      hasMore: false,
    });
    expect(result).toContain("Page 1");
    expect(result).toContain("25 items");
  });

  it("includes total count when provided", () => {
    const result = createPaginationMetadata({
      page: 1,
      perPage: 25,
      totalCount: 100,
      hasMore: true,
      nextPage: 2,
    });
    expect(result).toContain("Total: 100");
    expect(result).toContain("page=2");
  });

  it("omits next page when no more results", () => {
    const result = createPaginationMetadata({
      page: 1,
      perPage: 25,
      totalCount: 10,
      hasMore: false,
    });
    expect(result).not.toContain("page=");
  });
});
