import { redirect } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { monthlyTrend } from "@/lib/services/stats";
import { Bar, Card, PageHeader, Stat } from "@/components/ui";
import { MEMBER_STATUS, num, won } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const s = await requireCenterSession();
  if (s.role === "STAFF" && !s.canViewSales) redirect("/dashboard?error=forbidden");
  const [trend, statusCounts, products, imports] = await Promise.all([
    monthlyTrend(s.centerId, 6),
    prisma.member.groupBy({ by: ["status"], where: { centerId: s.centerId }, _count: true }),
    prisma.membership.groupBy({ by: ["productName"], where: { centerId: s.centerId }, _count: true, _sum: { amount: true }, orderBy: { _count: { productName: "desc" } }, take: 8 }),
    prisma.importJob.findMany({ where: { centerId: s.centerId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const maxSales = Math.max(...trend.map((t) => t.sales), 1);
  const totalMembers = statusCounts.reduce((a, b) => a + b._count, 0);

  return (
    <div>
      <PageHeader title="통계" subtitle="정확히 계산된 수치가 AI 분석(MVP 3)의 입력이 됩니다. AI는 계산하지 않고 해석만 합니다." />

      <Card className="mb-6" title="최근 6개월 추이">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">월</th><th className="py-1">매출</th><th className="py-1 text-right">신규회원</th><th className="py-1 text-right">재등록</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {trend.map((t) => (
              <tr key={t.label}>
                <td className="py-2 font-medium tabular-nums">{t.label}</td>
                <td className="py-2 pr-4"><Bar value={t.sales} max={maxSales} label={won(t.sales)} /></td>
                <td className="py-2 text-right tabular-nums">{num(t.newMembers)}</td>
                <td className="py-2 text-right tabular-nums">{num(t.renewals)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="회원 상태 분포">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(MEMBER_STATUS).map(([k, v]) => (
              <Stat key={k} label={v} value={num(statusCounts.find((x) => x.status === k)?._count ?? 0)} />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">전체 {num(totalMembers)}명</p>
        </Card>
        <Card title="상품별 판매">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">상품</th><th className="py-1 text-right">건수</th><th className="py-1 text-right">매출</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.productName}><td className="py-1.5">{p.productName}</td><td className="py-1.5 text-right tabular-nums">{num(p._count)}</td><td className="py-1.5 text-right tabular-nums">{won(p._sum.amount)}</td></tr>
              ))}
              {products.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-gray-400">데이터 없음</td></tr>}
            </tbody>
          </table>
        </Card>
        {imports.length > 0 && (
          <Card title="최근 Import 이력" className="lg:col-span-2">
            <ul className="text-sm text-gray-600">
              {imports.map((j) => <li key={j.id} className="py-1">{j.fileName} · {j.totalRows}행 → 신규 {j.insertedRows} / 갱신 {j.updatedRows} / 건너뜀 {j.skippedRows} / 오류 {j.errorRows}</li>)}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
