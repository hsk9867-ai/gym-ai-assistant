import { notFound } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteEventAction, regenerateCopyAction, setEventStatusAction } from "@/app/actions/events";
import { PosterStudio } from "@/components/PosterStudio";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Alert, Card, LinkButton, PageHeader, btnSecondaryCls } from "@/components/ui";
import { aiMode, type EventCopy } from "@/lib/services/ai";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ warn?: string }> }) {
  const s = await requireCenterSession();
  const { id } = await params;
  const { warn } = await searchParams;
  const [ev, center] = await Promise.all([
    prisma.event.findFirst({ where: { id, centerId: s.centerId } }),
    prisma.center.findUniqueOrThrow({ where: { id: s.centerId } }),
  ]);
  if (!ev) notFound();
  const copy = JSON.parse(ev.copyJson) as EventCopy;
  const period = ev.startDate && ev.endDate ? `${ymd(ev.startDate)} ~ ${ymd(ev.endDate)}` : ev.endDate ? `${ymd(ev.endDate)}까지` : "";
  const adConsented = await prisma.member.count({ where: { centerId: s.centerId, kakaoAdConsent: true, status: { notIn: ["WITHDRAWN"] } } });

  return (
    <div>
      <PageHeader
        title={ev.title}
        subtitle={`${ev.discount ?? ""} ${ev.target ? `· ${ev.target}` : ""} ${period ? `· ${period}` : ""} · 문구 출처: ${ev.copySource === "AI" ? "AI 생성" : "템플릿"}`}
        actions={
          <>
            <form action={regenerateCopyAction}><input type="hidden" name="eventId" value={ev.id} /><ConfirmButton message="현재 문구와 색상을 버리고 다시 생성할까요?">{aiMode() === "LIVE" ? "AI 다시 생성" : "문구 다시 생성"}</ConfirmButton></form>
            <form action={setEventStatusAction}><input type="hidden" name="eventId" value={ev.id} /><input type="hidden" name="status" value={ev.status === "PUBLISHED" ? "ENDED" : "PUBLISHED"} /><button className={btnSecondaryCls}>{ev.status === "PUBLISHED" ? "종료 처리" : "진행중으로 표시"}</button></form>
            <form action={deleteEventAction}><input type="hidden" name="eventId" value={ev.id} /><ConfirmButton message="이벤트를 삭제할까요?">삭제</ConfirmButton></form>
            <LinkButton href="/events" variant="secondary">목록</LinkButton>
          </>
        }
      />
      {warn && <div className="mb-4"><Alert kind="info">{warn} 템플릿 문구로 대체했습니다.</Alert></div>}

      <Card className="mb-6">
        <PosterStudio eventId={ev.id} centerName={center.name} period={period} initial={copy} />
      </Card>

      <Card title="다음 단계">
        <ul className="space-y-1 text-sm text-gray-600">
          <li>• PNG를 내려받아 인스타그램/네이버 플레이스/센터 출입구에 게시하세요.</li>
          <li>• "문구 복사"로 카카오톡 채널 소식과 인스타 캡션에 그대로 붙여넣을 수 있습니다.</li>
          <li>• 광고성 카카오 메시지로 발송하려면 광고 수신에 동의한 회원에게만 가능합니다. 현재 동의 회원 <b>{adConsented}명</b>. (일괄 발송 기능은 메시지 연동 후 이 화면에 추가됩니다.)</li>
          <li>• 사진 기반 배경(AI 이미지 생성)은 이미지 생성 API 연결 시 템플릿 옆에 옵션으로 추가됩니다.</li>
        </ul>
      </Card>
    </div>
  );
}
