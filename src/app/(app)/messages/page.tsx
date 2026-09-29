import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { messagingMode } from "@/lib/services/messaging";
import { Alert, Badge, PageHeader, Stat, Table } from "@/components/ui";
import { MESSAGE_STATUS, num, startOfMonth, ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

const TEMPLATE_LABEL: Record<string, string> = {
  PT_REMAIN: "PT 잔여횟수",
  MEMBERSHIP_EXPIRE: "회원권 만료",
  CONTRACT_DONE: "계약완료",
  RENEWAL_SURVEY: "재등록 설문",
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  const s = await requireCenterSession();
  const sp = await searchParams;
  const [messages, monthCount, monthSent] = await Promise.all([
    prisma.message.findMany({
      where: { centerId: s.centerId, ...(sp.status ? { status: sp.status } : {}), ...(sp.type ? { type: sp.type } : {}) },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.message.count({ where: { centerId: s.centerId, createdAt: { gte: startOfMonth() } } }),
    prisma.message.count({ where: { centerId: s.centerId, createdAt: { gte: startOfMonth() }, status: { in: ["SENT", "SIMULATED"] } } }),
  ]);
  const mode = messagingMode();

  return (
    <div>
      <PageHeader title="메시지" subtitle="정보성(알림톡)과 광고성 메시지를 분리해 기록합니다. 광고성은 동의한 회원에게만 발송됩니다." />
      {mode === "SIMULATED" && (
        <div className="mb-4">
          <Alert kind="info">
            현재 <b>시뮬레이션 모드</b>입니다. 발송 내용은 기록되지만 실제로 전송되지 않습니다. 실제 발송하려면 <code>.env</code>에 SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER, KAKAO_PF_ID와 승인된 템플릿 ID(KAKAO_TEMPLATE_PT_REMAIN)를 설정하세요.
          </Alert>
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 md:w-1/2">
        <Stat label="이번 달 발송 시도" value={num(monthCount)} />
        <Stat label="이번 달 발송 성공" value={num(monthSent)} hint={mode === "SIMULATED" ? "시뮬레이션 포함" : undefined} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/messages" className={`rounded-full px-3 py-1 ${!sp.status && !sp.type ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>전체</Link>
        <Link href="/messages?type=INFO" className={`rounded-full px-3 py-1 ${sp.type === "INFO" ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>정보성</Link>
        <Link href="/messages?type=AD" className={`rounded-full px-3 py-1 ${sp.type === "AD" ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>광고성</Link>
        {Object.entries(MESSAGE_STATUS).map(([k, v]) => (
          <Link key={k} href={`/messages?status=${k}`} className={`rounded-full px-3 py-1 ${sp.status === k ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>{v}</Link>
        ))}
      </div>
      <Table head={["일시", "회원", "종류", "채널", "템플릿", "상태", "내용"]} empty={messages.length === 0}>
        {messages.map((m) => (
          <tr key={m.id} className="align-top">
            <td className="px-3 py-2 tabular-nums">{ymdhm(m.createdAt)}</td>
            <td className="px-3 py-2 font-medium">{m.member ? <Link href={`/members/${m.member.id}`} className="hover:underline">{m.member.name}</Link> : "-"}</td>
            <td className="px-3 py-2">{m.type === "AD" ? "광고" : "정보"}</td>
            <td className="px-3 py-2">{m.channel === "KAKAO" ? "카카오" : "SMS"}</td>
            <td className="px-3 py-2">{TEMPLATE_LABEL[m.template] ?? m.template}</td>
            <td className="px-3 py-2"><Badge value={m.status} label={MESSAGE_STATUS[m.status]} />{m.error && <div className="mt-1 text-xs text-red-500">{m.error}</div>}</td>
            <td className="max-w-md px-3 py-2"><pre className="whitespace-pre-wrap font-sans text-xs text-gray-600">{m.content}</pre></td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
