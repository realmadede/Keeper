import { describe, expect, it } from "vitest";
import type { Transaction } from "../types";
import {
  buildLedgerPdfBytes,
  computeStatementDigest,
  generateStatementCode,
  sanitizeStatementCode,
} from "./pdfStatement";

const SAMPLE_TXS: Transaction[] = [
  {
    id: "t1",
    household_id: "h1",
    recorded_by: "u1",
    paid_by: "u2",
    type: "contribution",
    amount: 45000,
    category: "contribution",
    description: "Weekly pool contribution",
    transaction_date: "2026-11-24",
    created_at: "2026-11-24T10:00:00Z",
    recorder: { id: "u1", full_name: "Bagomwa Raphael", email: "b@example.com", avatar_color: "#BFA377" },
    payer: { id: "u2", full_name: "Francis Nitunga", email: "f@example.com", avatar_color: "#3B82F6" },
  },
  {
    id: "t2",
    household_id: "h1",
    recorded_by: "u1",
    type: "expense",
    amount: 30000,
    category: "food",
    description: "Groceries & rice",
    transaction_date: "2026-11-25",
    created_at: "2026-11-25T12:00:00Z",
    updated_at: "2026-11-25T13:00:00Z",
    recorder: { id: "u1", full_name: "Bagomwa Raphael", email: "b@example.com", avatar_color: "#BFA377" },
  },
];

describe("pdfStatement", () => {
  it("generates and validates KPR-XXXX-XXXX statement verification codes", () => {
    const code = generateStatementCode();
    expect(code).toMatch(/^KPR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(sanitizeStatementCode(code.toLowerCase())).toBe(code);
    expect(sanitizeStatementCode(`https://keeper-olive.vercel.app/?verify=${code}`)).toBe(code);
    expect(sanitizeStatementCode("INVALID-123")).toBeNull();
    expect(sanitizeStatementCode(null)).toBeNull();
  });

  it("computes a deterministic SHA-256 digest that changes when any transaction is altered", async () => {
    const h1 = await computeStatementDigest("h1", SAMPLE_TXS);
    const h2 = await computeStatementDigest("h1", [...SAMPLE_TXS].reverse());
    expect(h1).toBe(h2);
    expect(h1.length).toBeGreaterThanOrEqual(16);

    const tampered = [{ ...SAMPLE_TXS[0], amount: 90000 }, SAMPLE_TXS[1]];
    const hTampered = await computeStatementDigest("h1", tampered);
    expect(hTampered).not.toBe(h1);
  });

  it("builds a valid multi-page PDF 1.4 binary with verification details and vector QR", async () => {
    const manyTxs: Transaction[] = Array.from({ length: 42 }, (_, idx) => ({
      ...SAMPLE_TXS[idx % 2],
      id: `tx-${idx}`,
      description: `Entry number ${idx + 1}`,
    }));
    const digest = await computeStatementDigest("h1", manyTxs);
    const pdfBytes = buildLedgerPdfBytes({
      householdName: "DHA 3",
      preparedBy: "Bagomwa Raphael",
      filterLabel: "November 2026",
      generatedAt: new Date(2026, 10, 28, 15, 0),
      transactions: manyTxs,
      verificationCode: "KPR-8F3A-29C1",
      contentHash: digest,
    });

    const text = new TextDecoder("latin1").decode(pdfBytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("h f*"); // Real Keeper vector emblem with keyhole cutout
    expect(text).not.toContain("(K) Tj");
    expect(text).toContain("STATEMENT ID: KPR-8F3A-29C1");
    expect(text).toContain("AUTHENTICITY VERIFICATION");
    expect(text).toContain("Page 1 of 2");
    expect(text).toContain("Page 2 of 2");
  });

  it("marks offline PDFs clearly as unverified drafts without issuing a fake code", async () => {
    const digest = await computeStatementDigest("h1", SAMPLE_TXS);
    const pdfBytes = buildLedgerPdfBytes({
      householdName: "DHA 3",
      preparedBy: "Bagomwa Raphael",
      filterLabel: "All entries",
      generatedAt: new Date(2026, 10, 28, 15, 0),
      transactions: SAMPLE_TXS,
      verificationCode: null,
      contentHash: digest,
    });

    const text = new TextDecoder("latin1").decode(pdfBytes);
    expect(text).toContain("OFFLINE DRAFT - NOT SERVER-VERIFIED");
    expect(text).not.toContain("AUTHENTICITY VERIFICATION");
  });
});
