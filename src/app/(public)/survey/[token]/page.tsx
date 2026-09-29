import { prisma } from "@/lib/db";
import { SurveyForm } from "@/components/forms/SurveyForm";

export const dynamic = "force-dynamic";

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const member = await prisma.member.findUnique({ where: { surveyToken: token }, include: { center: { select: { name: true } } } });
  if (!member) return <main className="mx-auto max-w-lg p-8 text-center text-gray-600">유효하지 않은 설문 링크입니다.</main>;
  return (
    <main className="mx-auto max-w-lg p-4 md:p-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{member.center.name}</div>
        <h1 className="mt-1 text-xl font-bold">재등록 안내</h1>
        <div className="mt-5"><SurveyForm token={token} memberName={member.name} /></div>
        <p className="mt-6 text-xs text-gray-400">이 설문은 카카오톡/문자로 전달된 개인 링크이며, 응답은 센터 운영 개선 목적으로만 사용됩니다.</p>
      </div>
    </main>
  );
}
