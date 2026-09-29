import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshMemberStatuses } from "@/lib/services/members";
import { ensureRenewals, listRenewals } from "@/lib/services/renewals";
import { buildSummaryLines, dashboardStats } from "@/lib/services/stats";
import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import { num, pct, won, ymd, RENEWAL_STATUS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await requireCenterSession();
  await refreshMemberStatuses(s.centerId);
  await ensureRenewals(s.centerId);
  const [stats, center, upcoming] = await Promise.all([
    dashboardStats(s.centerId),
    prisma.center.findUnique({ where: { id: s.centerId }, select: { plan: true, name: true } }),
    listRenewals(s.centerId, { status: "UNCONFIRMED" }),
  ]);
  const showSales = s.canViewSales || s.role !== "STAFF";
  const summary = buildSummaryLines(stats);
  const soon = upcoming.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7).slice(0, 8);

  return (
    <div>
      <PageHeader title="대시보드" subtitle={`${center?.name} · ${ymd(new Date())}`} />

      <Card className="mb-6 border-gray-900 bg-gray-900 text-white" title={center?.plan === "AI_PRO" ? "AI 요약" : "오늘의 요약"}>
        <ul className="space-y-1.5 text-sm">
          {summary.map((l) => <li key={l} className="flex gap-2"><span className="text-gray-400">•</span>{l}</li>)}
        </ul>
        {center?.plan !== "AI_PRO" && <p className="mt-3 text-xs text-gray-400">AI PRO 요금제에서는 이 영역에 AI가 해석한 경영 인사이트가 표시됩니다. (MVP 3)</p>}
      </Card>

      <h2 className="mb-2 text-sm font-semibold text-gray-500">오늘</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {showSales && <Stat label="오늘 매출" value={won(stats.today.sales)} />}
        <Stat label="오늘 신규회원" value={num(stats.today.newMembers)} />
        <Stat label="오늘 재등록" value={num(stats.today.renewals)} />
        <Stat label="오늘 방문자" value={num(stats.today.visits)} href="/attendance" />
        {showSales && <Stat label="오늘 PT 매출" value={won(stats.today.ptSales)} />}
        <Stat label="오늘 계약" value={num(stats.today.contracts)} href="/contracts" />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-500">회원</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="전체 활성회원" value={num(stats.members.active)} href="/members" />
        <Stat label="7일 이내 만료" value={num(stats.members.expiring7)} tone={stats.members.expiring7 ? "warn" : "default"} href="/renewals?bucket=7" />
        <Stat label="30일 이내 만료" value={num(stats.members.expiring30)} href="/renewals?bucket=30" />
        <Stat label="장기 미방문" value={num(stats.members.dormant)} tone={stats.members.dormant ? "bad" : "default"} href="/members?status=DORMANT" />
        <Stat label="PT 잔여 3회 이하" value={num(stats.members.lowPt)} href="/pt?low=1" />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-gray-500">이번 달</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {showSales && (
          <Stat
            label="월 누적매출"
            value={won(stats.month.sales)}
            hint={stats.month.salesDelta === null ? undefined : `전월 동기간 ${stats.month.salesDelta >= 0 ? "+" : ""}${Math.round(stats.month.salesDelta * 100)}%`}
            tone={stats.month.salesDelta === null ? "default" : stats.month.salesDelta >= 0 ? "good" : "bad"}
            href="/payments"
          />
        )}
        <Stat label="신규회원" value={num(stats.month.newMembers)} />
        <Stat label="재등록회원" value={num(stats.month.renewals)} />
        <Stat label="재등록률" value={stats.month.renewalRate === null ? "-" : pct(stats.month.renewalRate * 100, 100)} hint={`만료 대상 ${stats.month.renewalTotal}명 기준`} />
        <Stat label="만료회원" value={num(stats.month.expired)} />
        <Stat label="미재등록회원" value={num(stats.month.notRenewed)} tone={stats.month.notRenewed ? "bad" : "default"} href="/renewals?status=NOT_RENEWED" />
      </div>

      <Card title="7일 이내 만료 · 미확인 회원" actions={<Link href="/renewals" className="text-sm text-gray-500 underline">재등록 관리 →</Link>}>
        {soon.length === 0 ? (
          <p className="text-sm text-gray-400">7일 이내 만료 예정인 미확인 회원이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {soon.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <div>
                  <Link href={`/members/${r.memberId}`} className="font-medium hover:underline">{r.memberName}</Link>
                  <span className="ml-2 text-gray-500">{r.productName} · {ymd(r.endDate)} 만료 (D-{r.daysLeft})</span>
                </div>
                <Badge value={r.status} label={RENEWAL_STATUS[r.status]} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
