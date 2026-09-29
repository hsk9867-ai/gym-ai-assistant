import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { endOfMonth, startOfDay } from "@/lib/format";
import { generateAndSend } from "@/app/actions/reports";

export const dynamic = "force-dynamic";

/**
 * 자동 리포트 스케줄러 진입점. 매시간 한 번 호출되면 된다.
 *   - 일일: 센터별 reportHour(기본 22시)
 *   - 주간: 토요일 reportHour
 *   - 월간: 말일 reportHour
 * 호출: GET /api/cron/reports  (헤더 Authorization: Bearer $CRON_SECRET)
 * Windows 작업 스케줄러 / cron / Vercel Cron 어디서든 호출 가능.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const hour = now.getHours();
  const isSaturday = now.getDay() === 6;
  const isLastDay = now.getDate() === endOfMonth(now).getDate();
  const centers = await prisma.center.findMany({ where: { status: "ACTIVE", plan: { in: ["SMART", "AI_PRO"] }, reportHour: hour }, select: { id: true } });

  const sent: { centerId: string; type: string }[] = [];
  for (const c of centers) {
    const types: ("DAILY" | "WEEKLY" | "MONTHLY")[] = ["DAILY", ...(isSaturday ? ["WEEKLY" as const] : []), ...(isLastDay ? ["MONTHLY" as const] : [])];
    for (const type of types) {
      // 같은 날 같은 종류 중복 발송 방지
      const dup = await prisma.report.findFirst({ where: { centerId: c.id, type, createdAt: { gte: startOfDay(now) } } });
      if (dup) continue;
      await generateAndSend(c.id, type, now);
      sent.push({ centerId: c.id, type });
    }
  }
  return NextResponse.json({ ok: true, hour, centers: centers.length, sent });
}
