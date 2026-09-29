import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { decryptPhone } from "@/lib/crypto";
import { MESSAGE_PRICE, useCredits } from "@/lib/services/billing";

/**
 * 메시지 발송 계층.
 * - 실제 발송: Solapi(구 CoolSMS) 카카오 알림톡 API. 환경변수가 모두 있으면 사용.
 *   SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER(발신번호), KAKAO_PF_ID(채널 ID),
 *   KAKAO_TEMPLATE_<템플릿키>(사전 승인된 템플릿 ID, 예: KAKAO_TEMPLATE_PT_REMAIN)
 * - 시뮬레이션: 키가 없으면 발송하지 않고 기록만 남긴다 (status = SIMULATED).
 * 정보성(INFO) 메시지는 알림톡 수신 동의, 광고성(AD)은 카카오 광고 동의를 검사한다.
 */

export type TemplateKey = "PT_REMAIN" | "MEMBERSHIP_EXPIRE" | "CONTRACT_DONE" | "RENEWAL_SURVEY";

export interface SendResult {
  status: "SENT" | "SIMULATED" | "FAILED" | "SKIPPED";
  messageId: string;
  detail?: string;
}

export function messagingMode(): "LIVE" | "SIMULATED" {
  return process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER && process.env.KAKAO_PF_ID ? "LIVE" : "SIMULATED";
}

const CHEERS = [
  "오늘도 한 걸음 더 성장하셨어요. 다음 수업에서 뵐게요! 💪",
  "꾸준함이 가장 큰 힘입니다. 오늘 정말 잘하셨어요!",
  "오늘의 땀이 내일의 자신감이 됩니다. 수고 많으셨어요!",
  "포기하지 않는 모습이 멋집니다. 다음 수업도 기대할게요!",
  "몸이 조금씩 달라지고 있어요. 계속 함께 가요! 🔥",
  "오늘 수업 정말 수고하셨습니다. 충분히 쉬고 회복하세요!",
];

export function buildPtRemainMessage(p: { memberName: string; centerName: string; remaining: number; total: number; trainerName?: string | null }) {
  const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)];
  const lines = [
    `[${p.centerName}] ${p.memberName}님, 오늘 PT 수업 수고하셨습니다!`,
    ``,
    `▶ 남은 PT 횟수: ${p.remaining}회 (총 ${p.total}회)`,
  ];
  if (p.trainerName) lines.push(`▶ 담당 트레이너: ${p.trainerName}`);
  lines.push(``, cheer);
  if (p.remaining <= 3 && p.remaining > 0) lines.push(``, `남은 횟수가 ${p.remaining}회입니다. 이어서 운동하실 수 있도록 데스크에서 연장 안내를 도와드릴게요.`);
  if (p.remaining === 0) lines.push(``, `PT가 모두 완료되었습니다. 그동안 정말 수고 많으셨어요! 다음 목표도 함께 준비해요.`);
  return lines.join("\n");
}

export async function sendKakaoToMember(opts: {
  centerId: string;
  memberId: string;
  template: TemplateKey;
  type?: "INFO" | "AD";
  content: string;
  variables?: Record<string, string>;
}): Promise<SendResult> {
  const type = opts.type ?? "INFO";
  const member = await prisma.member.findFirst({ where: { id: opts.memberId, centerId: opts.centerId } });
  const base = { centerId: opts.centerId, memberId: opts.memberId, type, channel: "KAKAO", template: opts.template, content: opts.content };

  if (!member) {
    const m = await prisma.message.create({ data: { ...base, status: "FAILED", error: "회원 없음" } });
    return { status: "FAILED", messageId: m.id, detail: "회원 없음" };
  }
  const consent = type === "AD" ? member.kakaoAdConsent : member.alimtalkConsent;
  if (!consent) {
    const m = await prisma.message.create({ data: { ...base, status: "SKIPPED", error: type === "AD" ? "광고 수신 미동의" : "알림톡 수신 거부" } });
    return { status: "SKIPPED", messageId: m.id, detail: m.error ?? undefined };
  }

  if (messagingMode() === "SIMULATED") {
    const m = await prisma.message.create({ data: { ...base, status: "SIMULATED", sentAt: new Date() } });
    return { status: "SIMULATED", messageId: m.id, detail: "발송 대행사 키 미설정 - 기록만 저장" };
  }

  const to = decryptPhone(member.phoneEncrypted);
  const templateId = process.env[`KAKAO_TEMPLATE_${opts.template}`];
  // 실제 발송 시 크레딧 차감 (알림톡 15원, 템플릿 없으면 SMS/LMS 단가)
  const cost = templateId ? MESSAGE_PRICE.KAKAO : opts.content.length > 45 ? MESSAGE_PRICE.LMS : MESSAGE_PRICE.SMS;
  const paid = await useCredits(opts.centerId, cost, `${opts.template} 발송`);
  if (!paid) {
    const m = await prisma.message.create({ data: { ...base, status: "FAILED", error: "메시지 크레딧 잔액 부족 - 설정에서 충전하세요" } });
    return { status: "FAILED", messageId: m.id, detail: m.error ?? undefined };
  }
  try {
    const providerId = await solapiSend({ to, text: opts.content, templateId, variables: opts.variables });
    const m = await prisma.message.create({ data: { ...base, status: "SENT", providerId, sentAt: new Date() } });
    return { status: "SENT", messageId: m.id };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const m = await prisma.message.create({ data: { ...base, status: "FAILED", error: err } });
    return { status: "FAILED", messageId: m.id, detail: err };
  }
}

