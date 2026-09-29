"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import type { ActionState } from "./auth";

export async function updateCenterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "센터명을 입력하세요." };
  await prisma.center.update({
    where: { id: s.centerId },
    data: {
      name,
      businessNumber: String(formData.get("businessNumber") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      plan: String(formData.get("plan") ?? "BASIC"),
      reportHour: Number(formData.get("reportHour") ?? 22),
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "상품명을 입력하세요." };
  const type = String(formData.get("type") ?? "MEMBERSHIP");
  await prisma.product.create({
    data: {
      centerId: s.centerId,
      name,
      type,
      durationDays: type === "MEMBERSHIP" ? Number(formData.get("durationDays") ?? 30) : null,
      ptCount: type === "PT" ? Number(formData.get("ptCount") ?? 10) : null,
      price: Number(formData.get("price") ?? 0),
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function toggleProductAction(formData: FormData) {
  const s = await requireAdmin();
  const id = String(formData.get("id"));
  const p = await prisma.product.findFirst({ where: { id, centerId: s.centerId } });
  if (!p) return;
  await prisma.product.update({ where: { id }, data: { active: !p.active } });
  revalidatePath("/settings");
}

export async function createStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !name) return { error: "이름과 이메일을 입력하세요." };
  if (password.length < 6) return { error: "비밀번호는 6자 이상이어야 합니다." };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "이미 사용 중인 이메일입니다." };
  await prisma.user.create({
    data: {
      centerId: s.centerId,
      role: String(formData.get("role") ?? "STAFF") === "CENTER_ADMIN" ? "CENTER_ADMIN" : "STAFF",
      name,
      email,
      passwordHash: await hashPassword(password),
      canViewSales: formData.get("canViewSales") === "on",
    },
  });
  revalidatePath("/staff");
  return { ok: true };
}

export async function updateStaffAction(formData: FormData) {
  const s = await requireAdmin();
  const id = String(formData.get("id"));
  const u = await prisma.user.findFirst({ where: { id, centerId: s.centerId } });
  if (!u || u.id === s.userId) return;
  const action = String(formData.get("action") ?? "");
  if (action === "toggleActive") await prisma.user.update({ where: { id }, data: { active: !u.active } });
  if (action === "toggleSales") await prisma.user.update({ where: { id }, data: { canViewSales: !u.canViewSales } });
  if (action === "toggleRole") await prisma.user.update({ where: { id }, data: { role: u.role === "STAFF" ? "CENTER_ADMIN" : "STAFF" } });
  revalidatePath("/staff");
}
