import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { salesStats } from "@/lib/services/stats";
import { PaymentForm } from "@/components/forms/PaymentForm";
import { Bar, Card, PageHeader, Stat, Table } from "@/components/ui";
import { PAYMENT_METHOD, PAYMENT_TYPE, endOfMonth, num, startOfMonth, won, ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await requireCenterSession();
  if (s.role === "STAFF" && !s.canViewSales) redirect("/dashboard?error=forbidden");
  const sp = await searchParams;
  const month = sp.month ? new Date(`${sp.month}-01`) : new Date();
  const label = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const [stats, payments] = await Promise.all([
    salesStats(s.centerId, month),
    prisma.payment.findMany({
      where: { centerId: s.centerId, paidAt: { gte: startOfMonth(month), lte: endOfMonth(month) } },
      include: { member: { select: { id: true, name: true } }, salesperson: { select: { name: true } } },
      orderBy: { paidAt: "desc" },
    }),
  ]);
  const maxDay = Math.max(...stats.daily.map((d) => d.amount), 1);
  const typeOf = (t: string) => stats.byType.find((x) => x.type === t)?.amount ?? 0;

  return (
    <div>
      <PageHeader
        title="매출관리"
        subtitle={`${label} 기준`}
        actions={<div className="flex items-center gap-2 text-sm"><Link href={`/payments?month=${fmt(prev)}`} className="rounded border px-2 py-1">◀ 전월</Link><span className="font-medium">{label}</span><Link href={`/payments?month=${fmt(next)}`} className="rounded border px-2 py-1">익월 ▶</Link></div>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="월 매출" value={won(stats.total)} hint={`${num(stats.count)}건`} />
        <Stat label="회원권(신규)" value={won(typeOf("NEW"))} />
        <Stat label="회원권(재등록)" value={won(typeOf("RENEWAL"))} />
        <Stat label="PT 매출" value={won(typeOf("PT"))} />
        <Stat label="기타" value={won(typeOf("ETC"))} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="일 매출" className="lg:col-span-2">
          <div className="flex h-40 items-end gap-[2px]">
            {stats.daily.map((d) => (
              <div key={d.day} className="group relative flex-1">
                <div className="w-full rounded-t bg-gray-800 transition group-hover:bg-gray-600" style={{ height: `${Math.max(2, (d.amount / maxDay) * 150)}px` }} title={`${d.day}일 ${won(d.amount)}`} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-400"><span>1일</span><span>{stats.daily.length}일</span></div>
        </Card>
        <Card title="직원별 매출">
          <div className="space-y-2">
            {stats.byStaff.length === 0 && <p className="text-sm text-gray-400">데이터 없음</p>}
            {stats.byStaff.map((r) => (
              <div key={r.staff}><div className="mb-0.5 text-xs text-gray-600">{r.staff}</div><Bar value={r.amount} max={stats.byStaff[0].amount} label={won(r.amount)} /></div>
            ))}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            {stats.weekly.map((w) => <div key={w.week} className="flex justify-between"><span>{w.week}주차</span><span className="tabular-nums">{won(w.amount)}</span></div>)}
            <div className="mt-2 border-t border-gray-100 pt-2">{stats.byMethod.map((m) => <div key={m.method} className="flex justify-between"><span>{PAYMENT_METHOD[m.method]}</span><span className="tabular-nums">{won(m.amount)}</span></div>)}</div>
          </div>
        </Card>
      </div>

      <Card className="mb-6" title="기타 매출 등록"><PaymentForm /></Card>

      <Card title="결제 내역">
        <Table head={["일시", "회원", "항목", "금액", "구분", "결제수단", "담당"]} empty={payments.length === 0}>
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2 tabular-nums">{ymdhm(p.paidAt)}</td>
              <td className="px-3 py-2">{p.member ? <Link href={`/members/${p.member.id}`} className="font-medium hover:underline">{p.member.name}</Link> : "-"}</td>
              <td className="px-3 py-2">{p.productName}</td>
              <td className="px-3 py-2 tabular-nums">{won(p.amount)}</td>
              <td className="px-3 py-2">{PAYMENT_TYPE[p.type]}</td>
              <td className="px-3 py-2">{PAYMENT_METHOD[p.method]}</td>
              <td className="px-3 py-2">{p.salesperson?.name ?? "-"}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