/** 관장(센터 운영자)에게 발송 — 회원이 아니므로 동의 검사 없이 센터의 리포트 수신 번호로 보낸다 */
export async function sendKakaoToOwner(opts: { centerId: string; template: TemplateKey | "DAILY_REPORT" | "WEEKLY_REPORT" | "MONTHLY_REPORT"; content: string }): Promise<SendResult> {
  const center = await prisma.center.findUniqueOrThrow({ where: { id: opts.centerId }, select: { reportPhone: true, phone: true } });
  const base = { centerId: opts.centerId, memberId: null, type: "INFO", channel: "KAKAO", template: opts.template, content: opts.content };
  const to = (center.reportPhone ?? center.phone ?? "").replace(/\D/g, "");
  if (!to) {
    const m = await prisma.message.create({ data: { ...base, status: "FAILED", error: "리포트 수신 번호 없음 - 설정에서 입력하세요" } });
    return { status: "FAILED", messageId: m.id, detail: m.error ?? undefined };
  }
  if (messagingMode() === "SIMULATED") {
    const m = await prisma.message.create({ data: { ...base, status: "SIMULATED", sentAt: new Date() } });
    return { status: "SIMULATED", messageId: m.id, detail: "발송 대행사 키 미설정 - 기록만 저장" };
  }
  const templateId = process.env[`KAKAO_TEMPLATE_${opts.template}`];
  const cost = templateId ? MESSAGE_PRICE.KAKAO : MESSAGE_PRICE.LMS;
  if (!(await useCredits(opts.centerId, cost, `${opts.template} 발송`))) {
    const m = await prisma.message.create({ data: { ...base, status: "FAILED", error: "메시지 크레딧 잔액 부족" } });
    return { status: "FAILED", messageId: m.id, detail: m.error ?? undefined };
  }
  try {
    const providerId = await solapiSend({ to, text: opts.content, templateId });
    const m = await prisma.message.create({ data: { ...base, status: "SENT", providerId, sentAt: new Date() } });
    return { status: "SENT", messageId: m.id };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const m = await prisma.message.create({ data: { ...base, status: "FAILED", error: err } });
    return { status: "FAILED", messageId: m.id, detail: err };
  }
}

/** Solapi 메시지 발송 (알림톡, 템플릿 없으면 SMS/LMS로 대체) */
async function solapiSend(p: { to: string; text: string; templateId?: string; variables?: Record<string, string> }): Promise<string> {
  const apiKey = process.env.SOLAPI_API_KEY!;
  const apiSecret = process.env.SOLAPI_API_SECRET!;
  const from = process.env.SOLAPI_SENDER!;
  const pfId = process.env.KAKAO_PF_ID!;
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");

  const message: Record<string, unknown> = { to: p.to, from, text: p.text };
  if (p.templateId) {
    message.kakaoOptions = {
      pfId,
      templateId: p.templateId,
      variables: Object.fromEntries(Object.entries(p.variables ?? {}).map(([k, v]) => [`#{${k}}`, v])),
    };
  } else {
    message.type = p.text.length > 45 ? "LMS" : "SMS";
  }

  const res = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({ message }),
  });
  const json = (await res.json().catch(() => ({}))) as { groupId?: string; errorMessage?: string; message?: string };
  if (!res.ok) throw new Error(json.errorMessage ?? json.message ?? `HTTP ${res.status}`);
  return json.groupId ?? "";
}
