import { prisma } from "@/lib/db";

/**
 * 구독 · 메시지 크레딧 결제 계층.
 * PG(토스페이먼츠) 키가 없으면 테스트 결제(SIMULATED)로 즉시 승인 처리한다.
 * 실제 연동 시: 결제창 → 성공 콜백에서 confirm API 호출 → 아래 applyXxx 함수 실행.
 */

export const PLANS = {
  BASIC: { name: "BASIC", price: 7900, desc: "회원·계약·출석·PT·기본 매출통계", features: ["회원관리", "전자계약", "출석·PT", "기본 매출통계", "재등록 관리(기본)"] },
  SMART: { name: "SMART", price: 15900, desc: "자동 만료관리 · 미재등록 사유수집 · 일/주/월 보고", features: ["BASIC 전체", "자동 만료관리", "미재등록 사유수집", "일/주/월 관장 리포트", "키오스크"] },
  AI_PRO: { name: "AI PRO", price: 19900, desc: "AI 분석 · AI 경영비서 · AI 포스터 · 홈페이지 챗봇", features: ["SMART 전체", "AI 데이터 분석", "AI 경영비서(자연어 질의)", "AI 이벤트 포스터", "홈페이지 AI 챗봇"] },
} as const;
export type PlanKey = keyof typeof PLANS;

export const MESSAGE_PRICE = { KAKAO: 15, SMS: 20, LMS: 50 } as const;
export const CREDIT_PACKS = [10000, 30000, 50000, 100000] as const;

export function billingMode(): "LIVE" | "SIMULATED" {
  return process.env.TOSS_SECRET_KEY && process.env.TOSS_CLIENT_KEY ? "LIVE" : "SIMULATED";
}

function nextMonth(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/** 요금제 변경(결제). 업그레이드는 즉시 적용, 같은 요금제면 갱신. */
export async function applyPlanChange(centerId: string, plan: PlanKey, method = "CARD") {
  const p = PLANS[plan];
  const mode = billingMode();
  const center = await prisma.center.findUniqueOrThrow({ where: { id: centerId } });
  const renewsAt = center.planStatus === "ACTIVE" && center.plan === plan && center.planRenewsAt && center.planRenewsAt > new Date()
    ? nextMonth(center.planRenewsAt)
    : nextMonth();
  const [tx] = await prisma.$transaction([
    prisma.billingTransaction.create({
      data: { centerId, type: "SUBSCRIPTION", plan, amount: p.price, method, status: mode === "LIVE" ? "PAID" : "SIMULATED", provider: mode === "LIVE" ? "TOSS" : "SIMULATED", memo: `${p.name} 월 구독` },
    }),
    prisma.center.update({ where: { id: centerId }, data: { plan, planStatus: "ACTIVE", planRenewsAt: renewsAt } }),
  ]);
  return tx;
}

export async function cancelPlan(centerId: string) {
  await prisma.center.update({ where: { id: centerId }, data: { planStatus: "CANCELLED" } });
}

/** 메시지 크레딧 충전 */
export async function chargeCredits(centerId: string, amount: number, method = "CARD") {
  if (!CREDIT_PACKS.includes(amount as (typeof CREDIT_PACKS)[number])) throw new Error("지원하지 않는 충전 금액입니다.");
  const mode = billingMode();
  const bonus = amount >= 100000 ? 10000 : amount >= 50000 ? 3000 : 0;
  const [tx] = await prisma.$transaction([
    prisma.billingTransaction.create({
      data: { centerId, type: "CREDIT_CHARGE", amount, credits: amount + bonus, method, status: mode === "LIVE" ? "PAID" : "SIMULATED", provider: mode === "LIVE" ? "TOSS" : "SIMULATED", memo: bonus ? `보너스 ${bonus.toLocaleString()}원 포함` : null },
    }),
    prisma.center.update({ where: { id: centerId }, data: { messageCredits: { increment: amount + bonus } } }),
  ]);
  return tx;
}

/** 메시지 발송 시 크레딧 차감. 잔액 부족이면 false. */
export async function useCredits(centerId: string, cost: number, memo: string): Promise<boolean> {
  const center = await prisma.center.findUniqueOrThrow({ where: { id: centerId }, select: { messageCredits: true } });
  if (center.messageCredits < cost) return false;
  await prisma.$transaction([
    prisma.center.update({ where: { id: centerId }, data: { messageCredits: { decrement: cost } } }),
    prisma.billingTransaction.create({ data: { centerId, type: "CREDIT_USE", amount: cost, credits: -cost, status: "PAID", provider: "INTERNAL", memo } }),
  ]);
  return true;
}

export async function billingSummary(centerId: string) {
  const [center, txs, monthUse] = await Promise.all([
    prisma.center.findUniqueOrThrow({ where: { id: centerId } }),
    prisma.billingTransaction.findMany({ where: { centerId, type: { not: "CREDIT_USE" } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.billingTransaction.aggregate({ where: { centerId, type: "CREDIT_USE", createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { amount: true }, _count: true }),
  ]);
  return { center, txs, monthUseAmount: monthUse._sum.amount ?? 0, monthUseCount: monthUse._count };
}
