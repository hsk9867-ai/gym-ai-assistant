import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { undoPtSessionAction, usePtSessionAction } from "@/app/actions/members";
import { PageHeader, Table, btnSecondaryCls } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { messagingMode } from "@/lib/services/messaging";
import { ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PtPage({ searchParams }: { searchParams: Promise<{ low?: string; trainerId?: string }> }) {
  const s = await requireCenterSession();
  const sp = await searchParams;
  const pkgs = await prisma.ptPackage.findMany({
    where: { centerId: s.centerId, ...(sp.trainerId ? { trainerId: sp.trainerId } : {}) },
    include: { member: { select: { id: true, name: true } }, trainer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  // 등록일 최신순 (findMany의 createdAt desc 유지)
  const rows = pkgs
    .map((p) => ({ ...p, remain: p.totalCount - p.usedCount }))
    .filter((p) => (sp.low ? p.remain >= 1 && p.remain <= 3 : true));
  const trainers = await prisma.user.findMany({ where: { centerId: s.centerId, active: true }, select: { id: true, name: true } });

  return (
    <div>
      <PageHeader
        title="PT 관리"
        subtitle={`최근 등록한 순서로 표시됩니다. '1회 사용' 확인 시 회원에게 남은 횟수 알림톡이 자동 발송됩니다. (현재 ${messagingMode() === "LIVE" ? "실제 발송" : "시뮬레이션 모드 · 기록만 저장"})`}
        actions={<Link href="/messages" className="text-sm text-gray-500 underline">발송 기록 →</Link>}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/pt" className={`rounded-full px-3 py-1 ${!sp.low && !sp.trainerId ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>전체</Link>
        <Link href="/pt?low=1" className={`rounded-full px-3 py-1 ${sp.low ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>잔여 3회 이하</Link>
        {trainers.map((t) => (
          <Link key={t.id} href={`/pt?trainerId=${t.id}`} className={`rounded-full px-3 py-1 ${sp.trainerId === t.id ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>{t.name}</Link>
        ))}
      </div>
      <Table head={["등록일", "회원", "상품", "총", "사용", "잔여", "트레이너", "만료일", ""]} empty={rows.length === 0}>
        {rows.map((p) => (
          <tr key={p.id} className={p.remain === 0 ? "text-gray-400" : ""}>
            <td className="px-3 py-2 tabular-nums">{ymd(p.createdAt)}</td>
            <td className="px-3 py-2 font-medium"><Link href={`/members/${p.member.id}`} className="hover:underline">{p.member.name}</Link></td>
            <td className="px-3 py-2">{p.productName}</td>
            <td className="px-3 py-2 tabular-nums">{p.totalCount}</td>
            <td className="px-3 py-2 tabular-nums">{p.usedCount}</td>
            <td className={`px-3 py-2 font-semibold tabular-nums ${p.remain > 0 && p.remain <= 3 ? "text-amber-600" : ""}`}>{p.remain}회</td>
            <td className="px-3 py-2">{p.trainer?.name ?? "미지정"}</td>
            <td className="px-3 py-2 tabular-nums">{ymd(p.expireDate)}</td>
            <td className="px-3 py-2">
              <div className="flex gap-1">
                {p.remain > 0 && (
                  <form action={usePtSessionAction}>
                    <input type="hidden" name="ptPackageId" value={p.id} />
                    <ConfirmButton message={`${p.member.name}님의 수업 1회를 차감하시겠습니까?\n\n차감 후 잔여 ${p.remain - 1}회가 되며, 회원에게 남은 횟수와 응원 메시지가 카카오톡으로 자동 발송됩니다.`}>1회 사용</ConfirmButton>
                  </form>
                )}
                {p.usedCount > 0 && (
                  <form action={undoPtSessionAction}><input type="hidden" name="ptPackageId" value={p.id} /><button className={btnSecondaryCls} title="최근 사용 1회를 되돌립니다">복원</button></form>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
