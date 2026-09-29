import { prisma } from "@/lib/db";
import { addDays, endOfDay, endOfMonth, startOfDay, startOfMonth, won, num } from "@/lib/format";
import { renewalAnalytics } from "./renewals";
import { RENEWAL_REASON } from "@/lib/format";

/**
 * 관장 자동 리포트 (기획서 14장). SMART 이상.
 * 숫자는 전부 DB에서 계산하고, 문장은 규칙으로 만든다. AI PRO에서는 aiSummary 로 해석을 덧붙인다(MVP 3).
 */

export type ReportType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface ReportResult {
  type: ReportType;
  title: string;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  sections: { heading: string; rows: { label: string; value: string; note?: string }[] }[];
  actions: string[]; // 관장이 오늘 할 일
  text: string; // 카카오 발송 본문
  data: Record<string, unknown>;
}

const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
const pctStr = (a: number, b: number) => (b === 0 ? "-" : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`);

async function salesBetween(centerId: string, from: Date, to: Date) {
  const rows = await prisma.payment.groupBy({ by: ["type"], where: { centerId, paidAt: { gte: from, lte: to } }, _sum: { amount: true } });
  const get = (t: string) => rows.find((r) => r.type === t)?._sum.amount ?? 0;
  return { total: rows.reduce((s, r) => s + (r._sum.amount ?? 0), 0), pt: get("PT"), newSales: get("NEW"), renewal: get("RENEWAL") };
}

async function countsBetween(centerId: string, from: Date, to: Date) {
  const [newMembers, renewals, visits, contracts, expired] = await Promise.all([
    prisma.member.count({ where: { centerId, joinedAt: { gte: from, lte: to } } }),
    prisma.membership.count({ where: { centerId, isRenewal: true, createdAt: { gte: from, lte: to } } }),
    prisma.attendance.count({ where: { centerId, checkedAt: { gte: from, lte: to } } }),
    prisma.contract.count({ where: { centerId, signedAt: { gte: from, lte: to } } }),
    prisma.membership.count({ where: { centerId, endDate: { gte: from, lte: to } } }),
  ]);
  return { newMembers, renewals, visits, contracts, expired };
}

async function upcoming(centerId: string, days: number) {
  const today = startOfDay();
  return prisma.membership.findMany({
    where: { centerId, status: "ACTIVE", endDate: { gte: today, lte: addDays(today, days) } },
    include: { member: { select: { name: true } } },
    orderBy: { endDate: "asc" },
  });
}

function joinText(r: Omit<ReportResult, "text">): string {
  const lines = [`[${r.title}] ${r.periodLabel}`, ""];
  for (const s of r.sections) {
    lines.push(`■ ${s.heading}`);
    for (const row of s.rows) lines.push(`· ${row.label}: ${row.value}${row.note ? ` (${row.note})` : ""}`);
    lines.push("");
  }
  if (r.actions.length) {
    lines.push("▶ 내일 챙길 일");
    for (const a of r.actions) lines.push(`- ${a}`);
  }
  return lines.join("\n").trim();
}

export async function buildDailyReport(centerId: string, date = new Date()): Promise<ReportResult> {
  const from = startOfDay(date), to = endOfDay(date);
  const yFrom = startOfDay(addDays(date, -1)), yTo = endOfDay(addDays(date, -1));
  const [sales, ySales, c, exp7, dormant, lowPt] = await Promise.all([
    salesBetween(centerId, from, to), salesBetween(centerId, yFrom, yTo), countsBetween(centerId, from, to), upcoming(centerId, 7),
    prisma.member.count({ where: { centerId, status: "DORMANT" } }),
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*) as c FROM PtPackage WHERE centerId = ${centerId} AND (totalCount - usedCount) BETWEEN 1 AND 3`,
  ]);
  const center = await prisma.center.findUniqueOrThrow({ where: { id: centerId }, select: { name: true } });
  const r: Omit<ReportResult, "text"> = {
    type: "DAILY",
    title: `${center.name} 일일 보고`,
    periodStart: from, periodEnd: to,
    periodLabel: `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`,
    sections: [
      { heading: "오늘 매출", rows: [
        { label: "총매출", value: won(sales.total), note: `전일 대비 ${pctStr(sales.total, ySales.total)}` },
        { label: "PT 매출", value: won(sales.pt) },
        { label: "신규 / 재등록", value: `${won(sales.newSales)} / ${won(sales.renewal)}` },
      ] },
      { heading: "오늘 회원", rows: [
        { label: "신규회원", value: `${num(c.newMembers)}명` },
        { label: "재등록", value: `${num(c.renewals)}명` },
        { label: "방문회원", value: `${num(c.visits)}명` },
        { label: "계약 완료", value: `${num(c.contracts)}건` },
      ] },
      { heading: "관리 필요", rows: [
        { label: "7일 내 만료", value: `${exp7.length}명`, note: exp7.slice(0, 3).map((m) => `${m.member.name} ${md(m.endDate)}`).join(", ") || undefined },
        { label: "장기 미방문", value: `${dormant}명` },
        { label: "PT 3회 이하", value: `${Number(lowPt[0]?.c ?? 0)}명` },
      ] },
    ],
    actions: [
      ...(exp7.length ? [`만료 임박 ${exp7.length}명에게 재등록 안내 (${exp7.slice(0, 3).map((m) => m.member.name).join(", ")}${exp7.length > 3 ? " 외" : ""})`] : []),
      ...(dormant ? [`장기 미방문 ${dormant}명 안부 연락`] : []),
      ...(Number(lowPt[0]?.c ?? 0) ? [`PT 잔여 3회 이하 ${Number(lowPt[0]?.c ?? 0)}명 연장 상담`] : []),
    ],
    data: { sales, ySales, counts: c, expiring7: exp7.length, dormant, lowPt: Number(lowPt[0]?.c ?? 0) },
  };
  return { ...r, text: joinText(r) };
}

