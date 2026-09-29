import { notFound } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMemberDetail } from "@/lib/services/members";
import { MemberForm } from "@/components/forms/MemberForm";
import { Card, PageHeader, LinkButton } from "@/components/ui";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireCenterSession();
  const { id } = await params;
  const [m, staff] = await Promise.all([
    getMemberDetail(s.centerId, id),
    prisma.user.findMany({ where: { centerId: s.centerId, active: true }, select: { id: true, name: true } }),
  ]);
  if (!m) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`${m.name} 정보 수정`} actions={<LinkButton href={`/members/${id}`} variant="secondary">← 상세로</LinkButton>} />
      <Card>
        <MemberForm
          staff={staff}
          values={{
            id: m.id, name: m.name, phone: m.phone, gender: m.gender, memo: m.memo, staffId: m.staffId, status: m.status,
            smsAdConsent: m.smsAdConsent, kakaoAdConsent: m.kakaoAdConsent, alimtalkConsent: m.alimtalkConsent,
          }}
        />
      </Card>
    </div>
  );
}
