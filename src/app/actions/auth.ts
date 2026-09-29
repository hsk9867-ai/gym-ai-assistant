"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyLogin } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";

export type ActionState = { error?: string; ok?: boolean } | undefined;

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await verifyLogin(email, password);
  if (!user) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  await createSession({
    userId: user.id,
    centerId: user.centerId,
    role: user.role as "SUPER_ADMIN" | "CENTER_ADMIN" | "STAFF",
    name: user.name,
    canViewSales: user.canViewSales,
  });
  redirect(user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
}

const signupSchema = z.object({
  centerName: z.string().min(1, "센터명을 입력하세요."),
  name: z.string().min(1, "이름을 입력하세요."),
  email: z.string().email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
  phone: z.string().optional(),
});

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
  if (exists) return { error: "이미 가입된 이메일입니다." };

  const center = await prisma.center.create({
    data: {
      name: d.centerName,
      phone: d.phone || null,
      kioskToken: randomToken(16),
      products: {
        create: [
          { name: "헬스 1개월", type: "MEMBERSHIP", durationDays: 30, price: 70000 },
          { name: "헬스 3개월", type: "MEMBERSHIP", durationDays: 90, price: 180000 },
          { name: "헬스 6개월", type: "MEMBERSHIP", durationDays: 180, price: 300000 },
          { name: "헬스 12개월", type: "MEMBERSHIP", durationDays: 365, price: 480000 },
          { name: "PT 10회", type: "PT", ptCount: 10, price: 600000 },
          { name: "PT 20회", type: "PT", ptCount: 20, price: 1100000 },
        ],
      },
    },
  });
  const user = await prisma.user.create({
    data: {
      centerId: center.id,
      role: "CENTER_ADMIN",
      name: d.name,
      email: d.email.toLowerCase(),
      passwordHash: await hashPassword(d.password),
    },
  });
  await createSession({ userId: user.id, centerId: center.id, role: "CENTER_ADMIN", name: user.name, canViewSales: true });
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
