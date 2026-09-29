"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCenterSession } from "@/lib/auth";
import { decryptPhone, formatPhone, randomToken, sha256 } from "@/lib/crypto";
import { parseDateInput } from "@/lib/format";
import { buildContractContent, DEFAULT_REFUND_POLICY } from "@/lib/services/contracts";
import type { ActionState } from "./auth";

/** 회원 상세에서 독립적으로 계약서 초안 생성 */
export async function createContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireCenterSession();
  const memberId = String(formData.get("memberId"));
  const member = await prisma.member.findFirst({ where: { id: memberId, centerId: s.centerId }, include: { center: true } });
  if (!member) return { error: "회원을 찾을 수 없습니다." };
  const productName = String(formData.get("productName") ?? "").trim();
  if (!productName) return { error: "상품명을 입력하세요." };
  const amount = Number(formData.get("amount") ?? 0);
  const startDate = parseDateInput(formData.get("startDate"));
  const endDate = parseDateInput(formData.get("endDate"));
  const ptCount = Number(formData.get("ptCount") ?? 0) || null;
  const refundPolicy = String(formData.get("refundPolicy") ?? "").trim() || DEFAULT_REFUND_POLICY;
  const contractType = ptCount && startDate ? "COMBINED" : ptCount ? "PT" : "MEMBERSHIP";

  const content = buildContractContent({
    centerName: member.center.name, centerAddress: member.center.address, centerPhone: member.center.phone,
    memberName: member.name, memberPhone: formatPhone(decryptPhone(member.phoneEncrypted)),
    productName, amount, startDate, endDate, ptCount, refundPolicy, termsVersion: "v1",
  });
  const contract = await prisma.contract.create({
    data: { centerId: s.centerId, memberId, contractType, productName, amount, startDate, endDate, ptCount, refundPolicy, content, signToken: randomToken() },
  });
  redirect(`/contracts/${contract.id}`);
}

/** 현장 서명 (직원 로그인 상태) */
export async function signContractOnSiteAction(formData: FormData) {
  const s = await requireCenterSession();
  const id = String(formData.get("contractId"));
  const contract = await prisma.contract.findFirst({ where: { id, centerId: s.centerId } });
  if (!contract || contract.status === "SIGNED") return;
  await finalizeSignature(contract.id, contract.content, String(formData.get("signature") ?? ""));
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
}

/** 원격 서명 (회원이 링크로 접속, 로그인 없음, 토큰 + 전화번호 뒷자리 확인) */
export async function signContractRemoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const last4 = String(formData.get("last4") ?? "").trim();
  const signature = String(formData.get("signature") ?? "");
  const contract = await prisma.contract.findUnique({ where: { signToken: token }, include: { member: true } });
  if (!contract) return { error: "유효하지 않은 계약 링크입니다." };
  if (contract.status === "SIGNED") return { error: "이미 서명이 완료된 계약입니다." };
  if (contract.member.phoneLast4 !== last4) return { error: "휴대폰 번호 뒷 4자리가 일치하지 않습니다." };
  if (!signature.startsWith("data:image/png")) return { error: "서명을 입력하세요." };
  if (formData.get("agree") !== "on") return { error: "계약 내용 및 개인정보 처리에 동의해야 합니다." };
  await finalizeSignature(contract.id, contract.content, signature);
  return { ok: true };
}

async function finalizeSignature(contractId: string, content: string, signature: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  const ua = h.get("user-agent") ?? "";
  const signedAt = new Date();
  const documentHash = sha256(`${content}\n${signature}\n${signedAt.toISOString()}`);
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "SIGNED", signatureImage: signature, signedAt, signedIp: ip, signedUserAgent: ua, documentHash },
  });
}

export async function markContractSentAction(formData: FormData) {
  const s = await requireCenterSession();
  const id = String(formData.get("contractId"));
  await prisma.contract.updateMany({ where: { id, centerId: s.centerId, status: "DRAFT" }, data: { status: "SENT" } });
  revalidatePath(`/contracts/${id}`);
}

export async function cancelContractAction(formData: FormData) {
  const s = await requireCenterSession();
  const id = String(formData.get("contractId"));
  await prisma.contract.updateMany({ where: { id, centerId: s.centerId, status: { not: "SIGNED" } }, data: { status: "CANCELLED" } });
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
}
