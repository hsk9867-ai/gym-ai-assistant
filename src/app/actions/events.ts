"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCenterSession } from "@/lib/auth";
import { parseDateInput } from "@/lib/format";
import { generateEventCopy, type EventCopy } from "@/lib/services/ai";
import type { ActionState } from "./auth";

async function requireAiPro() {
  const s = await requireCenterSession();
  const center = await prisma.center.findUniqueOrThrow({ where: { id: s.centerId } });
  if (center.plan !== "AI_PRO") redirect("/events?upgrade=1");
  return { s, center };
}

export async function createEventAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { s, center } = await requireAiPro();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "이벤트명을 입력하세요." };
  const input = {
    centerName: center.name,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    discount: String(formData.get("discount") ?? "").trim() || null,
    target: String(formData.get("target") ?? "").trim() || null,
    startDate: parseDateInput(formData.get("startDate")),
    endDate: parseDateInput(formData.get("endDate")),
    tone: String(formData.get("tone") ?? "energetic"),
  };
  const { copy, source, error } = await generateEventCopy(input);
  const ev = await prisma.event.create({
    data: { centerId: s.centerId, ...input, copyJson: JSON.stringify(copy), template: copy.template, copySource: source },
  });
  revalidatePath("/events");
  redirect(`/events/${ev.id}${error ? `?warn=${encodeURIComponent(error)}` : ""}`);
}

/** 문구 다시 생성 (같은 입력으로) */
export async function regenerateCopyAction(formData: FormData) {
  const { s, center } = await requireAiPro();
  const id = String(formData.get("eventId"));
  const ev = await prisma.event.findFirst({ where: { id, centerId: s.centerId } });
  if (!ev) return;
  const { copy, source } = await generateEventCopy({ centerName: center.name, title: ev.title, description: ev.description, discount: ev.discount, target: ev.target, startDate: ev.startDate, endDate: ev.endDate, tone: ev.tone });
  await prisma.event.update({ where: { id }, data: { copyJson: JSON.stringify(copy), template: copy.template, copySource: source } });
  revalidatePath(`/events/${id}`);
}

/** 포스터 스튜디오에서 직접 수정한 문구/템플릿 저장 */
export async function saveCopyAction(formData: FormData) {
  const s = await requireCenterSession();
  const id = String(formData.get("eventId"));
  const ev = await prisma.event.findFirst({ where: { id, centerId: s.centerId } });
  if (!ev) return;
  const prev = JSON.parse(ev.copyJson) as EventCopy;
  const copy: EventCopy = {
    ...prev,
    headline: String(formData.get("headline") ?? prev.headline).slice(0, 20),
    subheadline: String(formData.get("subheadline") ?? prev.subheadline).slice(0, 40),
    body: String(formData.get("body") ?? prev.body).slice(0, 400),
    cta: String(formData.get("cta") ?? prev.cta).slice(0, 20),
    hashtags: String(formData.get("hashtags") ?? prev.hashtags.join(" ")).split(/\s+/).filter((t) => t.startsWith("#")).slice(0, 5),
    palette: [String(formData.get("color1") ?? prev.palette[0]), String(formData.get("color2") ?? prev.palette[1])],
    accent: String(formData.get("accent") ?? prev.accent),
    template: (String(formData.get("template") ?? prev.template) as EventCopy["template"]),
  };
  await prisma.event.update({ where: { id }, data: { copyJson: JSON.stringify(copy), template: copy.template } });
  revalidatePath(`/events/${id}`);
}

export async function setEventStatusAction(formData: FormData) {
  const s = await requireCenterSession();
  const id = String(formData.get("eventId"));
  const status = String(formData.get("status") ?? "DRAFT");
  await prisma.event.updateMany({ where: { id, centerId: s.centerId }, data: { status } });
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
}

export async function deleteEventAction(formData: FormData) {
  const s = await requireCenterSession();
  const id = String(formData.get("eventId"));
  await prisma.event.deleteMany({ where: { id, centerId: s.centerId } });
  revalidatePath("/events");
  redirect("/events");
}
