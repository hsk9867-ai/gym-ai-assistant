"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCenterSession } from "@/lib/auth";
import { buildReport, type ReportType } from "@/lib/services/reports";
import { sendKakaoToOwner } from "@/lib/services/messaging";

/** 리포트를 생성하고 관장에게 즉시 발송 (테스트/수동 발송) */
export async function sendReportNowAction(formData: FormData) {
  const s = await requireCenterSession();
  const type = String(formData.get("type") ?? "DAILY") as ReportType;
  await generateAndSend(s.centerId, type, new Date());
  revalidatePath("/reports");
  revalidatePath("/messages");
}

export async function generateAndSend(centerId: string, type: ReportType, date: Date) {
  const r = await buildReport(centerId, type, date);
  const result = await sendKakaoToOwner({ centerId, template: `${type}_REPORT` as "DAILY_REPORT", content: r.text });
  const ok = result.status === "SENT" || result.status === "SIMULATED";
  return prisma.report.create({
    data: {
      centerId, type, periodStart: r.periodStart, periodEnd: r.periodEnd, dataJson: JSON.stringify(r.data), text: r.text,
      status: ok ? "SENT" : "FAILED", sentAt: ok ? new Date() : null,
    },
  });
}
