import { Capacitor, registerPlugin } from "@capacitor/core";
import { getCategoryMeta, type Transaction } from "../types";
import { formatTZS } from "./format";
import { generateQrMatrix } from "./qr";

export const VERIFY_BASE_URL = "https://keeper-olive.vercel.app";

const STATEMENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STATEMENT_CODE_RE = /^KPR-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

interface PdfExporterPlugin {
  saveAndSharePdf(options: {
    filename: string;
    base64: string;
  }): Promise<{ savedToDownloads: boolean; filename: string }>;
}

const NativePdfExporter = registerPlugin<PdfExporterPlugin>("PdfExporter");

export function sanitizeStatementCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let candidate = raw.trim();
  if (!candidate) return null;
  if (candidate.includes("verify=") || /^https?:\/\//i.test(candidate)) {
    try {
      const parsed = new URL(
        /^https?:\/\//i.test(candidate)
          ? candidate
          : `https://keeper.local/${candidate.replace(/^\/+/, "")}`,
      );
      const param = parsed.searchParams.get("verify") ?? parsed.searchParams.get("code");
      if (!param) return null;
      candidate = param.trim();
    } catch {
      return null;
    }
  }
  const normalized = candidate.toUpperCase();
  return STATEMENT_CODE_RE.test(normalized) ? normalized : null;
}

export function generateStatementCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let chars = "";
  for (const b of bytes) {
    chars += STATEMENT_CODE_ALPHABET[b % STATEMENT_CODE_ALPHABET.length];
  }
  return `KPR-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function buildVerifyUrl(code: string): string {
  return `${VERIFY_BASE_URL}/?verify=${encodeURIComponent(code)}`;
}

/**
 * Computes a deterministic SHA-256 hex digest over the household ID and exact ledger rows.
 * Used both when issuing a statement receipt and when re-verifying against live records.
 */
export async function computeStatementDigest(
  householdId: string,
  transactions: Transaction[],
): Promise<string> {
  const canonicalRows = [...transactions]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((tx) =>
      [
        tx.id,
        tx.transaction_date,
        tx.type,
        tx.category,
        String(Math.round(tx.amount)),
        tx.description.trim(),
        tx.paid_by ?? tx.recorded_by,
        tx.updated_at ?? "",
      ].join("|"),
    )
    .join("\n");
  const payload = `keeper-statement-v1\n${householdId}\n${transactions.length}\n${canonicalRows}`;
  const bytes = new TextEncoder().encode(payload);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Deterministic fallback if SubtleCrypto is unavailable
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (const b of bytes) {
    h1 ^= b;
    h1 = Math.imul(h1, 16777619);
    h2 ^= b + 17;
    h2 = Math.imul(h2, 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

export interface LedgerPdfInput {
  householdName: string;
  preparedBy: string;
  filterLabel: string;
  generatedAt: Date;
  transactions: Transaction[];
  verificationCode: string | null;
  contentHash: string;
}

function toPdfAscii(input: string): string {
  return input
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u00b7|\u2022/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(text: string): string {
  return toPdfAscii(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function truncateText(text: string, maxChars: number): string {
  const clean = toPdfAscii(text);
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(1, maxChars - 3))}...`;
}

function approxTextWidth(text: string, fontSize: number, bold = false): number {
  const factor = bold ? 0.56 : 0.52;
  return toPdfAscii(text).length * fontSize * factor;
}

