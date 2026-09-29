import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { Session } from "@/lib/auth";
import { PLAN_LABEL, ROLE_LABEL } from "@/lib/format";

const NAV: { href: string; label: string; adminOnly?: boolean; sales?: boolean }[] = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/members", label: "회원관리" },
  { href: "/attendance", label: "출석" },
  { href: "/pt", label: "PT" },
  { href: "/contracts", label: "계약" },
  { href: "/payments", label: "매출", sales: true },
  { href: "/renewals", label: "재등록" },
  { href: "/messages", label: "메시지" },
  { href: "/stats", label: "통계", sales: true },
  { href: "/import", label: "Excel Import" },
  { href: "/staff", label: "직원관리", adminOnly: true },
  { href: "/settings", label: "설정", adminOnly: true },
];

export function Sidebar({ session, centerName, plan }: { session: Session; centerName: string; plan: string }) {
  const isAdmin = session.role === "CENTER_ADMIN" || session.role === "SUPER_ADMIN";
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">AI 경영비서</div>
        <div className="mt-1 truncate text-base font-bold text-gray-900">{centerName}</div>
        <span className="mt-1 inline-block rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">{PLAN_LABEL[plan] ?? plan}</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {NAV.filter((n) => (!n.adminOnly || isAdmin) && (!n.sales || session.canViewSales || isAdmin)).map((n) => (
          <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900">
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-200 px-5 py-4 text-sm">
        <div className="font-medium text-gray-900">{session.name}</div>
        <div className="text-xs text-gray-500">{ROLE_LABEL[session.role]}</div>
        <form action={logoutAction} className="mt-2">
          <button className="text-xs text-gray-500 underline hover:text-gray-900">로그아웃</button>
        </form>
      </div>
    </aside>
  );
}
