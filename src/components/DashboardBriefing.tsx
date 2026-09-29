"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Insight, InsightTone } from "@/lib/services/stats";

export interface BriefKpi { label: string; value: number; unit: string; sub?: string; delta?: number | null }
export interface BriefAction { label: string; count: number; href: string; tone: InsightTone }
export interface BriefPoint { label: string; sales: number; visits: number }

interface Props {
  centerName: string;
  plan: string;
  userName: string;
  insights: Insight[];
  kpis: BriefKpi[];
  series: BriefPoint[];
  actions: BriefAction[];
  showSales: boolean;
}

/* ---------- 숫자 카운트업 ---------- */
function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function Kpi({ k, index }: { k: BriefKpi; index: number }) {
  const v = useCountUp(k.value);
  const deltaTxt = k.delta === null || k.delta === undefined ? null : `${k.delta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(k.delta * 100))}%`;
  const deltaCls = k.delta === null || k.delta === undefined ? "" : k.delta >= 0 ? "text-emerald-300" : "text-rose-300";
  return (
    <div className="brief-in rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10" style={{ animationDelay: `${120 + index * 90}ms` }}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/50">{k.label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-white">{v.toLocaleString("ko-KR")}</span>
        <span className="text-sm text-white/60">{k.unit}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
        {deltaTxt && <span className={`font-semibold ${deltaCls}`}>{deltaTxt}</span>}
        {k.sub && <span>{k.sub}</span>}
      </div>
    </div>
  );
}

/* ---------- 스파크라인 (단일 계열, 2px 선, 범례 없음) ---------- */
function Sparkline({ points, accessor, title, unit, color }: { points: BriefPoint[]; accessor: (p: BriefPoint) => number; title: string; unit: string; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  const W = 260, H = 64, PX = 6, PY = 8;
  const vals = points.map(accessor);
  const max = Math.max(...vals, 1);
  const xs = points.map((_, i) => PX + (i * (W - PX * 2)) / Math.max(1, points.length - 1));
  const ys = vals.map((v) => H - PY - (v / max) * (H - PY * 2));
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${d} L${xs[xs.length - 1].toFixed(1)},${H - PY} L${xs[0].toFixed(1)},${H - PY} Z`;
  useEffect(() => { if (pathRef.current) setLen(pathRef.current.getTotalLength()); }, [d]);
  const total = vals.reduce((a, b) => a + b, 0);
  const idx = hover ?? points.length - 1;
  return (
    <div className="brief-in rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10" style={{ animationDelay: "420ms" }}>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">{title} · 최근 7일</span>
        <span className="text-xs text-white/70"><span className="text-white/50">{points[idx]?.label}</span> <b className="tabular-nums text-white">{vals[idx].toLocaleString("ko-KR")}</b>{unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-16 w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`g-${title}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g-${title})`} className="brief-fade" />
        <path ref={pathRef} d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={len ? { strokeDasharray: len, strokeDashoffset: len, animation: "brief-draw 1.1s ease-out 0.3s forwards" } : undefined} />
        {hover !== null && <line x1={xs[hover]} x2={xs[hover]} y1={PY} y2={H - PY} stroke="rgba(255,255,255,0.35)" strokeDasharray="2 3" />}
        {xs.map((x, i) => (
          <g key={i}>
            <rect x={x - (W / points.length) / 2} y={0} width={W / points.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
            <circle cx={x} cy={ys[i]} r={i === idx ? 4 : 0} fill="#0b1220" stroke={color} strokeWidth="2" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/40"><span>{points[0]?.label}</span><span>7일 합계 {total.toLocaleString("ko-KR")}{unit}</span><span>{points[points.length - 1]?.label}</span></div>
    </div>
  );
}

/* ---------- 인사이트 ---------- */
const TONE: Record<InsightTone, { dot: string; ring: string; icon: string; label: string }> = {
  bad: { dot: "bg-rose-400", ring: "ring-rose-400/40", icon: "!", label: "위험" },
  warn: { dot: "bg-amber-300", ring: "ring-amber-300/40", icon: "△", label: "주의" },
  good: { dot: "bg-emerald-400", ring: "ring-emerald-400/40", icon: "✓", label: "양호" },
  info: { dot: "bg-sky-300", ring: "ring-sky-300/40", icon: "i", label: "참고" },
};

function useClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => setT(new Date().toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }));
    f();
    const id = setInterval(f, 30000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export function DashboardBriefing({ centerName, plan, userName, insights, kpis, series, actions, showSales }: Props) {
  const clock = useClock();
  const hour = new Date().getHours();
  const greet = hour < 11 ? "좋은 아침입니다" : hour < 17 ? "좋은 오후입니다" : "수고 많으셨습니다";
  const worst = insights[0]?.tone ?? "good";
  const headline = worst === "bad" ? "즉시 확인이 필요한 항목이 있습니다" : worst === "warn" ? "오늘 챙길 항목이 있습니다" : "센터 운영이 안정적입니다";

  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-[#0b1220] p-6 text-white shadow-xl ring-1 ring-white/10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <header className="brief-in relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/50">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
            {plan === "AI_PRO" ? "AI 경영 브리핑" : "경영 브리핑"} · LIVE
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{greet}, {userName}님. {headline}</h2>
          <p className="mt-0.5 text-sm text-white/55">{centerName} · {clock}</p>
        </div>
        <div className="flex gap-2 text-[11px]">
          {(["bad", "warn", "good"] as InsightTone[]).map((t) => {
            const n = insights.filter((i) => i.tone === t).length;
            return n ? <span key={t} className={`rounded-full px-2 py-0.5 ring-1 ${TONE[t].ring} text-white/80`}><span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${TONE[t].dot}`} />{TONE[t].label} {n}</span> : null;
          })}
        </div>
      </header>

      <div className="relative mt-5 grid gap-4 lg:grid-cols-5">
        <ul className="space-y-2 lg:col-span-2">
          {insights.map((ins, i) => (
            <li key={i} className="brief-in" style={{ animationDelay: `${150 + i * 80}ms` }}>
              <Link href={ins.href ?? "#"} className="group flex gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/5 transition hover:bg-white/[0.09] hover:ring-white/20">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#0b1220] ${TONE[ins.tone].dot}`} aria-label={TONE[ins.tone].label}>{TONE[ins.tone].icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-white">{ins.title}</span>
                  <span className="block text-xs leading-5 text-white/65">{ins.text}</span>
                </span>
                <span className="ml-auto self-center text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/70">›</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3">
          {kpis.map((k, i) => <Kpi key={k.label} k={k} index={i} />)}
          {showSales && <Sparkline points={series} accessor={(p) => p.sales} title="매출" unit="원" color="#34d399" />}
          <Sparkline points={series} accessor={(p) => p.visits} title="방문" unit="명" color="#7dd3fc" />
        </div>
      </div>

      <footer className="brief-in relative mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4" style={{ animationDelay: "600ms" }}>
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">오늘 할 일</span>
        {actions.filter((a) => a.count > 0).map((a) => (
          <Link key={a.label} href={a.href} className="flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/85 ring-1 ring-white/10 transition hover:bg-white/[0.12]">
            <span className={`h-1.5 w-1.5 rounded-full ${TONE[a.tone].dot}`} />{a.label}<b className="tabular-nums text-white">{a.count}</b>
          </Link>
        ))}
        {actions.every((a) => a.count === 0) && <span className="text-xs text-white/50">처리할 항목이 없습니다.</span>}
      </footer>
    </section>
  );
}
