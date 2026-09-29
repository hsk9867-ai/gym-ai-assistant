import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildReport, type ReportType } from "@/lib/services/reports";
import { messagingMode } from "@/lib/services/messaging";
import { sendReportNowAction } from "@/app/actions/reports";
import { Alert, Badge, Card, PageHeader, Table, btnCls } from "@/components/ui";
import { ymd, ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

const TYPES: { key: ReportType; label: string; when: string }[] = [
  { key: "DAILY", label: "일일 보고", when: "매일 지정 시각" },
  { key: "WEEKLY", label: "주간 보고", when: "매주 토요일" },
  { key: "MONTHLY", label: "월간 보고", when: "매월 말일" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const s = await requireCenterSession();
  const sp = await searchParams;
  const type = (TYPES.some((t) => t.key === sp.type) ? sp.type : "DAILY") as ReportType;
  const [center, report, history] = await Promise.all([
    prisma.center.findUniqueOrThrow({ where: { id: s.centerId } }),
    buildReport(s.centerId, type),
    prisma.report.findMany({ where: { centerId: s.centerId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const eligible = center.plan === "SMART" || center.plan === "AI_PRO";
  const phone = center.reportPhone ?? center.phone;
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="관장 리포트"
        subtitle={`매일 ${String(center.reportHour).padStart(2, "0")}:00 카카오톡으로 자동 발송 · 수신 ${phone ?? "번호 미설정"} · ${messagingMode() === "LIVE" ? "실제 발송" : "시뮬레이션 모드"}`}
        actions={<Link href="/settings" className="text-sm text-gray-500 underline">발송 시각·수신번호 설정</Link>}
      />
      {!eligible && <div className="mb-4"><Alert kind="info">자동 리포트는 SMART 이상 요금제에서 발송됩니다. 현재 {center.plan} 요금제라 미리보기만 가능합니다.</Alert></div>}

      <div className="mb-4 flex gap-2">
        {TYPES.map((t) => (
          <Link key={t.key} href={`/reports?type=${t.key}`} className={`rounded-full px-3 py-1 text-sm ${type === t.key ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>{t.label} <span className="opacity-60">· {t.when}</span></Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* 카카오톡 미리보기 */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl bg-[#9bbbd4] p-4 shadow-inner">
            <div className="mb-3 text-center text-xs text-white/90">{ymd(now)}</div>
            <div className="flex items-start gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-[10px] font-bold text-white">AI</div>
              <div>
                <div className="mb-1 text-xs text-gray-700">AI 경영비서</div>
                <div className="max-w-[300px] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[13px] leading-6 text-gray-900 shadow">
                  <pre className="whitespace-pre-wrap font-sans">{report.text}</pre>
                  <a href="/dashboard" className="mt-3 block rounded-lg bg-gray-100 py-2 text-center text-xs font-medium text-gray-700">대시보드에서 자세히 보기</a>
                </div>
                <div className="mt-1 text-[10px] text-gray-600">{String(center.reportHour).padStart(2, "0")}:00</div>
              </div>
            </div>
          </div>
          <form action={sendReportNowAction} className="mt-3 flex items-center gap-3">
            <input type="hidden" name="type" value={type} />
            <button className={btnCls}>지금 이 리포트 발송 {messagingMode() === "LIVE" ? "" : "(테스트 기록)"}</button>
            <span className="text-xs text-gray-400">발송 기록은 메시지 화면과 아래 이력에 남습니다.</span>
          </form>
        </div>

        {/* 구조화된 보기 */}
        <div className="space-y-4 lg:col-span-3">
          {report.sections.map((sec) => (
            <Card key={sec.heading} title={sec.heading}>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {sec.rows.map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between border-b border-gray-100 pb-1 text-sm">
                    <dt className="text-gray-500">{r.label}</dt>
                    <dd className="text-right font-medium tabular-nums">{r.value}{r.note && <span className="ml-1 text-xs font-normal text-gray-400">{r.note}</span>}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
          <Card title="내일 챙길 일">
            {report.actions.length === 0 ? <p className="text-sm text-gray-400">특별히 챙길 항목이 없습니다.</p> : (
              <ul className="space-y-1 text-sm">{report.actions.map((a) => <li key={a}>• {a}</li>)}</ul>
            )}
          </Card>
          {center.plan === "AI_PRO" && <Alert kind="info">AI PRO: MVP 3에서는 이 수치를 AI가 해석한 한 줄 요약("매출 감소의 주 원인은 신규회원 감소입니다" 등)이 리포트 상단에 덧붙습니다.</Alert>}
        </div>
      </div>

      <Card className="mt-6" title="발송 이력">
        <Table head={["발송일시", "종류", "기간", "상태"]} empty={history.length === 0}>
          {history.map((h) => (
            <tr key={h.id}>
              <td className="px-3 py-2 tabular-nums">{ymdhm(h.sentAt ?? h.createdAt)}</td>
              <td className="px-3 py-2">{TYPES.find((t) => t.key === h.type)?.label ?? h.type}</td>
              <td className="px-3 py-2 tabular-nums">{ymd(h.periodStart)} ~ {ymd(h.periodEnd)}</td>
              <td className="px-3 py-2"><Badge value={h.status === "SENT" ? "SIGNED" : "FAILED"} label={h.status === "SENT" ? "발송" : "실패"} /></td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-xs text-gray-400">자동 발송은 <code>/api/cron/reports</code>를 매시간 호출하는 스케줄러(Windows 작업 스케줄러, cron, Vercel Cron)로 동작합니다. 센터별 발송 시각·토요일·말일 조건을 서버가 판단합니다.</p>
      </Card>
    </div>
  );
}
