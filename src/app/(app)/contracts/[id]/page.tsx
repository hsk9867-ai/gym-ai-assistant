import { notFound } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelContractAction, markContractSentAction, signContractOnSiteAction } from "@/app/actions/contracts";
import { SignaturePad } from "@/components/SignaturePad";
import { Badge, Card, LinkButton, PageHeader, btnCls, btnSecondaryCls } from "@/components/ui";
import { CONTRACT_STATUS, ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireCenterSession();
  const { id } = await params;
  const c = await prisma.contract.findFirst({ where: { id, centerId: s.centerId }, include: { member: true } });
  if (!c) notFound();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const remoteUrl = `${appUrl}/sign/${c.signToken}`;

  return (
    <div className="max-w-4xl">
      <div className="no-print">
        <PageHeader
          title={`계약서 · ${c.member.name}`}
          subtitle={`${c.productName}`}
          actions={<><LinkButton href={`/members/${c.memberId}`} variant="secondary">← 회원 상세</LinkButton><LinkButton href="/contracts" variant="secondary">목록</LinkButton></>}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2" title="계약 본문">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-gray-800">{c.content}</pre>
          {c.status === "SIGNED" && c.signatureImage && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <div className="mb-1 text-xs text-gray-500">회원 서명</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.signatureImage} alt="서명" className="h-24 rounded border border-gray-200 bg-white" />
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                <dt>서명 시각</dt><dd>{ymdhm(c.signedAt)}</dd>
                <dt>IP</dt><dd>{c.signedIp}</dd>
                <dt>사용자 환경</dt><dd className="truncate">{c.signedUserAgent}</dd>
                <dt>문서 해시(SHA-256)</dt><dd className="break-all font-mono">{c.documentHash}</dd>
                <dt>계약 버전</dt><dd>{c.termsVersion}</dd>
              </dl>
            </div>
          )}
        </Card>

        <div className="space-y-4 no-print">
          <Card title="상태">
            <Badge value={c.status} label={CONTRACT_STATUS[c.status]} />
            {c.status === "SIGNED" && (
              <p className="mt-3 text-xs text-gray-500">브라우저 인쇄(Ctrl+P)로 PDF 저장이 가능합니다. 서버측 PDF 자동생성은 다음 단계에서 추가됩니다.</p>
            )}
          </Card>

          {c.status !== "SIGNED" && c.status !== "CANCELLED" && (
            <>
              <Card title="현장 서명">
                <form action={signContractOnSiteAction} className="space-y-3">
                  <input type="hidden" name="contractId" value={c.id} />
                  <p className="text-xs text-gray-500">회원에게 태블릿/PC를 보여주고 계약 내용을 확인시킨 뒤 서명받으세요.</p>
                  <SignaturePad />
                  <button className={`${btnCls} w-full`}>서명 완료 처리</button>
                </form>
              </Card>
              <Card title="원격 서명">
                <p className="mb-2 text-xs text-gray-500">아래 링크를 문자/카카오로 전달하면 회원이 휴대폰 뒷 4자리 확인 후 직접 서명합니다.</p>
                <code className="block break-all rounded bg-gray-100 p-2 text-xs">{remoteUrl}</code>
                <div className="mt-3 flex gap-2">
                  {c.status === "DRAFT" && (
                    <form action={markContractSentAction}><input type="hidden" name="contractId" value={c.id} /><button className={btnSecondaryCls}>발송함으로 표시</button></form>
                  )}
                  <form action={cancelContractAction}><input type="hidden" name="contractId" value={c.id} /><button className={btnSecondaryCls}>계약 취소</button></form>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
