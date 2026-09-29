import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshMemberStatuses } from "@/lib/services/members";
import { ensureRenewals, listRenewals } from "@/lib/services/renewals";
import { buildInsights, dailySeries, dashboardStats } from "@/lib/services/stats";
import { DashboardBriefing } from "@/components/DashboardBriefing";
import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import { num, pct, won, ymd, RENEWAL_STATUS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await requireCenterSession();
  await refreshMemberStatuses(s.centerId);
  await ensureRenewals(s.centerId);
  const [stats, center, upcoming, daily, pendingContracts] = await Promise.all([
    dashboardStats(s.centerId),
    prisma.center.findUnique({ where: { id: s.centerId }, select: { plan: true, name: true } }),
    listRenewals(s.centerId, { status: "UNCONFIRMED" }),
    dailySeries(s.centerId, 7),
    prisma.contract.count({ where: { centerId: s.centerId, status: { in: ["DRAFT", "SENT"] } } }),
  ]);
  const showSales = s.canViewSales || s.role !== "STAFF";
  const insights = buildInsights(stats, { pendingContracts, weekVisitsDelta: daily.weekVisitsDelta }).filter((i) => showSales || i.href !== "/payments");
  const soon = upcoming.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7).slice(0, 8);

  const kpis = [
    ...(showSales ? [{ label: "오늘 매출", value: stats.today.sales, unit: "원", sub: `PT ${won(stats.today.ptSales)}` }] : []),
    { label: "오늘 방문", value: stats.today.visits, unit: "명", sub: `활성회원 ${num(stats.members.active)}명` },
    { label: "오늘 신규 · 재등록", value: stats.today.newMembers + stats.today.renewals, unit: "명", sub: `신규 ${stats.today.newMembers} · 재등록 ${stats.today.renewals}` },
    ...(showSales
      ? [{ label: "이번 달 매출", value: stats.month.sales, unit: "원", delta: stats.month.salesDelta, sub: "전월 동기간 대비" }]
      : [{ label: "이번 달 재등록률", value: stats.month.renewalRate === null ? 0 : Math.round(stats.month.renewalRate * 100), unit: "%", sub: `만료 대상 ${stats.month.renewalTotal}명` }]),
  ];
  const actions = [
    { label: "7일 내 만료", count: stats.members.expiring7, href: "/renewals?bucket=7", tone: "warn" as const },
    { label: "미재등록 확인", count: stats.month.notRenewed, href: "/renewals?status=NOT_RENEWED", tone: "bad" as const },
    { label: "장기 미방문", count: stats.members.dormant, href: "/members?status=DORMANT", tone: "warn" as const },
    { label: "PT 3회 이하", count: stats.members.lowPt, href: "/pt?low=1", tone: "info" as const },
    { label: "서명 대기 계약", count: pendingContracts, href: "/contracts?status=SENT", tone: "info" as const },
  ];

  return (
    <div>
      <PageHeader title="대시보드" subtitle={`${center?.name} · ${ymd(new Date())}`} />

      <DashboardBriefing
        centerName={center?.name ?? ""}
        plan={center?.plan ?? "BASIC"}
        userName={s.name}
        insights={insights}
        kpis={kpis}
        series={showSales ? daily.series : daily.series.map((p) => ({ ...p, sales: 0 }))}
        actions={actions}
        showSales={showSales}
      />

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