export async function buildWeeklyReport(centerId: string, date = new Date()): Promise<ReportResult> {
  // 이번 주: 일요일 ~ 오늘(토요일 발송 기준)
  const to = endOfDay(date);
  const from = startOfDay(addDays(date, -6));
  const pFrom = startOfDay(addDays(from, -7)), pTo = endOfDay(addDays(from, -1));
  const [sales, pSales, c, pc, next7, dormant, ra] = await Promise.all([
    salesBetween(centerId, from, to), salesBetween(centerId, pFrom, pTo), countsBetween(centerId, from, to), countsBetween(centerId, pFrom, pTo),
    upcoming(centerId, 7), prisma.member.count({ where: { centerId, status: "DORMANT" } }), renewalAnalytics(centerId),
  ]);
  const center = await prisma.center.findUniqueOrThrow({ where: { id: centerId }, select: { name: true } });
  const r: Omit<ReportResult, "text"> = {
    type: "WEEKLY",
    title: `${center.name} 주간 보고`,
    periodStart: from, periodEnd: to,
    periodLabel: `${md(from)} ~ ${md(to)}`,
    sections: [
      { heading: "주간 매출", rows: [
        { label: "총매출", value: won(sales.total), note: `전주 대비 ${pctStr(sales.total, pSales.total)}` },
        { label: "PT / 회원권", value: `${won(sales.pt)} / ${won(sales.newSales + sales.renewal)}` },
      ] },
      { heading: "회원", rows: [
        { label: "신규회원", value: `${num(c.newMembers)}명`, note: `전주 ${pc.newMembers}명` },
        { label: "재등록", value: `${num(c.renewals)}명`, note: `전주 ${pc.renewals}명` },
        { label: "이번 달 재등록률", value: `${Math.round(ra.thisMonth.renewalRate * 100)}%`, note: `대상 ${ra.thisMonth.total}명` },
        { label: "방문", value: `${num(c.visits)}회`, note: `전주 ${pc.visits}회` },
        { label: "장기 미방문", value: `${dormant}명` },
      ] },
      { heading: "다음 주 만료 예정", rows: [
        { label: "인원", value: `${next7.length}명`, note: next7.slice(0, 5).map((m) => `${m.member.name} ${md(m.endDate)}`).join(", ") || undefined },
      ] },
    ],
    actions: [
      ...(next7.length ? [`다음 주 만료 ${next7.length}명 재등록 안내 발송`] : []),
      ...(ra.thisMonth.reasons[0] ? [`미재등록 1위 사유 "${RENEWAL_REASON[ra.thisMonth.reasons[0].reason]}" 대응 검토`] : []),
    ],
    data: { sales, pSales, counts: c, prevCounts: pc, next7: next7.length, renewalRate: ra.thisMonth.renewalRate },
  };
  return { ...r, text: joinText(r) };
}

