import { notFound } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MembershipForm } from "@/components/forms/MembershipForm";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export default async function NewMembershipPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireCenterSession();
  const { id } = await params;
  const [member, products] = await Promise.all([
    prisma.member.findFirst({ where: { id, centerId: s.centerId }, include: { _count: { select: { memberships: true } } } }),
    prisma.product.findMany({ where: { centerId: s.centerId, type: "MEMBERSHIP", active: true }, orderBy: { price: "asc" } }),
  ]);
  if (!member) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`${member.name} · 회원권 등록`} subtitle="회원권 생성 → 결제 기록 → 전자계약 순으로 자동 연결됩니다." actions={<LinkButton href={`/members/${id}`} variant="secondary">← 상세로</LinkButton>} />
      <Card>
        <MembershipForm memberId={id} products={products.map((p) => ({ id: p.id, name: p.name, durationDays: p.durationDays, price: p.price }))} isRenewal={member._count.memberships > 0} />
      </Card>
    </div>
  );
}
