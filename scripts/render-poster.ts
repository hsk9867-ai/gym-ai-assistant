/**
 * 개발용 포스터 미리보기 렌더러.
 * 브라우저와 같은 drawPoster 로직을 서버에서 실행해 PNG 로 저장한다.
 * 사용: npx tsx scripts/render-poster.ts <출력폴더> [--refresh]  (--refresh: 최신 이벤트 문구를 템플릿으로 다시 생성)
 */
import fs from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { PrismaClient } from "@prisma/client";
import { drawPoster, type PosterSize } from "../src/components/PosterStudio";
import { templateCopy, type EventCopy } from "../src/lib/services/ai";

for (const f of ["malgun.ttf", "malgunbd.ttf"]) {
  const p = `C:\\Windows\\Fonts\\${f}`;
  if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, "Malgun Gothic");
}

async function main() {
  const prisma = new PrismaClient();
  const out = process.argv[2] ?? "poster-preview";
  const refresh = process.argv.includes("--refresh");
  const ev = await prisma.event.findFirstOrThrow({ orderBy: { createdAt: "desc" }, include: { center: true } });
  let copy = JSON.parse(ev.copyJson) as EventCopy;
  if (refresh) {
    copy = templateCopy({ centerName: ev.center.name, title: ev.title, description: ev.description, discount: ev.discount, target: ev.target, startDate: ev.startDate, endDate: ev.endDate, tone: ev.tone });
    await prisma.event.update({ where: { id: ev.id }, data: { copyJson: JSON.stringify(copy), template: copy.template } });
  }
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const period = ev.startDate && ev.endDate ? `${f(ev.startDate)} ~ ${f(ev.endDate)}` : "";
  fs.mkdirSync(out, { recursive: true });
  const variants: { size: PosterSize; template: EventCopy["template"]; palette: [string, string]; accent: string }[] = [
    { size: "square", template: "bold", palette: ["#0f172a", "#1e3a8a"], accent: "#fbbf24" },
    { size: "story", template: "fresh", palette: ["#0ea5e9", "#22c55e"], accent: "#ffffff" },
    { size: "square", template: "minimal", palette: ["#111111", "#3b2f2f"], accent: "#d4af37" },
    { size: "a4", template: "bold", palette: ["#0f172a", "#1e3a8a"], accent: "#fbbf24" },
  ];
  for (const v of variants) {
    const canvas = createCanvas(10, 10);
    drawPoster(canvas as unknown as HTMLCanvasElement, v.size, { ...copy, template: v.template, palette: v.palette, accent: v.accent }, ev.center.name, period);
    const scale = v.size === "a4" ? 0.3 : v.size === "story" ? 0.5 : 0.7;
    const small = createCanvas(Math.round(canvas.width * scale), Math.round(canvas.height * scale));
    small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
    const file = `${out}/${v.template}-${v.size}.png`;
    fs.writeFileSync(file, small.toBuffer("image/png"));
    console.log("saved", file, `${canvas.width}x${canvas.height}`);
  }
  await prisma.$disconnect();
}
main();
