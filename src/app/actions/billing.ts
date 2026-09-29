"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { applyPlanChange, cancelPlan, chargeCredits, PLANS, type PlanKey } from "@/lib/services/billing";
import type { ActionState } from "./auth";

export async function changePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const plan = String(formData.get("plan") ?? "") as PlanKey;
  if (!(plan in PLANS)) return { error: "요금제를 선택하세요." };
  await applyPlanChange(s.centerId, plan, String(formData.get("method") ?? "CARD"));
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/events");
  return { ok: true };
}

export async function cancelPlanAction() {
  const s = await requireAdmin();
  await cancelPlan(s.centerId);
  revalidatePath("/settings");
}

export async function chargeCreditsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const amount = Number(formData.get("amount") ?? 0);
  try {
    await chargeCredits(s.centerId, amount, String(formData.get("method") ?? "CARD"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "충전 실패" };
  }
  revalidatePath("/settings");
  revalidatePath("/messages");
  return { ok: true };
}
