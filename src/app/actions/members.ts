"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCenterSession } from "@/lib/auth";
import { hashPhone, normalizePhone, preparePhone, randomToken } from "@/lib/crypto";
import { addDays, parseDateInput, startOfDay } from "@/lib/format";
import { buildContractContent, DEFAULT_REFUND_POLICY } from "@/lib/services/contracts";
import { findMemberByPhone } from "@/lib/services/members";
import { buildPtRemainMessage, sendKakaoToMember } from "@/lib/services/messaging";
import type { ActionState } from "./auth";

export async function createMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireCenterSession();
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!name) return { error: "이름을 입력하세요." };
  if (phone.length < 10) return { error: "연락처를 올바르게 입력하세요." };

  const dup = await prisma.member.findUnique({ where: { centerId_phoneHash: { centerId: s.centerId, phoneHash: hashPhone(phone) } } });
  if (dup) return { error: `이미 등록된 연락처입니다. (${dup.name})` };

  const member = await prisma.member.create({
    data: {
      centerId: s.centerId,
      name,
      ...preparePhone(phone),
      gender: (formData.get("gender") as string) || null,
      memo: String(formData.get("memo") ?? "") || null,
      staffId: String(formData.get("staffId") ?? "") || null,
      smsAdConsent: formData.get("smsAdConsent") === "on",
      kakaoAdConsent: formData.get("kakaoAdConsent") === "on",
      consentAt: formData.get("smsAdConsent") === "on" || formData.get("kakaoAdConsent") === "on" ? new Date() : null,
      surveyToken: randomToken(),
      joinedAt: parseDateInput(formData.get("joinedAt")) ?? new Date(),
    },
  });
  revalidatePath("/members");
  redirect(`/members/${member.id}`);
}

export async function updateMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireCenterSession();
  const id = String(formData.get("id"));
  const m = await prisma.member.findFirst({ where: { id, centerId: s.centerId } });
  if (!m) return { error: "회원을 찾을 수 없습니다." };

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (phone.length < 10) return { error: "연락처를 올바르게 입력하세요." };
  const dup = await prisma.member.findUnique({ where: { centerId_phoneHash: { centerId: s.centerId, phoneHash: hashPhone(phone) } } });
  if (dup && dup.id !== id) return { error: `다른 회원(${dup.name})이 사용 중인 연락처입니다.` };

  const sms = formData.get("smsAdConsent") === "on";
  const kakao = formData.get("kakaoAdConsent") === "on";
  const hadConsent = m.smsAdConsent || m.kakaoAdConsent;
  const hasConsent = sms || kakao;
  const status = String(formData.get("status") ?? m.status);

  await prisma.member.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? m.name).trim(),
      ...preparePhone(phone),
      gender: (formData.get("gender") as string) || null,
      memo: String(formData.get("memo") ?? "") || null,
      staffId: String(formData.get("staffId") ?? "") || null,
      status,
      smsAdConsent: sms,
      kakaoAdConsent: kakao,
      alimtalkConsent: formData.get("alimtalkConsent") === "on",
      consentAt: !hadConsent && hasConsent ? new Date() : m.consentAt,
      consentRevokedAt: hadConsent && !hasConsent ? new Date() : hasConsent ? null : m.consentRevokedAt,
    },
  });
  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
  return { ok: true };
}

/**
 * 회원권 등록 = 회원권 생성 + 결제 기록 + (선택) 전자계약 초안 생성.
 * 기존 회원권이 있으면 자동으로 "재등록"으로 표시한다.
 */
