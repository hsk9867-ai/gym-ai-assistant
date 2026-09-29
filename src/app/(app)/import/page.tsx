import { requireCenterSession } from "@/lib/auth";
import { ImportWizard } from "@/components/ImportWizard";
import { Card, PageHeader } from "@/components/ui";

export default async function ImportPage() {
  await requireCenterSession();
  return (
    <div className="max-w-5xl">
      <PageHeader title="Excel / CSV Import" subtitle="기존 CRM 데이터를 가져옵니다. 전화번호 + 센터 기준으로 중복을 검사합니다." />
      <Card><ImportWizard /></Card>
      <p className="mt-3 text-xs text-gray-400">샘플 파일: <a href="/sample-members.csv" className="underline">sample-members.csv</a> (연동형 테스트용)</p>
    </div>
  );
}