export async function buildMonthlyReport(centerId: string, date = new Date()): Promise<ReportResult> {
  const from = startOfMonth(date), to = endOfMonth(date);
  const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const pFrom = startOfMonth(prev), pTo = endOfMonth(prev);
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const [sales, pSales, c, pc, ra, nextExpiring, churned] = await Promise.all([
    salesBetween(centerId, from, to), salesBetween(centerId, pFrom, pTo), countsBetween(centerId, from, to), countsBetween(centerId, pFrom, pTo),
    renewalAnalytics(centerId),
    prisma.membership.count({ where: { centerId, status: "ACTIVE", endDate: { gte: startOfMonth(nextMonth), lte: endOfMonth(nextMonth) } } }),
    prisma.member.count({ where: { centerId, status: { in: ["EXPIRED", "WITHDRAWN"] }, updatedAt: { gte: from, lte: to } } }),
  ]);
  const center = await prisma.center.findUniqueOrThrow({ where: { id: centerId }, select: { name: true } });
  const t = ra.thisMonth;
  const r: Omit<ReportResult, "text"> = {
    type: "MONTHLY",
    title: `${center.name} 월간 보고`,
    periodStart: from, periodEnd: to,
    periodLabel: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
    sections: [
      { heading: "월 매출", rows: [
        { label: "총매출", value: won(sales.total), note: `전월 대비 ${pctStr(sales.total, pSales.total)}` },
        { label: "신규 / 재등록 / PT", value: `${won(sales.newSales)} / ${won(sales.renewal)} / ${won(sales.pt)}` },
      ] },
      { heading: "회원", rows: [
        { label: "신규회원", value: `${num(c.newMembers)}명`, note: `전월 ${pc.newMembers}명` },
        { label: "재등록회원", value: `${num(t.renewed)}명` },
        { label: "재등록률", value: `${Math.round(t.renewalRate * 100)}%`, note: `전월 ${Math.round(ra.prevMonth.renewalRate * 100)}%` },
        { label: "이탈(만료·탈퇴)", value: `${num(churned)}명` },
      ] },
      { heading: "미재등록 사유", rows: t.reasons.length
        ? t.reasons.slice(0, 4).map((x) => ({ label: RENEWAL_REASON[x.reason] ?? x.reason, value: `${x.count}명`, note: `${Math.round(x.ratio * 100)}%` }))
        : [{ label: "응답", value: "아직 없음" }] },
      { heading: "고객 건의사항", rows: t.feedbacks.length
        ? t.feedbacks.slice(0, 3).map((f) => ({ label: f.name, value: f.feedback }))
        : [{ label: "건의", value: "없음" }] },
      { heading: "다음 달", rows: [
        { label: "만료 예정 회원", value: `${num(nextExpiring)}명` },
        { label: "예상 재등록", value: `${Math.round(nextExpiring * (t.renewalRate || 0.5))}명`, note: "이번 달 재등록률 기준" },
      ] },
    ],
    actions: [
      ...(ra.changes[0] && ra.changes[0].deltaPt > 5 ? [`"${RENEWAL_REASON[ra.changes[0].reason]}" 불만이 전월 대비 ${ra.changes[0].deltaPt}%p 증가 → 원인 점검`] : []),
      ...(nextExpiring ? [`다음 달 만료 ${nextExpiring}명 대상 재등록 프로모션 준비`] : []),
    ],
    data: { sales, pSales, counts: c, renewal: { rate: t.renewalRate, reasons: t.reasons }, nextExpiring, churned },
  };
  return { ...r, text: joinText(r) };
}

export async function buildReport(centerId: string, type: ReportType, date = new Date()) {
  return type === "DAILY" ? buildDailyReport(centerId, date) : type === "WEEKLY" ? buildWeeklyReport(centerId, date) : buildMonthlyReport(centerId, date);
}