export async function addMembershipAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireCenterSession();
  const memberId = String(formData.get("memberId"));
  const member = await prisma.member.findFirst({ where: { id: memberId, centerId: s.centerId }, include: { memberships: { take: 1 }, center: true } });
  if (!member) return { error: "회원을 찾을 수 없습니다." };

  const productId = String(formData.get("productId") ?? "");
  const product = productId ? await prisma.product.findFirst({ where: { id: productId, centerId: s.centerId } }) : null;
  const productName = product?.name ?? String(formData.get("productName") ?? "").trim();
  if (!productName) return { error: "상품을 선택하거나 상품명을 입력하세요." };
  const amount = Number(formData.get("amount") ?? product?.price ?? 0);
  const startDate = parseDateInput(formData.get("startDate")) ?? startOfDay();
  const days = Number(formData.get("days") ?? product?.durationDays ?? 30);
  const endDate = parseDateInput(formData.get("endDate")) ?? addDays(startDate, days - 1);
  if (endDate < startDate) return { error: "종료일이 시작일보다 빠릅니다." };
  const isRenewal = member.memberships.length > 0;
  const method = String(formData.get("method") ?? "CARD");
  const makeContract = formData.get("makeContract") === "on";

  const membership = await prisma.membership.create({
    data: { centerId: s.centerId, memberId, productId: product?.id, productName, startDate, endDate, amount, isRenewal, status: "ACTIVE" },
  });
  if (amount > 0) {
    await prisma.payment.create({
      data: {
        centerId: s.centerId, memberId, membershipId: membership.id, productName, amount,
        type: isRenewal ? "RENEWAL" : "NEW", method, salespersonId: s.userId,
      },
    });
  }
  // 이전 회원권의 재등록 상태 자동 갱신
  await prisma.renewal.updateMany({
    where: { memberId, status: { in: ["UNCONFIRMED", "PLANNED", "UNREACHABLE"] } },
    data: { status: "RENEWED", answeredAt: new Date(), answeredBy: "STAFF" },
  });
  await prisma.member.update({ where: { id: memberId }, data: { status: "ACTIVE" } });

  if (makeContract) {
    const { decryptPhone, formatPhone } = await import("@/lib/crypto");
    const content = buildContractContent({
      centerName: member.center.name, centerAddress: member.center.address, centerPhone: member.center.phone,
      memberName: member.name, memberPhone: formatPhone(decryptPhone(member.phoneEncrypted)),
      productName, amount, startDate, endDate, refundPolicy: DEFAULT_REFUND_POLICY, termsVersion: "v1",
    });
    const contract = await prisma.contract.create({
      data: {
        centerId: s.centerId, memberId, membershipId: membership.id, contractType: "MEMBERSHIP", productName, amount,
        startDate, endDate, refundPolicy: DEFAULT_REFUND_POLICY, termsVersion: "v1", content, signToken: randomToken(),
      },
    });
    revalidatePath(`/members/${memberId}`);
    redirect(`/contracts/${contract.id}`);
  }
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/dashboard");
  redirect(`/members/${memberId}`);
}

export async function addPtPackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireCenterSession();
  const memberId = String(formData.get("memberId"));
  const member = await prisma.member.findFirst({ where: { id: memberId, centerId: s.centerId }, include: { center: true } });
  if (!member) return { error: "회원을 찾을 수 없습니다." };
  const productId = String(formData.get("productId") ?? "");
  const product = productId ? await prisma.product.findFirst({ where: { id: productId, centerId: s.centerId } }) : null;
  const productName = product?.name ?? String(formData.get("productName") ?? "PT").trim();
  const totalCount = Number(formData.get("totalCount") ?? product?.ptCount ?? 0);
  if (totalCount <= 0) return { error: "PT 횟수를 입력하세요." };
  const amount = Number(formData.get("amount") ?? product?.price ?? 0);
  const trainerId = String(formData.get("trainerId") ?? "") || null;
  const expireDate = parseDateInput(formData.get("expireDate"));
  const makeContract = formData.get("makeContract") === "on";

  const pkg = await prisma.ptPackage.create({
    data: { centerId: s.centerId, memberId, productId: product?.id, productName, totalCount, amount, trainerId, expireDate },
  });
  if (amount > 0) {
    await prisma.payment.create({
      data: { centerId: s.centerId, memberId, ptPackageId: pkg.id, productName, amount, type: "PT", method: String(formData.get("method") ?? "CARD"), salespersonId: s.userId },
    });
  }
  if (makeContract) {
    const { decryptPhone, formatPhone } = await import("@/lib/crypto");
    const content = buildContractContent({
      centerName: member.center.name, centerAddress: member.center.address, centerPhone: member.center.phone,
      memberName: member.name, memberPhone: formatPhone(decryptPhone(member.phoneEncrypted)),
      productName, amount, ptCount: totalCount, endDate: expireDate, refundPolicy: DEFAULT_REFUND_POLICY, termsVersion: "v1",
    });
    const contract = await prisma.contract.create({
      data: {
        centerId: s.centerId, memberId, ptPackageId: pkg.id, contractType: "PT", productName, amount, ptCount: totalCount,
        endDate: expireDate, refundPolicy: DEFAULT_REFUND_POLICY, content, signToken: randomToken(),
      },
    });
    redirect(`/contracts/${contract.id}`);
  }
  revalidatePath(`/members/${memberId}`);
  redirect(`/members/${memberId}`);
}

