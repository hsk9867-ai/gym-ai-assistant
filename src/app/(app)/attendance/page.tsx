import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckInForm } from "@/components/forms/CheckInForm";
import { Card, PageHeader, Stat, Table } from "@/components/ui";
import { endOfDay, startOfDay, ymdhm, addDays, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const s = await requireCenterSession();
  const today = startOfDay();
  const [todayList, todayCount, weekCount] = await Promise.all([
    prisma.attendance.findMany({ where: { centerId: s.centerId, checkedAt: { gte: today, lte: endOfDay() } }, include: { member: { select: { id: true, name: true, status: true } } }, orderBy: { checkedAt: "desc" } }),
    prisma.attendance.count({ where: { centerId: s.centerId, checkedAt: { gte: today } } }),
    prisma.attendance.count({ where: { centerId: s.centerId, checkedAt: { gte: addDays(today, -6) } } }),
  ]);
  return (
    <div>
      <PageHeader title="출석" subtitle="데스크 출석 처리. 입구 키오스크(설정 → 키오스크 링크)에서 회원이 직접 체크인한 기록도 여기에 함께 표시됩니다." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:w-1/2">
        <Stat label="오늘 방문" value={num(todayCount)} />
        <Stat label="최근 7일 방문" value={num(weekCount)} />
      </div>
      <Card className="mb-6" title="출석 처리"><CheckInForm /></Card>
      <Card title="오늘 출석 목록">
        <Table head={["시각", "회원", "상태", "경로"]} empty={todayList.length === 0}>
          {todayList.map((a) => (
            <tr key={a.id}>
              <td className="px-3 py-2 tabular-nums">{ymdhm(a.checkedAt)}</td>
              <td className="px-3 py-2 font-medium"><Link href={`/members/${a.member.id}`} className="hover:underline">{a.member.name}</Link></td>
              <td className="px-3 py-2 text-gray-500">{a.member.status}</td>
              <td className="px-3 py-2 text-gray-500">{{ DESK: "데스크", KIOSK: "키오스크", QR: "QR" }[a.source] ?? a.source}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
