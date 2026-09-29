import { notFound } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PtForm } from "@/components/forms/PtForm";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export default async function NewPtPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireCenterSession();
  const { id } = await params;
  const [member, products, trainers] = await Promise.all([
    prisma.member.findFirst({ where: { id, centerId: s.centerId } }),
    prisma.product.findMany({ where: { centerId: s.centerId, type: "PT", active: true }, orderBy: { price: "asc" } }),
    prisma.user.findMany({ where: { centerId: s.centerId, active: true }, select: { id: true, name: true } }),
  ]);
  if (!member) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`${member.name} · PT 등록`} actions={<LinkButton href={`/members/${id}`} variant="secondary">← 상세로</LinkButton>} />
      <Card>
        <PtForm memberId={id} products={products.map((p) => ({ id: p.id, name: p.name, ptCount: p.ptCount, price: p.price }))} trainers={trainers} />
      </Card>
    </div>
  );
}
