import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE = "gym_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret");

export type Role = "SUPER_ADMIN" | "CENTER_ADMIN" | "STAFF";

export interface Session {
  userId: string;
  centerId: string | null;
  role: Role;
  name: string;
  canViewSales: boolean;
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      centerId: (payload.centerId as string | null) ?? null,
      role: payload.role as Role,
      name: String(payload.name),
      canViewSales: Boolean(payload.canViewSales),
    };
  } catch {
    return null;
  }
}

/** 로그인 + 센터 소속이 확인된 세션. 없으면 로그인 화면으로 보낸다. */
export async function requireCenterSession(): Promise<Session & { centerId: string }> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.centerId) redirect("/login?error=nocenter");
  return s as Session & { centerId: string };
}

export async function requireAdmin() {
  const s = await requireCenterSession();
  if (s.role !== "CENTER_ADMIN" && s.role !== "SUPER_ADMIN") redirect("/dashboard?error=forbidden");
  return s;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}
