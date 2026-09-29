import { prisma } from "@/lib/db";
import { addDays, endOfDay, endOfMonth, startOfDay, startOfMonth } from "@/lib/format";

async function sumPayments(centerId: string, from: Date, to: Date, type?: string) {
  const r = await prisma.payment.aggregate({
    where: { centerId, paidAt: { gte: from, lte: to }, ...(type ? { type } : {}) },
    _sum: { amount: true },
    _count: true,
  });
  return { amount: r._sum.amount ?? 0, count: r._count };
}

export async function dashboardStats(centerId: string) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pStart = startOfMonth(prevMonthDate);
  // 전월 동기간 (1일 ~ 오늘 일자)
  const pSameEnd = endOfDay(new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), Math.min(now.getDate(), endOfMonth(prevMonthDate).getDate())));

  const [
    todaySales,
    todayPt,
    todayNew,
    todayRenew,
    todayVisits,
    todayContracts,
    activeMembers,
    expiring7,
    expiring30,
    dormant,
    lowPt,
    monthSales,
    prevSameSales,
    monthNew,
    monthRenew,
    monthExpired,
    monthNotRenewed,
    monthRenewalTotal,
    monthRenewalDone,
  ] = await Promise.all([
    sumPayments(centerId, dayStart, dayEnd),
    sumPayments(centerId, dayStart, dayEnd, "PT"),
    prisma.member.count({ where: { centerId, joinedAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.membership.count({ where: { centerId, isRenewal: true, createdAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.attendance.count({ where: { centerId, checkedAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.contract.count({ where: { centerId, signedAt: { gte: dayStart, lte: dayEnd } } }),
    prisma.member.count({ where: { centerId, status: { in: ["ACTIVE", "EXPIRING", "DORMANT"] } } }),
    prisma.membership.count({ where: { centerId, status: "ACTIVE", endDate: { gte: dayStart, lte: addDays(dayStart, 7) } } }),
    prisma.membership.count({ where: { centerId, status: "ACTIVE", endDate: { gte: dayStart, lte: addDays(dayStart, 30) } } }),
    prisma.member.count({ where: { centerId, status: "DORMANT" } }),
    // DB 종류에 무관하게 동작하도록 raw SQL 대신 조회 후 계산 (SQLite/PostgreSQL 공용)
    prisma.ptPackage.findMany({ where: { centerId }, select: { totalCount: true, usedCount: true } }).then((rows) => [{ c: rows.filter((p) => p.totalCount - p.usedCount >= 1 && p.totalCount - p.usedCount <= 3).length }]),
    sumPayments(centerId, mStart, mEnd),
    sumPayments(centerId, pStart, pSameEnd),
    prisma.member.count({ where: { centerId, joinedAt: { gte: mStart, lte: mEnd } } }),
    prisma.membership.count({ where: { centerId, isRenewal: true, createdAt: { gte: mStart, lte: mEnd } } }),
    prisma.membership.count({ where: { centerId, endDate: { gte: mStart, lte: mEnd } } }),
    prisma.renewal.count({ where: { centerId, status: "NOT_RENEWED", membership: { endDate: { gte: mStart, lte: mEnd } } } }),
    prisma.renewal.count({ where: { centerId, membership: { endDate: { gte: mStart, lte: mEnd } } } }),
    prisma.renewal.count({ where: { centerId, status: "RENEWED", membership: { endDate: { gte: mStart, lte: mEnd } } } }),
  ]);

  const salesDelta = prevSameSales.amount === 0 ? null : (monthSales.amount - prevSameSales.amount) / prevSameSales.amount;

  return {
    today: {
      sales: todaySales.amount,
      ptSales: todayPt.amount,
      newMembers: todayNew,
      renewals: todayRenew,
      visits: todayVisits,
      contracts: todayContracts,
    },
    members: {
      active: activeMembers,
      expiring7,
      expiring30,
      dormant,
      lowPt: Number(lowPt[0]?.c ?? 0),
    },
    month: {
      sales: monthSales.amount,
      prevSameSales: prevSameSales.amount,
      salesDelta,
      newMembers: monthNew,
      renewals: monthRenew,
      expired: monthExpired,
      notRenewed: monthNotRenewed,
      renewalRate: monthRenewalTotal ? monthRenewalDone / monthRenewalTotal : null,
      renewalTotal: monthRenewalTotal,
    },
  };
}

export type InsightTone = "good" | "warn" | "bad" | "info";
export interface Insight { tone: InsightTone; title: string; text: string; href?: string }

/** 기획서 6.1 "AI 요약" 자리에 들어갈 규칙 기반 인사이트 (AI PRO 이전 단계). 중요도 순으로 정렬한다. */
export function buildInsights(s: Awaited<ReturnType<typeof dashboardStats>>, extra: { pendingContracts: number; weekVisitsDelta: number | null }): Insight[] {
  const out: Insight[] = [];
  if (s.month.salesDelta !== null) {
    const p = Math.round(s.month.salesDelta * 1000) / 10;
    out.push(p >= 0
      ? { tone: "good", title: "매출 상승", text: `이번 달 매출이 전월 동기간 대비 ${p}% 증가했습니다.`, href: "/payments" }
      : { tone: p <= -10 ? "bad" : "warn", title: "매출 감소", text: `이번 달 매출이 전월 동기간 대비 ${Math.abs(p)}% 감소했습니다. 신규·재등록 흐름을 확인하세요.`, href: "/payments" });
  } else if (s.month.sales > 0) {
    out.push({ tone: "info", title: "이번 달 매출", text: `누적 ${s.month.sales.toLocaleString("ko-KR")}원. 비교할 전월 데이터가 아직 없습니다.`, href: "/payments" });
  }
  if (s.members.expiring7 > 0) {
    out.push({ tone: s.members.expiring7 >= 10 ? "bad" : "warn", title: "만료 임박", text: `7일 이내 만료 예정 회원 ${s.members.expiring7}명. 지금 재등록 안내가 필요합니다.`, href: "/renewals?bucket=7" });
  } else {
    out.push({ tone: "good", title: "만료 임박 없음", text: "7일 이내 만료 예정 회원이 없습니다.", href: "/renewals" });
  }
  if (s.month.renewalRate !== null) {
    const r = Math.round(s.month.renewalRate * 100);
    out.push({ tone: r >= 60 ? "good" : r >= 40 ? "warn" : "bad", title: `재등록률 ${r}%`, text: `이번 달 만료 대상 ${s.month.renewalTotal}명 중 ${Math.round(s.month.renewalTotal * s.month.renewalRate)}명이 재등록했습니다.`, href: "/renewals/analytics" });
  }
  if (s.members.dormant > 0) out.push({ tone: "warn", title: "장기 미방문", text: `30일 이상 방문하지 않은 회원 ${s.members.dormant}명. 이탈 전 연락을 권합니다.`, href: "/members?status=DORMANT" });
  if (s.members.lowPt > 0) out.push({ tone: "info", title: "PT 재구매 기회", text: `PT 잔여 3회 이하 회원 ${s.members.lowPt}명. 연장 상담 타이밍입니다.`, href: "/pt?low=1" });
  if (extra.pendingContracts > 0) out.push({ tone: "info", title: "서명 대기", text: `서명이 완료되지 않은 계약 ${extra.pendingContracts}건이 있습니다.`, href: "/contracts?status=SENT" });
  if (extra.weekVisitsDelta !== null && Math.abs(extra.weekVisitsDelta) >= 0.15) {
    const p = Math.round(extra.weekVisitsDelta * 100);
    out.push(p > 0
      ? { tone: "good", title: "방문 증가", text: `최근 7일 방문이 그 전 주보다 ${p}% 늘었습니다.`, href: "/attendance" }
      : { tone: "warn", title: "방문 감소", text: `최근 7일 방문이 그 전 주보다 ${Math.abs(p)}% 줄었습니다.`, href: "/attendance" });
  }
  const rank: Record<InsightTone, number> = { bad: 0, warn: 1, good: 2, info: 3 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 6);
}

/** 최근 N일 일별 매출·방문 (스파크라인용) + 직전 주 대비 방문 변화 */
export async function dailySeries(centerId: string, days = 7) {
  const today = startOfDay();
  const from = addDays(today, -(days * 2 - 1));
  const [payments, visits] = await Promise.all([
    prisma.payment.findMany({ where: { centerId, paidAt: { gte: from } }, select: { paidAt: true, amount: true } }),
    prisma.attendance.findMany({ where: { centerId, checkedAt: { gte: from } }, select: { checkedAt: true } }),
  ]);
  const key = (d: Date) => startOfDay(d).getTime();
  const salesMap = new Map<number, number>();
  const visitMap = new Map<number, number>();
  for (const p of payments) salesMap.set(key(p.paidAt), (salesMap.get(key(p.paidAt)) ?? 0) + p.amount);
  for (const v of visits) visitMap.set(key(v.checkedAt), (visitMap.get(key(v.checkedAt)) ?? 0) + 1);
  const series = Array.from({ length: days }, (_, i) => {
    const d = addDays(today, -(days - 1 - i));
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, sales: salesMap.get(key(d)) ?? 0, visits: visitMap.get(key(d)) ?? 0 };
  });
  let prevVisits = 0;
  for (let i = days; i < days * 2; i++) prevVisits += visitMap.get(key(addDays(today, -i))) ?? 0;
  const curVisits = series.reduce((a, b) => a + b.visits, 0);
  const weekVisitsDelta = prevVisits === 0 ? null : (curVisits - prevVisits) / prevVisits;
  return { series, weekVisitsDelta };
}

export async function salesStats(centerId: string, month: Date) {
  const mStart = startOfMonth(month);
  const mEnd = endOfMonth(month);
  const payments = await prisma.payment.findMany({
    where: { centerId, paidAt: { gte: mStart, lte: mEnd } },
    include: { salesperson: { select: { name: true } } },
  });

  const byDay = new Map<string, number>();
  const byType = new Map<string, number>();
  const byStaff = new Map<string, number>();
  const byMethod = new Map<string, number>();
  let total = 0;
  for (const p of payments) {
    total += p.amount;
    const d = p.paidAt.getDate();
    byDay.set(String(d), (byDay.get(String(d)) ?? 0) + p.amount);
    byType.set(p.type, (byType.get(p.type) ?? 0) + p.amount);
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
    const staff = p.salesperson?.name ?? "미지정";
    byStaff.set(staff, (byStaff.get(staff) ?? 0) + p.amount);
  }

  // 주별 (월 내 1~5주)
  const byWeek = new Map<number, number>();
  for (const p of payments) {
    const w = Math.ceil(p.paidAt.getDate() / 7);
    byWeek.set(w, (byWeek.get(w) ?? 0) + p.amount);
  }

  const days = mEnd.getDate();
  const daily = Array.from({ length: days }, (_, i) => ({ day: i + 1, amount: byDay.get(String(i + 1)) ?? 0 }));

  return {
    total,
    count: payments.length,
    daily,
    weekly: [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, amount]) => ({ week, amount })),
    byType: [...byType.entries()].map(([type, amount]) => ({ type, amount })),
    byMethod: [...byMethod.entries()].map(([method, amount]) => ({ method, amount })),
    byStaff: [...byStaff.entries()].sort((a, b) => b[1] - a[1]).map(([staff, amount]) => ({ staff, amount })),
  };
}

export async function monthlyTrend(centerId: string, months = 6) {
  const now = new Date();
  const out: { label: string; sales: number; newMembers: number; renewals: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const s = startOfMonth(d);
    const e = endOfMonth(d);
    const [sales, newMembers, renewals] = await Promise.all([
      sumPayments(centerId, s, e),
      prisma.member.count({ where: { centerId, joinedAt: { gte: s, lte: e } } }),
      prisma.membership.count({ where: { centerId, isRenewal: true, createdAt: { gte: s, lte: e } } }),
    ]);
    out.push({ label: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`, sales: sales.amount, newMembers, renewals });
  }
  return out;
}
