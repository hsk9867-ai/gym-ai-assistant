import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MemberForm } from "@/components/forms/MemberForm";
import { Card, PageHeader } from "@/components/ui";

export default async function NewMemberPage() {
  const s = await requireCenterSession();
  const staff = await prisma.user.findMany({ where: { centerId: s.centerId, active: true }, select: { id: true, name: true } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="신규 회원등록" subtitle="등록 후 회원 상세에서 회원권·PT·전자계약을 추가합니다." />
      <Card><MemberForm staff={staff} /></Card>
    </div>
  );
}
