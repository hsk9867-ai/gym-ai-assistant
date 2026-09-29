import { prisma } from "@/lib/db";
import { RemoteSignForm } from "@/components/forms/RemoteSignForm";
import { ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RemoteSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await prisma.contract.findUnique({ where: { signToken: token }, include: { center: { select: { name: true } } } });
  if (!c || c.status === "CANCELLED") {
    return <main className="mx-auto max-w-lg p-8 text-center text-gray-600">유효하지 않거나 취소된 계약 링크입니다.</main>;
  }
  return (
    <main className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{c.center.name}</div>
        <h1 className="mt-1 text-xl font-bold">전자계약 서명</h1>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 font-sans text-sm leading-6">{c.content}</pre>
        <div className="mt-6">
          {c.status === "SIGNED" ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">이미 {ymdhm(c.signedAt)}에 서명이 완료된 계약입니다.</p>
          ) : (
            <RemoteSignForm token={token} />
          )}
        </div>
      </div>
    </main>
  );
}
