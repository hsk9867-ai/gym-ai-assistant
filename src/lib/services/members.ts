import { prisma } from "@/lib/db";
import { addDays, startOfDay } from "@/lib/format";
import { decryptPhone, formatPhone, hashPhone, normalizePhone } from "@/lib/crypto";

const DORMANT_DAYS = 30;
const EXPIRING_DAYS = 7;

/**
 * 회원 상태를 회원권/출석 데이터로부터 다시 계산한다.
 * 휴회/탈퇴는 수동 상태이므로 건드리지 않는다.
 */
export async function refreshMemberStatuses(centerId: string) {
  const today = startOfDay();
  const soon = addDays(today, EXPIRING_DAYS);
  const dormantLine = addDays(today, -DORMANT_DAYS);

  // 회원권 상태 갱신 (만료된 ACTIVE → EXPIRED)
  await prisma.membership.updateMany({
    where: { centerId, status: "ACTIVE", endDate: { lt: today } },
    data: { status: "EXPIRED" },
  });

  const members = await prisma.member.findMany({
    where: { centerId, status: { notIn: ["PAUSED", "WITHDRAWN"] } },
    select: {
      id: true,
      status: true,
      lastVisitAt: true,
      joinedAt: true,
      memberships: {
        where: { status: "ACTIVE", endDate: { gte: today } },
        orderBy: { endDate: "desc" },
        take: 1,
        select: { endDate: true },
      },
    },
  });

  const updates: { id: string; status: string }[] = [];
  for (const m of members) {
    const active = m.memberships[0];
    let next: string;
    if (!active) next = "EXPIRED";
    else if (active.endDate <= soon) next = "EXPIRING";
    else {
      const lastTouch = m.lastVisitAt ?? m.joinedAt;
      next = lastTouch < dormantLine ? "DORMANT" : "ACTIVE";
    }
    if (next !== m.status) updates.push({ id: m.id, status: next });
  }
  if (updates.length) {
    await prisma.$transaction(
      updates.map((u) => prisma.member.update({ where: { id: u.id }, data: { status: u.status } })),
    );
  }
}

export interface MemberFilter {
  q?: string;
  status?: string;
  staffId?: string;
  expireWithin?: number; // days
  product?: string;
}

export async function listMembers(centerId: string, f: MemberFilter) {
  const where: Record<string, unknown> = { centerId };
  if (f.status) where.status = f.status;
  if (f.staffId) where.staffId = f.staffId;
  if (f.q) {
    const digits = normalizePhone(f.q);
    if (digits.length >= 10) where.phoneHash = hashPhone(digits);
    else if (/^\d{4}$/.test(f.q)) where.phoneLast4 = f.q;
    else where.name = { contains: f.q };
  }
  if (f.expireWithin) {
    where.memberships = {
      some: {
        status: "ACTIVE",
        endDate: { gte: startOfDay(), lte: addDays(startOfDay(), f.expireWithin) },
      },
    };
  }
  if (f.product) {
    where.memberships = { some: { productName: { contains: f.product } } };
  }

  const rows = await prisma.member.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      staff: { select: { name: true } },
      memberships: { where: { status: "ACTIVE" }, orderBy: { endDate: "desc" }, take: 1 },
      ptPackages: { select: { totalCount: true, usedCount: true } },
    },
  });

  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    phone: formatPhone(decryptPhone(m.phoneEncrypted)),
    status: m.status,
    staff: m.staff?.name ?? "-",
    joinedAt: m.joinedAt,
    lastVisitAt: m.lastVisitAt,
    membership: m.memberships[0] ?? null,
    ptRemaining: m.ptPackages.reduce((s, p) => s + (p.totalCount - p.usedCount), 0),
  }));
}

export async function getMemberDetail(centerId: string, id: string) {
  const m = await prisma.member.findFirst({
    where: { id, centerId },
    include: {
      staff: { select: { id: true, name: true } },
      memberships: { orderBy: { startDate: "desc" }, include: { renewal: true } },
      ptPackages: { orderBy: { createdAt: "desc" }, include: { trainer: { select: { name: true } } } },
      attendances: { orderBy: { checkedAt: "desc" }, take: 30 },
      payments: { orderBy: { paidAt: "desc" }, include: { salesperson: { select: { name: true } } } },
      contracts: { orderBy: { createdAt: "desc" } },
      renewals: { orderBy: { createdAt: "desc" }, include: { membership: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!m) return null;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthVisits = await prisma.attendance.count({
    where: { memberId: id, checkedAt: { gte: monthStart } },
  });
  return { ...m, phone: formatPhone(decryptPhone(m.phoneEncrypted)), monthVisits };
}

export async function findMemberByPhone(centerId: string, phone: string) {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return prisma.member.findUnique({ where: { centerId_phoneHash: { centerId, phoneHash: hashPhone(digits) } } });
}
