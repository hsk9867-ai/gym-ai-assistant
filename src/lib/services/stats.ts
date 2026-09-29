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
    prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*) as c FROM PtPackage WHERE centerId = ${centerId} AND (totalCount - usedCount) BETWEEN 1 AND 3`,
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

/** 기획서 6.1 "AI 요약" 자리에 들어갈 규칙 기반 요약 문장 (AI PRO 이전 단계). */
export function buildSummaryLines(s: Awaited<ReturnType<typeof dashboardStats>>): string[] {
  const lines: string[] = [];
  if (s.month.salesDelta !== null) {
    const p = Math.round(s.month.salesDelta * 1000) / 10;
    lines.push(`이번 달 매출은 전월 동기간 대비 ${p >= 0 ? `${p}% 증가` : `${Math.abs(p)}% 감소`}했습니다.`);
  } else if (s.month.sales > 0) {
    lines.push(`이번 달 누적 매출은 ${s.month.sales.toLocaleString("ko-KR")}원입니다.`);
  }
  lines.push(`다음 7일간 만료 예정 회원은 ${s.members.expiring7}명입니다.`);
  if (s.members.dormant > 0) lines.push(`30일 이상 방문하지 않은 회원이 ${s.members.dormant}명 있습니다. 연락이 필요합니다.`);
  if (s.members.lowPt > 0) lines.push(`PT 잔여 3회 이하 회원이 ${s.members.lowPt}명입니다. 재구매 안내를 권합니다.`);
  if (s.month.renewalRate !== null) lines.push(`이번 달 만료 대상 ${s.month.renewalTotal}명 중 재등록률은 ${Math.round(s.month.renewalRate * 100)}%입니다.`);
  return lines;
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