function formatGeneratedDate(d: Date): string {
  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

/**
 * Generates a crisp, self-contained A4 PDF 1.4 statement with vector Keeper styling,
 * automatic multi-page table pagination, and an embedded vector QR code for verification.
 */
export function buildLedgerPdfBytes(input: LedgerPdfInput): Uint8Array {
  const PAGE_W = 595.28; // A4 width (pt)
  const PAGE_H = 841.89; // A4 height (pt)
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const FOOTER_Y = 34;

  let totalContributed = 0;
  let totalSpent = 0;
  let contribCount = 0;
  let expenseCount = 0;
  for (const tx of input.transactions) {
    if (tx.type === "contribution") {
      totalContributed += tx.amount;
      contribCount += 1;
    } else {
      totalSpent += tx.amount;
      expenseCount += 1;
    }
  }
  const netBalance = totalContributed - totalSpent;
  const isVerified = Boolean(input.verificationCode);

  const pages: string[][] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;

  const startPage = () => {
    ops = [];
    pages.push(ops);
    y = PAGE_H - MARGIN;
  };

  const setFillRgb = (r: number, g: number, b: number) => {
    ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
  };
  const setStrokeRgb = (r: number, g: number, b: number) => {
    ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`);
  };
  const fillRect = (x: number, bottomY: number, w: number, h: number) => {
    ops.push(`${x.toFixed(2)} ${bottomY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  };
  const strokeRect = (x: number, bottomY: number, w: number, h: number, lw = 0.7) => {
    ops.push(`${lw.toFixed(2)} w ${x.toFixed(2)} ${bottomY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  };
  const drawText = (
    text: string,
    x: number,
    baselineY: number,
    size: number,
    bold = false,
  ) => {
    ops.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${baselineY.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`,
    );
  };
  const drawRightText = (
    text: string,
    rightX: number,
    baselineY: number,
    size: number,
    bold = false,
  ) => {
    const w = approxTextWidth(text, size, bold);
    drawText(text, Math.max(MARGIN, rightX - w), baselineY, size, bold);
  };

  // Column x-positions inside [MARGIN .. PAGE_W - MARGIN]
  const COL_DATE = MARGIN + 6;
  const COL_TYPE = MARGIN + 72;
  const COL_CAT = MARGIN + 122;
  const COL_DESC = MARGIN + 206;
  const COL_MEMBER = MARGIN + 356;
  const COL_AMOUNT_RIGHT = PAGE_W - MARGIN - 6;

  const drawTableHeader = () => {
    const headerH = 22;
    setFillRgb(28, 28, 30); // Obsidian
    fillRect(MARGIN, y - headerH, CONTENT_W, headerH);
    setFillRgb(255, 255, 255);
    const textY = y - 14.5;
    drawText("DATE", COL_DATE, textY, 7.5, true);
    drawText("TYPE", COL_TYPE, textY, 7.5, true);
    drawText("CATEGORY", COL_CAT, textY, 7.5, true);
    drawText("DESCRIPTION", COL_DESC, textY, 7.5, true);
    drawText("MEMBER", COL_MEMBER, textY, 7.5, true);
    drawRightText("AMOUNT (TZS)", COL_AMOUNT_RIGHT, textY, 7.5, true);
    y -= headerH;
  };

  // --- Page 1 Header ---
  startPage();

  // Brand icon box + Wordmark
  setFillRgb(28, 28, 30);
  fillRect(MARGIN, y - 34, 34, 34);
  setFillRgb(228, 204, 160); // Warm gold K
  drawText("K", MARGIN + 10.5, y - 24, 19, true);

  setFillRgb(28, 28, 30);
  drawText("KEEPER", MARGIN + 44, y - 14, 16, true);
  setFillRgb(143, 112, 63); // Warm brass
  drawText("HOUSEHOLD LEDGER STATEMENT", MARGIN + 44, y - 28, 8.5, true);

  // Right metadata block
  const rightEdge = PAGE_W - MARGIN;
  setFillRgb(28, 28, 30);
  drawRightText(
    isVerified ? `STATEMENT ID: ${input.verificationCode}` : "OFFLINE DRAFT (UNVERIFIED)",
    rightEdge,
    y - 10,
    8.5,
    true,
  );
  setFillRgb(82, 82, 91);
  drawRightText(`Household: ${truncateText(input.householdName, 32)}`, rightEdge, y - 22, 8.5, false);
  drawRightText(`Filter: ${truncateText(input.filterLabel, 34)}`, rightEdge, y - 33, 8, false);
  drawRightText(
    `Generated: ${formatGeneratedDate(input.generatedAt)}`,
    rightEdge,
    y - 44,
    8,
    false,
  );
  drawRightText(`Prepared by: ${truncateText(input.preparedBy, 30)}`, rightEdge, y - 55, 8, false);

  y -= 66;

  // Warm brass divider rule
  setFillRgb(198, 168, 124);
  fillRect(MARGIN, y, CONTENT_W, 1.8);
  y -= 16;

  // 3 KPI Summary Boxes
  const boxGap = 10;
  const boxW = (CONTENT_W - boxGap * 2) / 3;
  const boxH = 54;
  const boxes = [
    {
      label: "TOTAL CONTRIBUTED",
      value: formatTZS(totalContributed),
      sub: `${contribCount} ${contribCount === 1 ? "entry" : "entries"}`,
      rgb: [28, 28, 30] as [number, number, number],
    },
    {
      label: "TOTAL SPENT",
      value: formatTZS(totalSpent),
      sub: `${expenseCount} ${expenseCount === 1 ? "entry" : "entries"}`,
      rgb: [28, 28, 30] as [number, number, number],
    },
    {
      label: "NET PERIOD BALANCE",
      value: netBalance > 0 ? `+${formatTZS(netBalance)}` : formatTZS(netBalance),
      sub: `${input.transactions.length} total ${input.transactions.length === 1 ? "entry" : "entries"}`,
      rgb: (netBalance >= 0 ? [4, 120, 87] : [190, 18, 60]) as [number, number, number],
    },
  ];

  boxes.forEach((box, idx) => {
    const bx = MARGIN + idx * (boxW + boxGap);
    setFillRgb(246, 245, 242); // Warm stone
    fillRect(bx, y - boxH, boxW, boxH);
    setStrokeRgb(226, 224, 219);
    strokeRect(bx, y - boxH, boxW, boxH, 0.7);
    setFillRgb(113, 113, 122);
    drawText(box.label, bx + 10, y - 15, 7, true);
    setFillRgb(box.rgb[0], box.rgb[1], box.rgb[2]);
    drawText(box.value, bx + 10, y - 32, 12.5, true);
    setFillRgb(142, 142, 147);
    drawText(box.sub, bx + 10, y - 45, 7.5, false);
  });

  y -= boxH + 18;

  // --- Ledger Table ---
  drawTableHeader();
  const ROW_H = 19;
  const MIN_ROW_Y = FOOTER_Y + 26;

  if (input.transactions.length === 0) {
    setFillRgb(113, 113, 122);
    drawText("No transactions match this filter.", MARGIN + 8, y - 15, 9, false);
    y -= 26;
  } else {
    input.transactions.forEach((tx, idx) => {
      if (y - ROW_H < MIN_ROW_Y) {
        startPage();
        setFillRgb(82, 82, 91);
        drawText(
          `${truncateText(input.householdName, 36)} - Household Ledger Statement (continued)`,
          MARGIN,
          y - 10,
          8.5,
          true,
        );
        y -= 20;
        drawTableHeader();
      }

      if (idx % 2 === 1) {
        setFillRgb(246, 245, 242);
        fillRect(MARGIN, y - ROW_H, CONTENT_W, ROW_H);
      }
      setStrokeRgb(234, 232, 227);
      ops.push(
        `0.4 w ${MARGIN.toFixed(2)} ${(y - ROW_H).toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${(y - ROW_H).toFixed(2)} l S`,
      );

      const textY = y - 12.5;
      const isContrib = tx.type === "contribution";
      const catLabel = truncateText(getCategoryMeta(tx.category).label, 14);
      const rawDesc = tx.updated_at ? `${tx.description} (edited)` : tx.description;
      const descLabel = truncateText(rawDesc, 29);
      const memberName = isContrib
        ? tx.payer?.full_name ?? tx.recorder?.full_name ?? "Member"
        : tx.recorder?.full_name ?? "Member";
      const amountLabel = isContrib ? `+${formatTZS(tx.amount)}` : `-${formatTZS(tx.amount)}`;

      setFillRgb(82, 82, 91);
      drawText(tx.transaction_date, COL_DATE, textY, 8, false);
      setFillRgb(isContrib ? 4 : 28, isContrib ? 120 : 28, isContrib ? 87 : 30);
      drawText(isContrib ? "Contrib" : "Expense", COL_TYPE, textY, 8, true);
      setFillRgb(82, 82, 91);
      drawText(catLabel, COL_CAT, textY, 8, false);
      setFillRgb(28, 28, 30);
      drawText(descLabel, COL_DESC, textY, 8, false);
      setFillRgb(82, 82, 91);
      drawText(truncateText(memberName, 16), COL_MEMBER, textY, 8, false);
      setFillRgb(isContrib ? 4 : 28, isContrib ? 120 : 28, isContrib ? 87 : 30);
      drawRightText(amountLabel, COL_AMOUNT_RIGHT, textY, 8, true);

      y -= ROW_H;
    });
  }

  // --- Authenticity Verification Block (with Vector QR Code) ---
  const VERIFY_H = 104;
  if (y - VERIFY_H - 18 < FOOTER_Y + 14) {
    startPage();
    y -= 6;
  } else {
    y -= 18;
  }

  const boxBottom = y - VERIFY_H;
  setFillRgb(246, 245, 242);
  fillRect(MARGIN, boxBottom, CONTENT_W, VERIFY_H);
  setStrokeRgb(198, 168, 124);
  strokeRect(MARGIN, boxBottom, CONTENT_W, VERIFY_H, 0.9);

  const textX = MARGIN + 14;
  if (isVerified && input.verificationCode) {
    setFillRgb(143, 112, 63);
    drawText("AUTHENTICITY VERIFICATION", textX, y - 18, 8, true);
    setFillRgb(28, 28, 30);
    drawText(`Statement ID: ${input.verificationCode}`, textX, y - 34, 10, true);
    setFillRgb(82, 82, 91);
    const shortDigest = `${input.contentHash.slice(0, 16)}...${input.contentHash.slice(-8)}`;
    drawText(`Integrity Fingerprint (SHA-256): ${shortDigest}`, textX, y - 49, 8, false);
    drawText(
      "Scan this QR code with any phone or enter the Statement ID in Keeper",
      textX,
      y - 66,
      8,
      false,
    );
    drawText(
      "to confirm these totals against your household's live records.",
      textX,
      y - 78,
      8,
      false,
    );
    setFillRgb(113, 113, 122);
    drawText(
      "Private: only active members of this household can verify this statement.",
      textX,
      y - 92,
      7.5,
      false,
    );

    // Draw razor-sharp vector QR code on the right inside a clean white quiet zone
    const verifyUrl = buildVerifyUrl(input.verificationCode);
    const matrix = generateQrMatrix(verifyUrl);
    const qrOuterSize = 84;
    const quietZone = 5;
    const qrRightX = PAGE_W - MARGIN - 10;
    const qrLeftX = qrRightX - qrOuterSize;
    const qrBottomY = boxBottom + (VERIFY_H - qrOuterSize) / 2;

    setFillRgb(255, 255, 255);
    fillRect(qrLeftX, qrBottomY, qrOuterSize, qrOuterSize);
    setStrokeRgb(220, 218, 212);
    strokeRect(qrLeftX, qrBottomY, qrOuterSize, qrOuterSize, 0.5);

    const innerSize = qrOuterSize - quietZone * 2;
    const cell = innerSize / matrix.length;
    setFillRgb(28, 28, 30);
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (!matrix[r][c]) continue;
        const cx = qrLeftX + quietZone + c * cell;
        const cy = qrBottomY + qrOuterSize - quietZone - (r + 1) * cell;
        ops.push(
          `${cx.toFixed(2)} ${cy.toFixed(2)} ${(cell + 0.1).toFixed(2)} ${(cell + 0.1).toFixed(2)} re f`,
        );
      }
    }
  } else {
    setFillRgb(180, 83, 9);
    drawText("OFFLINE DRAFT - NOT SERVER-VERIFIED", textX, y - 22, 9, true);
    setFillRgb(82, 82, 91);
    drawText(
      "This PDF was exported while offline or in demo mode, so no verification QR code was issued.",
      textX,
      y - 42,
      8.5,
      false,
    );
    drawText(
      "Connect to the internet and export again to generate an official verified Keeper statement.",
      textX,
      y - 56,
      8.5,
      false,
    );
    setFillRgb(113, 113, 122);
    drawText(`Local Digest: ${input.contentHash.slice(0, 24)}`, textX, y - 78, 7.5, false);
  }

  // --- Add consistent footer with page numbers to every page ---
  const totalPages = pages.length;
  pages.forEach((pageOps, idx) => {
    const pageNum = idx + 1;
    const footerLineY = FOOTER_Y + 12;
    pageOps.push(
      `0.870 0.863 0.847 RG 0.5 w ${MARGIN.toFixed(2)} ${footerLineY.toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${footerLineY.toFixed(2)} l S`,
    );
    pageOps.push(
      `0.557 0.557 0.576 rg BT /F1 7.5 Tf 1 0 0 1 ${MARGIN.toFixed(2)} ${FOOTER_Y.toFixed(2)} Tm (${escapePdfText("Generated by Keeper - keeper-olive.vercel.app")}) Tj ET`,
    );
    const pageStr = `Page ${pageNum} of ${totalPages}`;
    const pw = approxTextWidth(pageStr, 7.5, false);
    pageOps.push(
      `0.557 0.557 0.576 rg BT /F1 7.5 Tf 1 0 0 1 ${(PAGE_W - MARGIN - pw).toFixed(2)} ${FOOTER_Y.toFixed(2)} Tm (${escapePdfText(pageStr)}) Tj ET`,
    );
  });

  // --- Assemble PDF 1.4 binary ---
  // Object numbering:
  // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold
  // For each page i: contentObj = 5 + i*2, pageObj = 6 + i*2
  const encoder = new TextEncoder();
  const objects: string[] = [];
  const pageObjNums: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(6 + i * 2);
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`,
  );
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);

  pages.forEach((pageOps, i) => {
    const contentNum = 5 + i * 2;
    const pageNum = 6 + i * 2;
    const stream = pageOps.join("\n");
    const streamLen = encoder.encode(stream).length;
    objects.push(
      `${contentNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`,
    );
  });

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteOffset = 0;

  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    chunks.push(b);
    byteOffset += b.length;
  };

  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  for (const obj of objects) {
    offsets.push(byteOffset);
    pushStr(obj);
  }

  const xrefOffset = byteOffset;
  pushStr(`xref\n0 ${objects.length + 1}\n`);
  pushStr("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLen);
  let cursor = 0;
  for (const c of chunks) {
    out.set(c, cursor);
    cursor += c.length;
  }
  return out;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export async function deliverPdfFile(
  filename: string,
  bytes: Uint8Array,
): Promise<{ savedToDownloads: boolean; shared: boolean }> {
  if (Capacitor.isNativePlatform()) {
    const base64 = uint8ArrayToBase64(bytes);
    const res = await NativePdfExporter.saveAndSharePdf({ filename, base64 });
    return { savedToDownloads: Boolean(res?.savedToDownloads), shared: true };
  }
  const safeCopy = new Uint8Array(bytes.byteLength);
  safeCopy.set(bytes);
  const blob = new Blob([safeCopy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { savedToDownloads: true, shared: false };
}
