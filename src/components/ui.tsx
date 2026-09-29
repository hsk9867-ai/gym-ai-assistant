import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-base font-semibold text-gray-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default", href }: { label: string; value: string | number; hint?: string; tone?: "default" | "good" | "warn" | "bad"; href?: string }) {
  const toneCls = { default: "text-gray-900", good: "text-emerald-600", warn: "text-amber-600", bad: "text-red-600" }[tone];
  const body = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const badgeTones: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  EXPIRING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  EXPIRED: "bg-red-50 text-red-700 ring-red-600/20",
  PAUSED: "bg-gray-100 text-gray-600 ring-gray-500/20",
  DORMANT: "bg-orange-50 text-orange-700 ring-orange-600/20",
  WITHDRAWN: "bg-gray-100 text-gray-500 ring-gray-500/20",
  UNCONFIRMED: "bg-gray-100 text-gray-600 ring-gray-500/20",
  PLANNED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  RENEWED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  NOT_RENEWED: "bg-red-50 text-red-700 ring-red-600/20",
  UNREACHABLE: "bg-orange-50 text-orange-700 ring-orange-600/20",
  DRAFT: "bg-gray-100 text-gray-600 ring-gray-500/20",
  SENT: "bg-blue-50 text-blue-700 ring-blue-600/20",
  SIGNED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELLED: "bg-gray-100 text-gray-500 ring-gray-500/20",
  QUEUED: "bg-gray-100 text-gray-600 ring-gray-500/20",
  SIMULATED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  FAILED: "bg-red-50 text-red-700 ring-red-600/20",
  SKIPPED: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  const cls = badgeTones[value] ?? "bg-gray-100 text-gray-600 ring-gray-500/20";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{label ?? value}</span>;
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const cls = variant === "primary"
    ? "bg-gray-900 text-white hover:bg-gray-700"
    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50";
  return <Link href={href} className={`inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium ${cls}`}>{children}</Link>;
}

export const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";
export const btnCls = "inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50";
export const btnSecondaryCls = "inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {empty ? (
            <tr><td colSpan={head.length} className="px-3 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const cls = { error: "bg-red-50 text-red-700 border-red-200", success: "bg-emerald-50 text-emerald-700 border-emerald-200", info: "bg-blue-50 text-blue-700 border-blue-200" }[kind];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Bar({ value, max, label }: { value: number; max: number; label?: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-gray-800" style={{ width: `${w}%` }} />
      </div>
      {label && <span className="w-24 text-right text-xs tabular-nums text-gray-600">{label}</span>}
    </div>
  );
}
