"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCenterSession } from "@/lib/auth";
import type { ActionState } from "./auth";

/** 직원이 재등록 상태/사유를 직접 기록 */
export async function updateRenewalAction(formData: FormData) {
  const s = await requireCenterSession();
  const id = String(formData.get("renewalId"));
  const status = String(formData.get("status") ?? "UNCONFIRMED");
  const reason = String(formData.get("reason") ?? "") || null;
  const feedback = String(formData.get("feedback") ?? "").trim() || null;
  const r = await prisma.renewal.findFirst({ where: { id, centerId: s.centerId } });
  if (!r) return;
  await prisma.renewal.update({
    where: { id },
    data: {
      status,
      reason: status === "NOT_RENEWED" ? reason : r.reason,
      feedback: feedback ?? r.feedback,
      contactedAt: status !== "UNCONFIRMED" && !r.contactedAt ? new Date() : r.contactedAt,
      answeredAt: status === "NOT_RENEWED" && reason ? new Date() : r.answeredAt,
      answeredBy: status === "NOT_RENEWED" && reason ? "STAFF" : r.answeredBy,
    },
  });
  revalidatePath("/renewals");
  revalidatePath(`/members/${r.memberId}`);
}

/** 회원이 설문 링크(카카오/문자로 전달)에서 직접 응답 */
export async function submitSurveyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const member = await prisma.member.findUnique({ where: { surveyToken: token } });
  if (!member) return { error: "유효하지 않은 설문 링크입니다." };
  const answer = String(formData.get("answer") ?? ""); // RENEW | NOT_RENEW
  const reason = String(formData.get("reason") ?? "") || null;
  const feedback = String(formData.get("feedback") ?? "").trim() || null;

  const renewal = await prisma.renewal.findFirst({
    where: { memberId: member.id, status: { in: ["UNCONFIRMED", "PLANNED", "UNREACHABLE", "NOT_RENEWED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!renewal) return { error: "현재 진행 중인 재등록 안내가 없습니다." };
  if (answer === "NOT_RENEW" && !reason) return { error: "이유를 선택해 주세요." };

  await prisma.renewal.update({
    where: { id: renewal.id },
    data: {
      status: answer === "RENEW" ? "PLANNED" : "NOT_RENEWED",
      reason: answer === "RENEW" ? null : reason,
      feedback,
      answeredAt: new Date(),
      answeredBy: "MEMBER",
    },
  });
  revalidatePath("/renewals");
  return { ok: true };
}
