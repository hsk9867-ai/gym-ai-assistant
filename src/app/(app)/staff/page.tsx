import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateStaffAction } from "@/app/actions/settings";
import { StaffForm } from "@/components/forms/StaffForm";
import { Card, PageHeader, Table, btnSecondaryCls } from "@/components/ui";
import { ROLE_LABEL, ymd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const s = await requireAdmin();
  const users = await prisma.user.findMany({
    where: { centerId: s.centerId },
    include: { _count: { select: { managedMembers: true, trainedPackages: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div>
      <PageHeader title="직원관리" subtitle="트레이너/직원 계정과 권한(매출 열람 등)을 관리합니다." />
      <Card className="mb-6" title="직원 추가"><StaffForm /></Card>
      <Table head={["이름", "이메일", "권한", "매출열람", "담당회원", "PT패키지", "상태", "가입일", ""]} empty={users.length === 0}>
        {users.map((u) => (
          <tr key={u.id} className={!u.active ? "text-gray-400" : ""}>
            <td className="px-3 py-2 font-medium">{u.name}{u.id === s.userId && <span className="ml-1 text-xs text-gray-400">(나)</span>}</td>
            <td className="px-3 py-2">{u.email}</td>
            <td className="px-3 py-2">{ROLE_LABEL[u.role]}</td>
            <td className="px-3 py-2">{u.canViewSales ? "O" : "X"}</td>
            <td className="px-3 py-2 tabular-nums">{u._count.managedMembers}</td>
            <td className="px-3 py-2 tabular-nums">{u._count.trainedPackages}</td>
            <td className="px-3 py-2">{u.active ? "활성" : "비활성"}</td>
            <td className="px-3 py-2 tabular-nums">{ymd(u.createdAt)}</td>
            <td className="px-3 py-2">
              {u.id !== s.userId && (
                <div className="flex gap-1">
                  {(["toggleRole", "toggleSales", "toggleActive"] as const).map((a) => (
                    <form key={a} action={updateStaffAction}>
                      <input type="hidden" name="id" value={u.id} /><input type="hidden" name="action" value={a} />
                      <button className={btnSecondaryCls}>{a === "toggleRole" ? "권한전환" : a === "toggleSales" ? "매출열람" : u.active ? "비활성화" : "활성화"}</button>
                    </form>
                  ))}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
