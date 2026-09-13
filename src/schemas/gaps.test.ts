import { describe, it, expect } from "vitest";
import {
  CreateCreditNoteInputSchema,
  UploadBankStatementInputSchema,
  TransitionCreditNoteInputSchema,
  GetProfitAndLossInputSchema,
  SetAccountLockInputSchema,
} from "./gaps.js";

describe("gap schemas", () => {
  it("accepts a minimal credit note", () => {
    const parsed = CreateCreditNoteInputSchema.parse({
      contact: "https://api.freeagent.com/v2/contacts/1",
      dated_on: "2026-01-15",
      credit_note_items: [
        { item_type: "Products", description: "Refund", price: "10.00", quantity: "1" },
      ],
    });
    expect(parsed.currency).toBe("GBP");
  });

  it("requires JSON statement lines for bank upload", () => {
    expect(() =>
      UploadBankStatementInputSchema.parse({ bank_account: "1", statement: [] })
    ).toThrow();
    const parsed = UploadBankStatementInputSchema.parse({
      bank_account: "1",
      statement: [{ dated_on: "2026-01-01", amount: "-12.50", description: "Coffee" }],
    });
    expect(parsed.statement).toHaveLength(1);
  });

  it("validates credit note transitions", () => {
    expect(
      TransitionCreditNoteInputSchema.parse({
        credit_note_id: "9",
        action: "mark_as_sent",
      }).action
    ).toBe("mark_as_sent");
  });

  it("allows optional P&L dates", () => {
    expect(GetProfitAndLossInputSchema.parse({})).toBeTruthy();
  });

  it("requires account lock date", () => {
    expect(
      SetAccountLockInputSchema.parse({ locked_to_date: "2026-03-31" }).locked_to_date
    ).toBe("2026-03-31");
  });
});
