import { describe, it, expect } from "vitest";
import {
  PaginationSchema,
  ListContactsInputSchema,
  GetContactInputSchema,
  CreateContactInputSchema,
  CreateInvoiceInputSchema,
  ListExpensesInputSchema,
} from "./index.js";

describe("PaginationSchema", () => {
  it("accepts valid pagination params", () => {
    const result = PaginationSchema.parse({ page: 1, per_page: 25 });
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(25);
  });

  it("provides defaults when omitted", () => {
    const result = PaginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(25);
  });

  it("rejects page < 1", () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
  });

  it("rejects per_page > 100", () => {
    expect(() => PaginationSchema.parse({ per_page: 101 })).toThrow();
  });

  it("rejects non-integer page", () => {
    expect(() => PaginationSchema.parse({ page: 1.5 })).toThrow();
  });
});

describe("ListContactsInputSchema", () => {
  it("accepts minimal input with defaults", () => {
    const result = ListContactsInputSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(25);
    expect(result.response_format).toBe("markdown");
  });

  it("accepts valid sort field", () => {
    const result = ListContactsInputSchema.parse({ sort: "first_name" });
    expect(result.sort).toBe("first_name");
  });

  it("rejects invalid sort field", () => {
    expect(() => ListContactsInputSchema.parse({ sort: "invalid" })).toThrow();
  });

  it("rejects extra fields (strict mode)", () => {
    expect(() =>
      ListContactsInputSchema.parse({ unknown_field: "value" })
    ).toThrow();
  });
});

describe("GetContactInputSchema", () => {
  it("accepts numeric ID string", () => {
    const result = GetContactInputSchema.parse({ contact_id: "12345" });
    expect(result.contact_id).toBe("12345");
  });

  it("accepts full URL as ID", () => {
    const result = GetContactInputSchema.parse({
      contact_id: "https://api.freeagent.com/v2/contacts/12345",
    });
    expect(result.contact_id).toContain("12345");
  });

  it("rejects empty ID", () => {
    expect(() => GetContactInputSchema.parse({ contact_id: "" })).toThrow();
  });
});

describe("CreateContactInputSchema", () => {
  it("accepts contact with organisation name", () => {
    const result = CreateContactInputSchema.parse({
      organisation_name: "Acme Ltd",
    });
    expect(result.organisation_name).toBe("Acme Ltd");
  });

  it("accepts contact with name fields", () => {
    const result = CreateContactInputSchema.parse({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
    });
    expect(result.first_name).toBe("John");
    expect(result.email).toBe("john@example.com");
  });

  it("rejects invalid email", () => {
    expect(() =>
      CreateContactInputSchema.parse({ email: "not-an-email" })
    ).toThrow();
  });
});

describe("CreateInvoiceInputSchema", () => {
  it("accepts valid invoice with line items", () => {
    const result = CreateInvoiceInputSchema.parse({
      contact: "12345",
      dated_on: "2024-01-15",
      invoice_items: [
        {
          item_type: "Hours",
          description: "Consulting",
          price: "100.00",
          quantity: "8",
        },
      ],
    });
    expect(result.contact).toBe("12345");
    expect(result.currency).toBe("GBP"); // default
    expect(result.invoice_items).toHaveLength(1);
  });

  it("rejects invalid date format", () => {
    expect(() =>
      CreateInvoiceInputSchema.parse({
        contact: "12345",
        dated_on: "15/01/2024",
        invoice_items: [
          { item_type: "Hours", description: "x", price: "1", quantity: "1" },
        ],
      })
    ).toThrow();
  });

  it("rejects empty invoice items", () => {
    expect(() =>
      CreateInvoiceInputSchema.parse({
        contact: "12345",
        dated_on: "2024-01-15",
        invoice_items: [],
      })
    ).toThrow();
  });
});

describe("ListExpensesInputSchema", () => {
  it("validates date filters format", () => {
    const result = ListExpensesInputSchema.parse({
      from_date: "2024-01-01",
      to_date: "2024-01-31",
    });
    expect(result.from_date).toBe("2024-01-01");
    expect(result.to_date).toBe("2024-01-31");
  });

  it("rejects invalid date format", () => {
    expect(() =>
      ListExpensesInputSchema.parse({ from_date: "01-01-2024" })
    ).toThrow();
  });
});