/** PT 1회 차감 (확인창은 클라이언트에서) → 차감 후 회원에게 남은 횟수 + 응원 문구 카카오 알림톡 자동 발송 */
export async function usePtSessionAction(formData: FormData) {
  const s = await requireCenterSession();
  const ptPackageId = String(formData.get("ptPackageId"));
  const pkg = await prisma.ptPackage.findFirst({
    where: { id: ptPackageId, centerId: s.centerId },
    include: { member: { select: { name: true } }, trainer: { select: { name: true } }, center: { select: { name: true } } },
  });
  if (!pkg || pkg.usedCount >= pkg.totalCount) return;
  const [, updated] = await prisma.$transaction([
    prisma.ptSession.create({ data: { centerId: s.centerId, ptPackageId, memberId: pkg.memberId, trainerId: pkg.trainerId ?? s.userId, memo: String(formData.get("memo") ?? "") || null } }),
    prisma.ptPackage.update({ where: { id: ptPackageId }, data: { usedCount: { increment: 1 } } }),
    prisma.member.update({ where: { id: pkg.memberId }, data: { lastVisitAt: new Date() } }),
  ]);

  const remaining = updated.totalCount - updated.usedCount;
  const trainerName = pkg.trainer?.name ?? s.name;
  const content = buildPtRemainMessage({ memberName: pkg.member.name, centerName: pkg.center.name, remaining, total: updated.totalCount, trainerName });
  await sendKakaoToMember({
    centerId: s.centerId, memberId: pkg.memberId, template: "PT_REMAIN", type: "INFO", content,
    variables: { 회원명: pkg.member.name, 센터명: pkg.center.name, 잔여횟수: String(remaining), 총횟수: String(updated.totalCount), 트레이너: trainerName },
  });

  revalidatePath(`/members/${pkg.memberId}`);
  revalidatePath("/pt");
  revalidatePath("/messages");
}

/** 실수로 누른 "1회 사용"을 되돌린다: 가장 최근 세션 기록 삭제 + 사용횟수 -1 */
export async function undoPtSessionAction(formData: FormData) {
  const s = await requireCenterSession();
  const ptPackageId = String(formData.get("ptPackageId"));
  const pkg = await prisma.ptPackage.findFirst({ where: { id: ptPackageId, centerId: s.centerId } });
  if (!pkg || pkg.usedCount <= 0) return;
  const last = await prisma.ptSession.findFirst({ where: { ptPackageId }, orderBy: { usedAt: "desc" } });
  await prisma.$transaction([
    ...(last ? [prisma.ptSession.delete({ where: { id: last.id } })] : []),
    prisma.ptPackage.update({ where: { id: ptPackageId }, data: { usedCount: { decrement: 1 } } }),
  ]);
  revalidatePath(`/members/${pkg.memberId}`);
  revalidatePath("/pt");
}

export async function checkInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireCenterSession();
  let memberId = String(formData.get("memberId") ?? "");
  if (!memberId) {
    const q = String(formData.get("q") ?? "");
    const byPhone = await findMemberByPhone(s.centerId, q);
    if (byPhone) memberId = byPhone.id;
    else {
      const candidates = await prisma.member.findMany({ where: { centerId: s.centerId, OR: [{ name: q.trim() }, { phoneLast4: q.trim() }] } });
      if (candidates.length === 1) memberId = candidates[0].id;
      else if (candidates.length > 1) return { error: "동명이인이 있습니다. 전화번호 전체로 검색하세요." };
      else return { error: "회원을 찾을 수 없습니다." };
    }
  }
  const member = await prisma.member.findFirst({
    where: { id: memberId, centerId: s.centerId },
    include: { memberships: { where: { status: "ACTIVE", endDate: { gte: startOfDay() } }, take: 1 } },
  });
  if (!member) return { error: "회원을 찾을 수 없습니다." };
  await prisma.$transaction([
    prisma.attendance.create({ data: { centerId: s.centerId, memberId, source: "DESK" } }),
    prisma.member.update({ where: { id: memberId }, data: { lastVisitAt: new Date(), ...(member.status === "DORMANT" ? { status: "ACTIVE" } : {}) } }),
  ]);
  revalidatePath("/attendance");
  revalidatePath(`/members/${memberId}`);
  if (!member.memberships.length) return { ok: true, error: `${member.name} 회원 출석 처리됨. 단, 유효한 회원권이 없습니다 (만료).` };
  return { ok: true };
}

export async function addPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireCenterSession();
  const memberId = String(formData.get("memberId") ?? "") || null;
  const amount = Number(formData.get("amount") ?? 0);
  if (!amount) return { error: "금액을 입력하세요." };
  await prisma.payment.create({
    data: {
      centerId: s.centerId, memberId, productName: String(formData.get("productName") ?? "기타").trim() || "기타", amount,
      type: String(formData.get("type") ?? "ETC"), method: String(formData.get("method") ?? "CARD"),
      paidAt: parseDateInput(formData.get("paidAt")) ?? new Date(), salespersonId: s.userId, memo: String(formData.get("memo") ?? "") || null,
    },
  });
  revalidatePath("/payments");
  if (memberId) revalidatePath(`/members/${memberId}`);
  return { ok: true };
}
