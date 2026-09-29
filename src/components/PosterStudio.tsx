"use client";

import { useEffect, useRef, useState } from "react";
import { saveCopyAction } from "@/app/actions/events";
import type { EventCopy, PosterTemplate } from "@/lib/services/ai";
import { btnCls, btnSecondaryCls, inputCls } from "./ui";

export type PosterSize = "square" | "story" | "a4";
const SIZES: Record<PosterSize, { w: number; h: number; label: string; hint: string }> = {
  square: { w: 1080, h: 1080, label: "인스타 정사각", hint: "1080×1080" },
  story: { w: 1080, h: 1920, label: "스토리 · 릴스", hint: "1080×1920" },
  a4: { w: 2480, h: 3508, label: "A4 인쇄", hint: "300dpi" },
};

interface Props {
  eventId: string;
  centerName: string;
  period: string;
  initial: EventCopy;
}

/* ---------- 캔버스 렌더러 ---------- */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  // 단어가 없는 긴 한글 문자열은 글자 단위로 분할
  return lines.flatMap((l) => {
    if (ctx.measureText(l).width <= maxWidth) return [l];
    const out: string[] = [];
    let s = "";
    for (const ch of l) {
      if (ctx.measureText(s + ch).width > maxWidth && s) { out.push(s); s = ch; } else s += ch;
    }
    if (s) out.push(s);
    return out;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function drawPoster(canvas: HTMLCanvasElement, size: PosterSize, copy: EventCopy, centerName: string, period: string) {
  const { w, h } = SIZES[size];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const u = w / 1080; // 기준 단위 (1080 폭 기준 스케일)
  const font = (weight: number, px: number) => `${weight} ${px * u}px "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  const [c1, c2] = copy.palette;
  const accent = copy.accent;
  const light = luminance(c1) > 0.6 && luminance(c2) > 0.6; // 밝은 배경이면 어두운 글자
  const ink = light ? "#111111" : "#ffffff";
  const inkSoft = light ? "rgba(17,17,17,0.7)" : "rgba(255,255,255,0.78)";
  const pad = 88 * u;
  const tall = h / w > 1.3;

  // 배경
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 템플릿별 장식
  ctx.save();
  if (copy.template === "bold") {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(w * 0.85, h * 0.18, w * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(w * 0.1, h * 0.9, w * 0.5, 0, Math.PI * 2); ctx.fill();
    // 대각선 스트라이프
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = ink; ctx.lineWidth = 2 * u;
    for (let i = -h; i < w + h; i += 48 * u) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h * 0.6, h); ctx.stroke(); }
  } else if (copy.template === "fresh") {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(w * ((i * 0.37) % 1), h * ((i * 0.53) % 1), w * (0.08 + (i % 3) * 0.07), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, pad * 0.6, pad * 0.6, w - pad * 1.2, h - pad * 1.2, 40 * u); ctx.fill();
  } else {
    // minimal: 얇은 테두리 + 코너 라인
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = accent; ctx.lineWidth = 3 * u;
    ctx.strokeRect(pad * 0.55, pad * 0.55, w - pad * 1.1, h - pad * 1.1);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1 * u;
    ctx.strokeRect(pad * 0.7, pad * 0.7, w - pad * 1.4, h - pad * 1.4);
  }
  ctx.restore();

  const freshInk = copy.template === "fresh" ? "#111111" : ink;
  const freshSoft = copy.template === "fresh" ? "rgba(17,17,17,0.7)" : inkSoft;

  // 상단: 센터명 라벨
  let y = pad * 1.1;
  ctx.fillStyle = copy.template === "fresh" ? "#111111" : accent;
  ctx.font = font(700, 30);
  ctx.textBaseline = "top";
  ctx.fillText(centerName.toUpperCase(), pad, y);
  y += 36 * u;
  ctx.fillStyle = freshSoft;
  ctx.font = font(500, 26);
  ctx.fillText("EVENT", pad, y);

  // 헤드라인
  y = tall ? h * 0.24 : h * 0.22;
  const headSize = copy.headline.length > 10 ? 118 : 138;
  ctx.font = font(900, headSize);
  ctx.fillStyle = freshInk;
  const headLines = wrap(ctx, copy.headline, w - pad * 2);
  for (const l of headLines) { ctx.fillText(l, pad, y); y += headSize * 1.12 * u; }

  // 강조 배지 (할인/혜택)
  y += 18 * u;
  ctx.font = font(700, 44);
  const badgeW = ctx.measureText(copy.subheadline).width + 56 * u;
  ctx.fillStyle = copy.template === "fresh" ? "#111111" : accent;
  roundRect(ctx, pad, y, Math.min(badgeW, w - pad * 2), 78 * u, 39 * u); ctx.fill();
  ctx.fillStyle = copy.template === "fresh" ? "#ffffff" : (luminance(accent) > 0.6 ? "#111111" : "#ffffff");
  ctx.fillText(copy.subheadline, pad + 28 * u, y + 17 * u);
  y += 78 * u + 56 * u;

  // 본문
  ctx.font = font(500, 34);
  ctx.fillStyle = freshSoft;
  const bodyLines = wrap(ctx, copy.body, w - pad * 2).slice(0, tall ? 8 : 5);
  for (const l of bodyLines) { ctx.fillText(l, pad, y); y += 34 * 1.55 * u; }

  // 기간
  if (period) {
    y += 20 * u;
    ctx.font = font(700, 36);
    ctx.fillStyle = freshInk;
    ctx.fillText(`기간  ${period}`, pad, y);
  }

  // CTA: 정사각/A4는 하단 고정, 세로형은 본문 바로 아래 (가운데 공백 방지)
  const ctaH = 110 * u;
  const ctaY = tall ? y + 70 * u : h - pad - ctaH;
  ctx.font = font(800, 42);
  const ctaW = Math.min(ctx.measureText(copy.cta).width + 120 * u, w - pad * 2);
  ctx.fillStyle = copy.template === "minimal" ? accent : freshInk;
  roundRect(ctx, pad, ctaY, ctaW, ctaH, 20 * u); ctx.fill();
  ctx.fillStyle = copy.template === "minimal" ? (luminance(accent) > 0.6 ? "#111111" : "#ffffff") : (light || copy.template === "fresh" ? "#ffffff" : "#111111");
  ctx.fillText(copy.cta, pad + 60 * u, ctaY + 34 * u);

  // 해시태그: CTA 오른쪽에 공간이 있으면 같은 줄, 아니면 별도 줄
  ctx.font = font(500, 26);
  ctx.fillStyle = freshSoft;
  const tags = copy.hashtags.join("  ");
  const tagW = ctx.measureText(tags).width;
  const spare = w - pad * 2 - ctaW - 40 * u;
  if (tall) {
    ctx.fillText(tags, pad, h - pad - 30 * u);
  } else if (tagW <= spare) {
    ctx.textAlign = "right";
    ctx.fillText(tags, w - pad, ctaY + 40 * u);
    ctx.textAlign = "left";
  } else {
    ctx.fillText(tags, pad, ctaY - 48 * u);
  }
}

/* ---------- 스튜디오 UI ---------- */
export function PosterStudio({ eventId, centerName, period, initial }: Props) {
  const [copy, setCopy] = useState<EventCopy>(initial);
  const [size, setSize] = useState<PosterSize>("square");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setCopy(initial); }, [initial]);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // 웹폰트 로딩 후 재렌더
    const draw = () => drawPoster(c, size, copy, centerName, period);
    draw();
    if (typeof document !== "undefined" && "fonts" in document) document.fonts.ready.then(draw);
  }, [copy, size, centerName, period]);

  const download = () => {
    const c = canvasRef.current!;
    const a = document.createElement("a");
    a.download = `${copy.headline.replace(/\s+/g, "_")}_${SIZES[size].hint.replace("×", "x")}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };
  const copyText = async () => {
    const text = `${copy.headline}\n${copy.subheadline}\n\n${copy.body}\n${period ? `기간: ${period}\n` : ""}\n${copy.cta}\n${copy.hashtags.join(" ")}`;
    await navigator.clipboard.writeText(text);
    alert("홍보 문구가 복사되었습니다. 카카오톡/인스타그램에 붙여넣으세요.");
  };
  const set = (k: keyof EventCopy, v: unknown) => setCopy({ ...copy, [k]: v } as EventCopy);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(Object.keys(SIZES) as PosterSize[]).map((k) => (
            <button key={k} type="button" onClick={() => setSize(k)} className={`rounded-full px-3 py-1 text-sm ${size === k ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>{SIZES[k].label} <span className="opacity-60">{SIZES[k].hint}</span></button>
          ))}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={copyText} className={btnSecondaryCls}>문구 복사</button>
            <button type="button" onClick={download} className={btnCls}>PNG 다운로드</button>
          </div>
        </div>
        <div className="flex justify-center rounded-xl bg-gray-100 p-4">
          <canvas ref={canvasRef} className="max-h-[70vh] w-auto max-w-full rounded-lg shadow-lg" />
        </div>
        <p className="mt-2 text-xs text-gray-400">글자는 캔버스에서 직접 그려 한글이 깨지지 않습니다. 다운로드한 PNG는 인스타그램·카카오 광고 메시지·인쇄에 바로 사용할 수 있습니다.</p>
      </div>

      <form action={saveCopyAction} className="space-y-3 lg:col-span-2">
        <input type="hidden" name="eventId" value={eventId} />
        <div className="text-sm font-semibold text-gray-800">문구 · 디자인 편집</div>
        <label className="block text-xs text-gray-500">대제목<input name="headline" value={copy.headline} maxLength={20} onChange={(e) => set("headline", e.target.value)} className={inputCls} /></label>
        <label className="block text-xs text-gray-500">부제 (배지)<input name="subheadline" value={copy.subheadline} maxLength={40} onChange={(e) => set("subheadline", e.target.value)} className={inputCls} /></label>
        <label className="block text-xs text-gray-500">본문<textarea name="body" value={copy.body} rows={4} maxLength={400} onChange={(e) => set("body", e.target.value)} className={inputCls} /></label>
        <label className="block text-xs text-gray-500">행동 유도 (CTA)<input name="cta" value={copy.cta} maxLength={20} onChange={(e) => set("cta", e.target.value)} className={inputCls} /></label>
        <label className="block text-xs text-gray-500">해시태그<input name="hashtags" value={copy.hashtags.join(" ")} onChange={(e) => set("hashtags", e.target.value.split(/\s+/).filter(Boolean))} className={inputCls} /></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-xs text-gray-500">배경 1<input type="color" name="color1" value={copy.palette[0]} onChange={(e) => set("palette", [e.target.value, copy.palette[1]])} className="h-9 w-full rounded border" /></label>
          <label className="block text-xs text-gray-500">배경 2<input type="color" name="color2" value={copy.palette[1]} onChange={(e) => set("palette", [copy.palette[0], e.target.value])} className="h-9 w-full rounded border" /></label>
          <label className="block text-xs text-gray-500">강조색<input type="color" name="accent" value={copy.accent} onChange={(e) => set("accent", e.target.value)} className="h-9 w-full rounded border" /></label>
        </div>
        <label className="block text-xs text-gray-500">레이아웃
          <select name="template" value={copy.template} onChange={(e) => set("template", e.target.value as PosterTemplate)} className={inputCls}>
            <option value="bold">Bold · 강렬한 대비</option>
            <option value="fresh">Fresh · 밝고 친근한</option>
            <option value="minimal">Minimal · 고급스러운</option>
          </select>
        </label>
        <button className={btnSecondaryCls}>편집 내용 저장</button>
      </form>
    </div>
  );
}
