import { notFound } from "next/navigation";
import { requireCenterSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ContractForm } from "@/components/forms/ContractForm";
import { DEFAULT_REFUND_POLICY } from "@/lib/services/contracts";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export default async function NewContractPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireCenterSession();
  const { id } = await params;
  const member = await prisma.member.findFirst({ where: { id, centerId: s.centerId } });
  if (!member) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`${member.name} · 계약서 작성`} subtitle="회원권/PT 등록 없이 계약서만 별도로 만들 때 사용합니다." actions={<LinkButton href={`/members/${id}`} variant="secondary">← 상세로</LinkButton>} />
      <Card><ContractForm memberId={id} defaultRefundPolicy={DEFAULT_REFUND_POLICY} /></Card>
    </div>
  );
}
