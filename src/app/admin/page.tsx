import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/app/actions/auth";
import { Card, PageHeader, Stat, Table } from "@/components/ui";
import { PLAN_LABEL, num, won, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

const PLAN_PRICE: Record<string, number> = { BASIC: 7900, SMART: 15900, AI_PRO: 19900 };

export default async function SuperAdminPage() {
  const s = await getSession();
  if (!s || s.role !== "SUPER_ADMIN") redirect("/login");
  const centers = await prisma.center.findMany({
    include: { _count: { select: { members: true, users: true, contracts: true } } },
    orderBy: { createdAt: "desc" },
  });
  const mrr = centers.filter((c) => c.status === "ACTIVE").reduce((sum, c) => sum + (PLAN_PRICE[c.plan] ?? 0), 0);
  const [members, contracts, imports] = await Promise.all([prisma.member.count(), prisma.contract.count({ where: { status: "SIGNED" } }), prisma.importJob.count()]);

  return (
    <main className="mx-auto max-w-6xl p-6 lg:p-8">
      <PageHeader title="SUPER ADMIN" subtitle="플랫폼 운영 현황" actions={<form action={logoutAction}><button className="text-sm underline">로그아웃</button></form>} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="전체 센터" value={num(centers.length)} />
        <Stat label="월 구독매출(예상)" value={won(mrr)} />
        <Stat label="전체 회원 수" value={num(members)} />
        <Stat label="서명 완료 계약" value={num(contracts)} />
        <Stat label="Import 작업" value={num(imports)} />
      </div>
      <Card title="센터 목록">
        <Table head={["센터", "가입일", "요금제", "상태", "회원수", "직원수", "계약수"]} empty={centers.length === 0}>
          {centers.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 font-medium">{c.name}</td>
              <td className="px-3 py-2 tabular-nums">{ymd(c.createdAt)}</td>
              <td className="px-3 py-2">{PLAN_LABEL[c.plan]}</td>
              <td className="px-3 py-2">{c.status}</td>
              <td className="px-3 py-2 tabular-nums">{num(c._count.members)}</td>
              <td className="px-3 py-2 tabular-nums">{num(c._count.users)}</td>
              <td className="px-3 py-2 tabular-nums">{num(c._count.contracts)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <p className="mt-4 text-xs text-gray-400">메시지/AI 사용량, 결제, 장애 로그는 MVP 2~3에서 해당 기능과 함께 추가됩니다.</p>
    </main>
  );
}
