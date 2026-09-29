import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, PageHeader, Table } from "@/components/ui";
import { CONTRACT_STATUS, won, ymd, ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await requireCenterSession();
  const { status } = await searchParams;
  const contracts = await prisma.contract.findMany({
    where: { centerId: s.centerId, ...(status ? { status } : {}) },
    include: { member: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const showSales = s.canViewSales || s.role !== "STAFF";
  return (
    <div>
      <PageHeader title="전자계약" subtitle="현장 서명 또는 원격 링크 서명. 서명 완료 시 본문·서명·시각으로 문서 해시를 생성합니다." />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/contracts" className={`rounded-full px-3 py-1 ${!status ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>전체</Link>
        {Object.entries(CONTRACT_STATUS).map(([k, v]) => (
          <Link key={k} href={`/contracts?status=${k}`} className={`rounded-full px-3 py-1 ${status === k ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>{v}</Link>
        ))}
      </div>
      <Table head={["작성일", "회원", "상품", "유형", "금액", "기간", "상태", "서명일"]} empty={contracts.length === 0}>
        {contracts.map((c) => (
          <tr key={c.id} className="hover:bg-gray-50">
            <td className="px-3 py-2 tabular-nums">{ymd(c.createdAt)}</td>
            <td className="px-3 py-2 font-medium"><Link href={`/members/${c.member.id}`} className="hover:underline">{c.member.name}</Link></td>
            <td className="px-3 py-2"><Link href={`/contracts/${c.id}`} className="hover:underline">{c.productName}</Link></td>
            <td className="px-3 py-2">{c.contractType}</td>
            <td className="px-3 py-2 tabular-nums">{showSales ? won(c.amount) : "-"}</td>
            <td className="px-3 py-2 tabular-nums">{c.startDate ? `${ymd(c.startDate)} ~ ${ymd(c.endDate)}` : c.ptCount ? `PT ${c.ptCount}회` : "-"}</td>
            <td className="px-3 py-2"><Badge value={c.status} label={CONTRACT_STATUS[c.status]} /></td>
            <td className="px-3 py-2 tabular-nums">{ymdhm(c.signedAt)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
