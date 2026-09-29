import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiMode, type EventCopy } from "@/lib/services/ai";
import { EventForm } from "@/components/forms/EventForm";
import { Alert, Badge, Card, LinkButton, PageHeader, Table } from "@/components/ui";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { DRAFT: "준비중", PUBLISHED: "진행중", ENDED: "종료" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ upgrade?: string }> }) {
  const s = await requireCenterSession();
  const sp = await searchParams;
  const [center, events] = await Promise.all([
    prisma.center.findUniqueOrThrow({ where: { id: s.centerId } }),
    prisma.event.findMany({ where: { centerId: s.centerId }, orderBy: { createdAt: "desc" } }),
  ]);
  const isPro = center.plan === "AI_PRO";

  return (
    <div>
      <PageHeader title="이벤트 · AI 포스터" subtitle="이벤트 정보를 입력하면 AI가 홍보 문구와 색상을 만들고, 인스타·스토리·A4 포스터를 자동 구성합니다." />
      {!isPro ? (
        <Card className="mb-6">
          {sp.upgrade && <div className="mb-3"><Alert>AI 포스터는 AI PRO 요금제에서 사용할 수 있습니다.</Alert></div>}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-bold">AI PRO 전용 기능입니다</div>
              <p className="mt-1 text-sm text-gray-600">현재 요금제: <b>{center.plan}</b>. AI PRO(월 19,900원)로 변경하면 AI 이벤트 포스터, AI 경영비서, 홈페이지 챗봇을 사용할 수 있습니다.</p>
            </div>
            <LinkButton href="/settings">요금제 변경 →</LinkButton>
          </div>
        </Card>
      ) : (
        <Card className="mb-6" title={`새 이벤트 만들기 (${aiMode() === "LIVE" ? "AI 문구 생성" : "템플릿 문구 · AI 키 미설정"})`}>
          <EventForm aiLive={aiMode() === "LIVE"} />
        </Card>
      )}

      <Card title="이벤트 목록">
        <Table head={["생성일", "이벤트", "대제목", "혜택", "기간", "문구", "상태"]} empty={events.length === 0}>
          {events.map((e) => {
            const c = JSON.parse(e.copyJson) as EventCopy;
            return (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 tabular-nums">{ymd(e.createdAt)}</td>
                <td className="px-3 py-2 font-medium"><Link href={`/events/${e.id}`} className="hover:underline">{e.title}</Link></td>
                <td className="px-3 py-2">{c.headline}</td>
                <td className="px-3 py-2 text-gray-600">{e.discount ?? "-"}</td>
                <td className="px-3 py-2 tabular-nums">{e.startDate ? `${ymd(e.startDate)} ~ ${ymd(e.endDate)}` : "-"}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{e.copySource === "AI" ? "AI" : "템플릿"}</td>
                <td className="px-3 py-2"><Badge value={e.status === "PUBLISHED" ? "ACTIVE" : e.status === "ENDED" ? "EXPIRED" : "DRAFT"} label={STATUS[e.status]} /></td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}
