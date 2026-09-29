import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { getMemberDetail } from "@/lib/services/members";
import { undoPtSessionAction, usePtSessionAction } from "@/app/actions/members";
import { updateRenewalAction } from "@/app/actions/renewals";
import { Badge, Card, LinkButton, PageHeader, Table, btnSecondaryCls, inputCls } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CONTRACT_STATUS, MEMBER_STATUS, MESSAGE_STATUS, PAYMENT_METHOD, PAYMENT_TYPE, RENEWAL_REASON, RENEWAL_STATUS, won, ymd, ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireCenterSession();
  const { id } = await params;
  const m = await getMemberDetail(s.centerId, id);
  if (!m) notFound();
  const showSales = s.canViewSales || s.role !== "STAFF";
  const activeMs = m.memberships.find((x) => x.status === "ACTIVE");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return (
    <div>
      <PageHeader
        title={m.name}
        subtitle={`${m.phone} · 가입 ${ymd(m.joinedAt)} · 담당 ${m.staff?.name ?? "미지정"}`}
        actions={
          <>
            <LinkButton href={`/members/${id}/membership`}>+ 회원권 등록</LinkButton>
            <LinkButton href={`/members/${id}/pt`} variant="secondary">+ PT 등록</LinkButton>
            <LinkButton href={`/members/${id}/contract`} variant="secondary">+ 계약서</LinkButton>
            <LinkButton href={`/members/${id}/edit`} variant="secondary">정보 수정</LinkButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card title="상태"><Badge value={m.status} label={MEMBER_STATUS[m.status]} /><p className="mt-2 text-xs text-gray-500">{m.gender === "M" ? "남" : m.gender === "F" ? "여" : "성별 미입력"}</p></Card>
        <Card title="현재 회원권">
          {activeMs ? <><div className="font-medium">{activeMs.productName}</div><div className="text-sm text-gray-500">{ymd(activeMs.startDate)} ~ {ymd(activeMs.endDate)}</div></> : <span className="text-sm text-gray-400">유효한 회원권 없음</span>}
        </Card>
        <Card title="출석">
          <div className="text-sm">최근 방문 <b>{ymd(m.lastVisitAt)}</b></div>
          <div className="text-sm">이번 달 <b>{m.monthVisits}회</b></div>
        </Card>
        <Card title="수신 동의">
          <div className="text-xs text-gray-600">알림톡 {m.alimtalkConsent ? "O" : "X"} · SMS광고 {m.smsAdConsent ? "O" : "X"} · 카카오광고 {m.kakaoAdConsent ? "O" : "X"}</div>
          <div className="mt-1 text-xs text-gray-400">동의 {ymd(m.consentAt)} / 철회 {ymd(m.consentRevokedAt)}</div>
        </Card>
      </div>

      {m.memo && <Card className="mb-6" title="메모"><p className="whitespace-pre-wrap text-sm text-gray-700">{m.memo}</p></Card>}

      <div className="space-y-6">
        <Card title="회원권">
          <Table head={["상품", "시작일", "종료일", "금액", "구분", "상태", "재등록"]} empty={m.memberships.length === 0}>
            {m.memberships.map((ms) => (
              <tr key={ms.id}>
                <td className="px-3 py-2 font-medium">{ms.productName}</td>
                <td className="px-3 py-2 tabular-nums">{ymd(ms.startDate)}</td>
                <td className="px-3 py-2 tabular-nums">{ymd(ms.endDate)}</td>
                <td className="px-3 py-2 tabular-nums">{showSales ? won(ms.amount) : "-"}</td>
                <td className="px-3 py-2">{ms.isRenewal ? "재등록" : "신규"}</td>
                <td className="px-3 py-2"><Badge value={ms.status} label={{ ACTIVE: "이용중", EXPIRED: "만료", PAUSED: "휴회", CANCELLED: "취소" }[ms.status]} /></td>
                <td className="px-3 py-2">{ms.renewal ? <Badge value={ms.renewal.status} label={RENEWAL_STATUS[ms.renewal.status]} /> : "-"}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title="PT">
          <Table head={["상품", "총 횟수", "사용", "잔여", "담당 트레이너", "만료일", ""]} empty={m.ptPackages.length === 0}>
            {m.ptPackages.map((p) => {
              const remain = p.totalCount - p.usedCount;
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-medium">{p.productName}</td>
                  <td className="px-3 py-2 tabular-nums">{p.totalCount}</td>
                  <td className="px-3 py-2 tabular-nums">{p.usedCount}</td>
                  <td className={`px-3 py-2 font-semibold tabular-nums ${remain <= 3 ? "text-amber-600" : ""}`}>{remain}회</td>
                  <td className="px-3 py-2">{p.trainer?.name ?? "미지정"}</td>
                  <td className="px-3 py-2 tabular-nums">{ymd(p.expireDate)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {remain > 0 && (
                        <form action={usePtSessionAction}>
                          <input type="hidden" name="ptPackageId" value={p.id} />
                          <ConfirmButton message={`${m.name}님의 수업 1회를 차감하시겠습니까?\n\n차감 후 잔여 ${remain - 1}회가 되며, 회원에게 남은 횟수와 응원 메시지가 카카오톡으로 자동 발송됩니다.`}>1회 사용</ConfirmButton>
                        </form>
                      )}
                      {p.usedCount > 0 && (
                        <form action={undoPtSessionAction}>
                          <input type="hidden" name="ptPackageId" value={p.id} />
                          <button className={btnSecondaryCls} title="최근 사용 1회를 되돌립니다">복원</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>

        <Card title="재등록 관리">
          {m.renewals.length === 0 ? <p className="text-sm text-gray-400">만료 예정/만료된 회원권이 생기면 자동으로 재등록 관리 항목이 생성됩니다.</p> : (
            <div className="space-y-3">
              {m.renewals.map((r) => (
                <form key={r.id} action={updateRenewalAction} className="grid gap-2 rounded-lg border border-gray-200 p-3 md:grid-cols-5">
                  <input type="hidden" name="renewalId" value={r.id} />
                  <div className="text-sm md:col-span-5"><b>{r.membership.productName}</b> · {ymd(r.membership.endDate)} 만료 · 현재 <Badge value={r.status} label={RENEWAL_STATUS[r.status]} />{r.answeredBy === "MEMBER" && <span className="ml-2 text-xs text-blue-600">회원 직접 응답</span>}</div>
                  <select name="status" defaultValue={r.status} className={inputCls}>
                    {Object.entries(RENEWAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select name="reason" defaultValue={r.reason ?? ""} className={inputCls}>
                    <option value="">미재등록 사유</option>
                    {Object.entries(RENEWAL_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input name="feedback" defaultValue={r.feedback ?? ""} placeholder="건의사항 / 메모" className={`${inputCls} md:col-span-2`} />
                  <button className={btnSecondaryCls}>저장</button>
                </form>
              ))}
              {m.surveyToken && (
                <p className="text-xs text-gray-500">회원용 설문 링크 (카카오/문자로 전달): <code className="rounded bg-gray-100 px-1">{appUrl}/survey/{m.surveyToken}</code></p>
              )}
            </div>
          )}
        </Card>

        <Card title="전자계약">
          <Table head={["상품", "유형", "금액", "상태", "서명일", "해시"]} empty={m.contracts.length === 0}>
            {m.contracts.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium"><Link href={`/contracts/${c.id}`} className="hover:underline">{c.productName}</Link></td>
                <td className="px-3 py-2">{c.contractType}</td>
                <td className="px-3 py-2 tabular-nums">{showSales ? won(c.amount) : "-"}</td>
                <td className="px-3 py-2"><Badge value={c.status} label={CONTRACT_STATUS[c.status]} /></td>
                <td className="px-3 py-2 tabular-nums">{ymdhm(c.signedAt)}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-400">{c.documentHash?.slice(0, 12) ?? "-"}</td>
              </tr>
            ))}
          </Table>
        </Card>

        {showSales && (
          <Card title="결제 내역">
            <Table head={["일시", "상품", "금액", "구분", "결제수단", "담당"]} empty={m.payments.length === 0}>
              {m.payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 tabular-nums">{ymdhm(p.paidAt)}</td>
                  <td className="px-3 py-2">{p.productName}</td>
                  <td className="px-3 py-2 tabular-nums">{won(p.amount)}</td>
                  <td className="px-3 py-2">{PAYMENT_TYPE[p.type]}</td>
                  <td className="px-3 py-2">{PAYMENT_METHOD[p.method]}</td>
                  <td className="px-3 py-2">{p.salesperson?.name ?? "-"}</td>
                </tr>
              ))}
            </Table>
          </Card>
        )}

        <Card title="메시지 발송 기록">
          {m.messages.length === 0 ? <p className="text-sm text-gray-400">발송된 메시지가 없습니다.</p> : (
            <ul className="divide-y divide-gray-100">
              {m.messages.map((msg) => (
                <li key={msg.id} className="py-2 text-sm">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="tabular-nums">{ymdhm(msg.createdAt)}</span>
                    <span>{msg.channel === "KAKAO" ? "카카오" : "SMS"}</span>
                    <span>{msg.type === "AD" ? "광고" : "정보"}</span>
                    <Badge value={msg.status} label={MESSAGE_STATUS[msg.status]} />
                    {msg.error && <span className="text-red-500">{msg.error}</span>}
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-gray-700">{msg.content}</pre>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="출석 히스토리 (최근 30건)">
          {m.attendances.length === 0 ? <p className="text-sm text-gray-400">출석 기록이 없습니다.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {m.attendances.map((a) => <span key={a.id} className="rounded bg-gray-100 px-2 py-0.5 text-xs tabular-nums">{ymdhm(a.checkedAt)}</span>)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
