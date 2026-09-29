import Link from "next/link";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listMembers, refreshMemberStatuses } from "@/lib/services/members";
import { Badge, LinkButton, PageHeader, Table, inputCls, btnSecondaryCls } from "@/components/ui";
import { MEMBER_STATUS, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requireCenterSession();
  const sp = await searchParams;
  await refreshMemberStatuses(s.centerId);
  const [members, staff] = await Promise.all([
    listMembers(s.centerId, {
      q: sp.q,
      status: sp.status,
      staffId: sp.staffId,
      expireWithin: sp.expireWithin ? Number(sp.expireWithin) : undefined,
      product: sp.product,
    }),
    prisma.user.findMany({ where: { centerId: s.centerId, active: true }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="회원관리" subtitle={`${members.length}명 표시`} actions={<LinkButton href="/members/new">+ 신규 회원등록</LinkButton>} />

      <form className="mb-4 grid gap-2 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-6">
        <input name="q" defaultValue={sp.q} placeholder="이름 / 전화번호 / 뒷4자리" className={inputCls} />
        <select name="status" defaultValue={sp.status ?? ""} className={inputCls}>
          <option value="">회원상태 전체</option>
          {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="expireWithin" defaultValue={sp.expireWithin ?? ""} className={inputCls}>
          <option value="">만료기간 전체</option>
          <option value="7">7일 이내 만료</option>
          <option value="14">14일 이내 만료</option>
          <option value="30">30일 이내 만료</option>
        </select>
        <input name="product" defaultValue={sp.product} placeholder="회원권 종류" className={inputCls} />
        <select name="staffId" defaultValue={sp.staffId ?? ""} className={inputCls}>
          <option value="">담당 전체</option>
          {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button className={btnSecondaryCls}>검색</button>
          <Link href="/members" className={btnSecondaryCls}>초기화</Link>
        </div>
      </form>

      <Table head={["이름", "연락처", "상태", "회원권", "만료일", "PT 잔여", "최근 방문", "담당"]} empty={members.length === 0}>
        {members.map((m) => (
          <tr key={m.id} className="hover:bg-gray-50">
            <td className="px-3 py-2 font-medium"><Link href={`/members/${m.id}`} className="hover:underline">{m.name}</Link></td>
            <td className="px-3 py-2 text-gray-600">{m.phone}</td>
            <td className="px-3 py-2"><Badge value={m.status} label={MEMBER_STATUS[m.status]} /></td>
            <td className="px-3 py-2">{m.membership?.productName ?? <span className="text-gray-400">없음</span>}</td>
            <td className="px-3 py-2 tabular-nums">{ymd(m.membership?.endDate)}</td>
            <td className="px-3 py-2 tabular-nums">{m.ptRemaining > 0 ? `${m.ptRemaining}회` : "-"}</td>
            <td className="px-3 py-2 tabular-nums">{ymd(m.lastVisitAt)}</td>
            <td className="px-3 py-2 text-gray-600">{m.staff}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
