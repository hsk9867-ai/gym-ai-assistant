import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { hashPhone, normalizePhone, preparePhone, randomToken } from "@/lib/crypto";

export const IMPORT_FIELDS = [
  { key: "name", label: "회원명", required: true, hints: ["이름", "회원명", "성명", "고객명", "name"] },
  { key: "phone", label: "연락처", required: true, hints: ["전화", "연락처", "휴대폰", "핸드폰", "phone", "mobile", "tel"] },
  { key: "membershipStart", label: "회원권 시작일", required: false, hints: ["시작", "start", "개시"] },
  { key: "membershipEnd", label: "회원권 종료일", required: false, hints: ["종료", "만료", "end", "expire"] },
  { key: "product", label: "상품명", required: false, hints: ["상품", "회원권", "product", "이용권"] },
  { key: "amount", label: "결제금액", required: false, hints: ["금액", "결제", "amount", "price", "가격"] },
  { key: "ptRemaining", label: "PT 잔여횟수", required: false, hints: ["pt", "잔여", "남은"] },
  { key: "lastVisit", label: "최근 방문일", required: false, hints: ["방문", "출석", "visit", "last"] },
  { key: "gender", label: "성별", required: false, hints: ["성별", "gender", "sex"] },
  { key: "memo", label: "메모", required: false, hints: ["메모", "비고", "memo", "note"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Partial<Record<ImportFieldKey, number>>; // field → column index

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

/** CSV는 UTF-8(BOM 허용) 우선, 실패 시 EUC-KR(한국 Excel 기본 저장 인코딩)로 디코딩한다. */
function decodeCsv(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr").decode(buffer);
  }
}

export function parseSheet(buffer: Buffer, fileName: string): ParsedSheet {
  const isCsv = /\.(csv|txt|tsv)$/i.test(fileName);
  // CSV: raw:true 로 모든 셀을 문자열 그대로 유지 (전화번호/날짜 자동 형변환 방지)
  // XLSX: 날짜 셀은 Date 객체로 받아 로컬 날짜로 문자열화
  const wb = isCsv
    ? XLSX.read(decodeCsv(buffer), { type: "string", raw: true })
    : XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  const cell = (v: unknown): string => {
    if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
    return String(v ?? "").trim();
  };
  const nonEmpty = aoa.filter((r) => r.some((c) => cell(c) !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map(cell);
  const rows = nonEmpty.slice(1).map((r) => headers.map((_, i) => cell(r[i])));
  return { headers, rows };
}

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<number>();
  for (const f of IMPORT_FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.hints.some((hint) => h.toLowerCase().includes(hint.toLowerCase())));
    if (idx >= 0) {
      m[f.key] = idx;
      used.add(idx);
    }
  }
  // "시작"과 "종료"가 둘 다 "회원권" 힌트에 걸리는 경우 방지
  if (m.product !== undefined && (m.product === m.membershipStart || m.product === m.membershipEnd)) delete m.product;
  return m;
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const s = v.trim().replace(/\./g, "-").replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseInt0(v: string): number {
  const n = parseInt(v.replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export interface PreviewRow {
  index: number;
  name: string;
  phone: string;
  membershipStart: Date | null;
  membershipEnd: Date | null;
  product: string;
  amount: number;
  ptRemaining: number;
  lastVisit: Date | null;
  gender: string | null;
  memo: string;
  errors: string[];
  duplicate: boolean;
}

export async function buildPreview(centerId: string, sheet: ParsedSheet, mapping: Mapping): Promise<PreviewRow[]> {
  const get = (row: string[], key: ImportFieldKey) => (mapping[key] === undefined ? "" : row[mapping[key]!] ?? "");
  const out: PreviewRow[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    const name = get(r, "name").trim();
    const phone = normalizePhone(get(r, "phone"));
    const errors: string[] = [];
    if (!name) errors.push("이름 없음");
    if (phone.length < 10) errors.push("연락처 형식 오류");
    const start = parseDate(get(r, "membershipStart"));
    const end = parseDate(get(r, "membershipEnd"));
    if (get(r, "membershipEnd") && !end) errors.push("종료일 형식 오류");
    if (start && end && end < start) errors.push("종료일이 시작일보다 빠름");
    const g = get(r, "gender").trim();
    const gender = /^(남|m)/i.test(g) ? "M" : /^(여|f)/i.test(g) ? "F" : null;
    if (phone.length >= 10) hashes.push(hashPhone(phone));
    out.push({
      index: i + 2,
      name,
      phone,
      membershipStart: start,
      membershipEnd: end,
      product: get(r, "product").trim() || "회원권",
      amount: parseInt0(get(r, "amount")),
      ptRemaining: parseInt0(get(r, "ptRemaining")),
      lastVisit: parseDate(get(r, "lastVisit")),
      gender,
      memo: get(r, "memo").trim(),
      errors,
      duplicate: false,
    });
  }
  const existing = await prisma.member.findMany({
    where: { centerId, phoneHash: { in: hashes } },
    select: { phoneHash: true },
  });
  const dupSet = new Set(existing.map((e) => e.phoneHash));
  const seen = new Set<string>();
  for (const row of out) {
    if (row.phone.length < 10) continue;
    const h = hashPhone(row.phone);
    if (dupSet.has(h)) row.duplicate = true;
    if (seen.has(h)) row.errors.push("파일 내 중복 연락처");
    seen.add(h);
  }
  return out;
}

export type DupPolicy = "KEEP" | "UPDATE" | "SKIP";

export async function runImport(centerId: string, fileName: string, rows: PreviewRow[], policy: DupPolicy) {
  let inserted = 0, updated = 0, skipped = 0, errors = 0;
  for (const row of rows) {
    if (row.errors.length) { errors++; continue; }
    const phoneData = preparePhone(row.phone);
    const existing = await prisma.member.findUnique({ where: { centerId_phoneHash: { centerId, phoneHash: phoneData.phoneHash } } });
    if (existing) {
      if (policy === "KEEP" || policy === "SKIP") { skipped++; continue; }
      await prisma.member.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          gender: row.gender ?? existing.gender,
          memo: row.memo || existing.memo,
          lastVisitAt: row.lastVisit ?? existing.lastVisitAt,
        },
      });
      await attachMembership(centerId, existing.id, row, true);
      updated++;
      continue;
    }
    const member = await prisma.member.create({
      data: {
        centerId,
        name: row.name,
        ...phoneData,
        gender: row.gender,
        memo: row.memo || null,
        lastVisitAt: row.lastVisit,
        joinedAt: row.membershipStart ?? new Date(),
        surveyToken: randomToken(),
      },
    });
    await attachMembership(centerId, member.id, row, false);
    inserted++;
  }
  await prisma.importJob.create({
    data: { centerId, fileName, totalRows: rows.length, insertedRows: inserted, updatedRows: updated, skippedRows: skipped, errorRows: errors },
  });
  return { inserted, updated, skipped, errors };
}

async function attachMembership(centerId: string, memberId: string, row: PreviewRow, existingMember: boolean) {
  if (row.membershipEnd) {
    const start = row.membershipStart ?? row.membershipEnd;
    const dup = existingMember
      ? await prisma.membership.findFirst({ where: { memberId, endDate: row.membershipEnd, productName: row.product } })
      : null;
    if (!dup) {
      await prisma.membership.create({
        data: {
          centerId,
          memberId,
          productName: row.product,
          startDate: start,
          endDate: row.membershipEnd,
          amount: row.amount,
          status: row.membershipEnd < new Date() ? "EXPIRED" : "ACTIVE",
        },
      });
    }
  }
  if (row.ptRemaining > 0) {
    const has = existingMember ? await prisma.ptPackage.findFirst({ where: { memberId } }) : null;
    if (!has) {
      await prisma.ptPackage.create({
        data: { centerId, memberId, productName: "PT (Import)", totalCount: row.ptRemaining, usedCount: 0 },
      });
    }
  }
}
