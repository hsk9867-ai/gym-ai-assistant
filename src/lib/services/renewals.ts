import { prisma } from "@/lib/db";
import { addDays, daysBetween, startOfDay, startOfMonth, endOfMonth } from "@/lib/format";
import { decryptPhone, formatPhone } from "@/lib/crypto";

export const EXPIRY_BUCKETS = [30, 14, 7, 3, 1] as const;

/**
 * 만료 예정(30일 이내) 또는 최근 만료(60일 이내) 회원권마다 재등록 레코드를 보장하고,
 * 이후 회원권이 새로 생긴 경우 자동으로 "재등록 완료" 처리한다.
 */
export async function ensureRenewals(centerId: string) {
  const today = startOfDay();
  const targets = await prisma.membership.findMany({
    where: {
      centerId,
      status: { in: ["ACTIVE", "EXPIRED"] },
      endDate: { gte: addDays(today, -60), lte: addDays(today, 30) },
      renewal: null,
    },
    select: { id: true, memberId: true },
  });
  if (targets.length) {
    await prisma.renewal.createMany({
      data: targets.map((t) => ({ centerId, memberId: t.memberId, membershipId: t.id })),
    });
  }

  // 후속 회원권이 있으면 재등록 완료로 자동 처리
  const open = await prisma.renewal.findMany({
    where: { centerId, status: { in: ["UNCONFIRMED", "PLANNED", "UNREACHABLE"] } },
    include: { membership: { select: { endDate: true, startDate: true } } },
  });
  for (const r of open) {
    const next = await prisma.membership.findFirst({
      where: {
        memberId: r.memberId,
        id: { not: r.membershipId },
        startDate: { gt: r.membership.startDate },
        status: { in: ["ACTIVE", "PAUSED"] },
      },
    });
    if (next) {
      await prisma.renewal.update({ where: { id: r.id }, data: { status: "RENEWED", answeredAt: new Date(), answeredBy: "STAFF" } });
    }
  }
}

export interface RenewalRow {
  id: string;
  memberId: string;
  memberName: string;
  phone: string;
  productName: string;
  endDate: Date;
  daysLeft: number;
  bucket: number | null;
  status: string;
  reason: string | null;
  feedback: string | null;
  contactedAt: Date | null;
  surveyToken: string | null;
}

export async function listRenewals(centerId: string, opts: { status?: string; bucket?: string } = {}) {
  const today = startOfDay();
  const where: Record<string, unknown> = { centerId };
  if (opts.status) where.status = opts.status;

  const rows = await prisma.renewal.findMany({
    where,
    include: {
      member: { select: { id: true, name: true, phoneEncrypted: true, surveyToken: true } },
      membership: { select: { productName: true, endDate: true } },
    },
    orderBy: { membership: { endDate: "asc" } },
    take: 500,
  });

  const mapped: RenewalRow[] = rows.map((r) => {
    const daysLeft = daysBetween(today, r.membership.endDate);
    let bucket: number | null = null;
    if (daysLeft >= 0) {
      for (const b of EXPIRY_BUCKETS) if (daysLeft <= b) bucket = b;
    }
    return {
      id: r.id,
      memberId: r.member.id,
      memberName: r.member.name,
      phone: formatPhone(decryptPhone(r.member.phoneEncrypted)),
      productName: r.membership.productName,
      endDate: r.membership.endDate,
      daysLeft,
      bucket,
      status: r.status,
      reason: r.reason,
      feedback: r.feedback,
      contactedAt: r.contactedAt,
      surveyToken: r.member.surveyToken,
    };
  });

  if (opts.bucket === "expired") return mapped.filter((m) => m.daysLeft < 0);
  if (opts.bucket) {
    const b = Number(opts.bucket);
    return mapped.filter((m) => m.bucket === b);
  }
  return mapped;
}

export interface ReasonStat {
  reason: string;
  count: number;
  ratio: number;
}

export async function renewalAnalytics(centerId: string) {
  const now = new Date();
  const thisStart = startOfMonth(now);
  const thisEnd = endOfMonth(now);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastStart = startOfMonth(lastMonth);
  const lastEnd = endOfMonth(lastMonth);

  async function period(from: Date, to: Date) {
    const rows = await prisma.renewal.findMany({
      where: { centerId, membership: { endDate: { gte: from, lte: to } } },
      select: { status: true, reason: true, feedback: true, member: { select: { name: true } } },
    });
    const total = rows.length;
    const renewed = rows.filter((r) => r.status === "RENEWED").length;
    const notRenewed = rows.filter((r) => r.status === "NOT_RENEWED");
    const answered = notRenewed.filter((r) => r.reason);
    const counts = new Map<string, number>();
    for (const r of answered) counts.set(r.reason!, (counts.get(r.reason!) ?? 0) + 1);
    const reasons: ReasonStat[] = [...counts.entries()]
      .map(([reason, count]) => ({ reason, count, ratio: answered.length ? count / answered.length : 0 }))
      .sort((a, b) => b.count - a.count);
    const feedbacks = notRenewed
      .filter((r) => r.feedback && r.feedback.trim())
      .map((r) => ({ name: r.member.name, feedback: r.feedback!.trim() }));
    return {
      total,
      renewed,
      notRenewed: notRenewed.length,
      answered: answered.length,
      responseRate: notRenewed.length ? answered.length / notRenewed.length : 0,
      renewalRate: total ? renewed / total : 0,
      reasons,
      feedbacks,
    };
  }

  const [thisMonth, prevMonth] = await Promise.all([period(thisStart, thisEnd), period(lastStart, lastEnd)]);

  const allReasons = new Set([...thisMonth.reasons.map((r) => r.reason), ...prevMonth.reasons.map((r) => r.reason)]);
  const changes = [...allReasons].map((reason) => {
    const cur = thisMonth.reasons.find((r) => r.reason === reason)?.ratio ?? 0;
    const prev = prevMonth.reasons.find((r) => r.reason === reason)?.ratio ?? 0;
    return { reason, cur, prev, deltaPt: Math.round((cur - prev) * 1000) / 10 };
  }).sort((a, b) => Math.abs(b.deltaPt) - Math.abs(a.deltaPt));

  return { thisMonth, prevMonth, changes };
}
