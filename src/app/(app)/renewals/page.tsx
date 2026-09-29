import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { refreshMemberStatuses } from "@/lib/services/members";
import { EXPIRY_BUCKETS, ensureRenewals, listRenewals } from "@/lib/services/renewals";
import { updateRenewalAction } from "@/app/actions/renewals";
import { Badge, LinkButton, PageHeader, Table, btnSecondaryCls, inputCls } from "@/components/ui";
import { RENEWAL_REASON, RENEWAL_STATUS, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RenewalsPage({ searchParams }: { searchParams: Promise<{ bucket?: string; status?: string }> }) {
  const s = await requireCenterSession();
  const sp = await searchParams;
  await refreshMemberStatuses(s.centerId);
  await ensureRenewals(s.centerId);
  const all = await listRenewals(s.centerId, {});
  const rows = await listRenewals(s.centerId, { bucket: sp.bucket, status: sp.status });
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const bucketCount = (b: number) => all.filter((r) => r.bucket === b && r.status === "UNCONFIRMED").length;
  const chip = (href: string, label: string, active: boolean) => (
    <Link key={href} href={href} className={`rounded-full px-3 py-1 text-sm ${active ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200 hover:bg-gray-50"}`}>{label}</Link>
  );

  return (
    <div>
      <PageHeader title="재등록 관리" subtitle="만료 예정 회원을 자동 추출하고 재등록 여부·미재등록 사유를 기록합니다." actions={<LinkButton href="/renewals/analytics" variant="secondary">미재등록 분석 →</LinkButton>} />

      <div className="mb-3 flex flex-wrap gap-2">
        {chip("/renewals", "전체", !sp.bucket && !sp.status)}
        {EXPIRY_BUCKETS.map((b) => chip(`/renewals?bucket=${b}`, `${b}일 이내 (미확인 ${bucketCount(b)})`, sp.bucket === String(b)))}
        {chip("/renewals?bucket=expired", "이미 만료", sp.bucket === "expired")}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(RENEWAL_STATUS).map(([k, v]) => chip(`/renewals?status=${k}`, `${v} (${all.filter((r) => r.status === k).length})`, sp.status === k))}
      </div>

      <Table head={["회원", "연락처", "회원권", "만료일", "D-day", "상태", "사유 / 건의", "설문링크", ""]} empty={rows.length === 0}>
        {rows.map((r) => (
          <tr key={r.id} className="align-top hover:bg-gray-50">
            <td className="px-3 py-2 font-medium"><Link href={`/members/${r.memberId}`} className="hover:underline">{r.memberName}</Link></td>
            <td className="px-3 py-2 text-gray-600">{r.phone}</td>
            <td className="px-3 py-2">{r.productName}</td>
            <td className="px-3 py-2 tabular-nums">{ymd(r.endDate)}</td>
            <td className={`px-3 py-2 font-semibold tabular-nums ${r.daysLeft < 0 ? "text-red-600" : r.daysLeft <= 7 ? "text-amber-600" : ""}`}>{r.daysLeft < 0 ? `+${-r.daysLeft}일 경과` : `D-${r.daysLeft}`}</td>
            <td className="px-3 py-2" colSpan={3}>
              <form action={updateRenewalAction} className="flex flex-wrap items-center gap-1.5">
                <input type="hidden" name="renewalId" value={r.id} />
                <select name="status" defaultValue={r.status} className={`${inputCls} w-32`}>
                  {Object.entries(RENEWAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select name="reason" defaultValue={r.reason ?? ""} className={`${inputCls} w-36`}>
                  <option value="">사유 선택</option>
                  {Object.entries(RENEWAL_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input name="feedback" defaultValue={r.feedback ?? ""} placeholder="건의사항/메모" className={`${inputCls} w-44`} />
                <button className={btnSecondaryCls}>저장</button>
                <Badge value={r.status} label={RENEWAL_STATUS[r.status]} />
                {r.surveyToken && <a href={`${appUrl}/survey/${r.surveyToken}`} target="_blank" className="text-xs text-blue-600 underline" rel="noreferrer">설문링크</a>}
              </form>
            </td>
            <td className="px-3 py-2 text-xs text-gray-400">{r.contactedAt ? `연락 ${ymd(r.contactedAt)}` : ""}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
