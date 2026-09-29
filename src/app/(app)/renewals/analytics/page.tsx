import { requireCenterSession } from "@/lib/auth";
import { renewalAnalytics } from "@/lib/services/renewals";
import { Bar, Card, LinkButton, PageHeader, Stat } from "@/components/ui";
import { RENEWAL_REASON, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RenewalAnalyticsPage() {
  const s = await requireCenterSession();
  const a = await renewalAnalytics(s.centerId);
  const t = a.thisMonth;
  const maxReason = t.reasons[0]?.count ?? 1;

  return (
    <div>
      <PageHeader title="미재등록 분석" subtitle="이번 달 만료 회원 기준. 사유는 회원 설문 응답 + 직원 기록을 합산합니다." actions={<LinkButton href="/renewals" variant="secondary">← 재등록 관리</LinkButton>} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="이번 달 만료 대상" value={num(t.total)} />
        <Stat label="재등록 완료" value={num(t.renewed)} tone="good" />
        <Stat label="미재등록" value={num(t.notRenewed)} tone={t.notRenewed ? "bad" : "default"} />
        <Stat label="재등록률" value={`${Math.round(t.renewalRate * 100)}%`} hint={`전월 ${Math.round(a.prevMonth.renewalRate * 100)}%`} />
        <Stat label="사유 응답률 (KPI 1)" value={`${Math.round(t.responseRate * 100)}%`} hint="목표 15% 이상" tone={t.responseRate >= 0.15 ? "good" : "warn"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`이번 달 미재등록 사유 (${t.notRenewed}명 중 ${t.answered}명 응답)`}>
          {t.reasons.length === 0 ? <p className="text-sm text-gray-400">아직 수집된 사유가 없습니다.</p> : (
            <div className="space-y-3">
              {t.reasons.map((r) => (
                <div key={r.reason}>
                  <div className="mb-0.5 flex justify-between text-sm"><span>{RENEWAL_REASON[r.reason] ?? r.reason}</span><span className="tabular-nums text-gray-500">{r.count}명 / {Math.round(r.ratio * 100)}%</span></div>
                  <Bar value={r.count} max={maxReason} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="전월 대비 변화">
          {a.changes.length === 0 ? <p className="text-sm text-gray-400">비교할 데이터가 없습니다.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">사유</th><th className="py-1 text-right">지난달</th><th className="py-1 text-right">이번달</th><th className="py-1 text-right">변화</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {a.changes.map((c) => (
                  <tr key={c.reason}>
                    <td className="py-1.5">{RENEWAL_REASON[c.reason] ?? c.reason}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500">{Math.round(c.prev * 100)}%</td>
                    <td className="py-1.5 text-right tabular-nums">{Math.round(c.cur * 100)}%</td>
                    <td className={`py-1.5 text-right font-semibold tabular-nums ${c.deltaPt > 0 ? "text-red-600" : c.deltaPt < 0 ? "text-emerald-600" : "text-gray-400"}`}>{c.deltaPt > 0 ? "+" : ""}{c.deltaPt}%p</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="고객 건의사항" className="lg:col-span-2">
          {t.feedbacks.length === 0 ? <p className="text-sm text-gray-400">이번 달 수집된 건의사항이 없습니다.</p> : (
            <ul className="space-y-2">
              {t.feedbacks.map((f, i) => (
                <li key={i} className="rounded-lg bg-gray-50 p-3 text-sm"><span className="mr-2 font-medium text-gray-700">{f.name}</span><span className="text-gray-600">{f.feedback}</span></li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-gray-400">AI PRO(MVP 3)에서는 이 건의사항들을 AI가 주제별로 요약해 관장 리포트에 포함합니다.</p>
        </Card>
      </div>
    </div>
  );
}
