"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { daysBetween, startOfDay, ymd } from "@/lib/format";

export interface KioskResult {
  ok: boolean;
  kind: "ENTER" | "DENIED" | "CHOOSE" | "NOT_FOUND" | "ERROR";
  name?: string;
  title: string;
  detail?: string;
  daysLeft?: number | null;
  ptRemaining?: number | null;
  candidates?: { id: string; label: string }[];
}

function maskName(name: string) {
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "O";
  return name[0] + "O".repeat(name.length - 2) + name[name.length - 1];
}

/** 키오스크 체크인: 센터 토큰 + 휴대폰 뒷 4자리 (동명 충돌 시 memberId로 확정) */
export async function kioskCheckInAction(token: string, last4: string, memberId?: string): Promise<KioskResult> {
  const center = await prisma.center.findUnique({ where: { kioskToken: token }, select: { id: true, status: true } });
  if (!center || center.status !== "ACTIVE") return { ok: false, kind: "ERROR", title: "사용할 수 없는 키오스크입니다." };
  if (!/^\d{4}$/.test(last4)) return { ok: false, kind: "ERROR", title: "휴대폰 뒷 4자리를 입력하세요." };

  const today = startOfDay();
  const members = await prisma.member.findMany({
    where: { centerId: center.id, phoneLast4: last4, status: { not: "WITHDRAWN" }, ...(memberId ? { id: memberId } : {}) },
    include: {
      memberships: { where: { status: "ACTIVE", endDate: { gte: today } }, orderBy: { endDate: "desc" }, take: 1 },
      ptPackages: { select: { totalCount: true, usedCount: true } },
      attendances: { where: { checkedAt: { gte: today } }, take: 1 },
    },
  });

  if (members.length === 0) return { ok: false, kind: "NOT_FOUND", title: "등록된 회원을 찾을 수 없습니다.", detail: "데스크에 문의해 주세요." };
  if (members.length > 1) {
    return { ok: false, kind: "CHOOSE", title: "본인 이름을 선택하세요.", candidates: members.map((m) => ({ id: m.id, label: maskName(m.name) })) };
  }

  const m = members[0];
  const ms = m.memberships[0];
  const ptRemaining = m.ptPackages.reduce((s, p) => s + (p.totalCount - p.usedCount), 0);

  if (m.status === "PAUSED") return { ok: false, kind: "DENIED", name: m.name, title: "휴회 중인 회원입니다.", detail: "데스크에서 휴회 해제 후 이용해 주세요." };
  if (!ms) {
    // 만료 회원: 출입 거부, 데스크 안내
    return { ok: false, kind: "DENIED", name: m.name, title: "회원권이 만료되었습니다.", detail: "데스크에서 재등록 후 이용해 주세요.", daysLeft: -1, ptRemaining };
  }

  // 오늘 이미 체크인했으면 중복 기록하지 않고 입장만 허용
  if (m.attendances.length === 0) {
    await prisma.$transaction([
      prisma.attendance.create({ data: { centerId: center.id, memberId: m.id, source: "KIOSK" } }),
      prisma.member.update({ where: { id: m.id }, data: { lastVisitAt: new Date(), ...(m.status === "DORMANT" ? { status: "ACTIVE" } : {}) } }),
    ]);
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  }

  const daysLeft = daysBetween(today, ms.endDate);
  const detail = daysLeft <= 7
    ? `회원권이 ${ymd(ms.endDate)}에 만료됩니다 (D-${daysLeft}). 데스크에서 재등록을 안내받으세요.`
    : `${ms.productName} · ${ymd(ms.endDate)}까지`;
  return { ok: true, kind: "ENTER", name: m.name, title: "입장하세요", detail, daysLeft, ptRemaining };
}

export async function regenerateKioskTokenAction() {
  const s = await requireAdmin();
  await prisma.center.update({ where: { id: s.centerId }, data: { kioskToken: randomToken(16) } });
  revalidatePath("/settings");
}
