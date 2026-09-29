import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toggleProductAction } from "@/app/actions/settings";
import { regenerateKioskTokenAction } from "@/app/actions/kiosk";
import { CenterForm, ProductForm } from "@/components/forms/SettingsForms";
import { Card, PageHeader, Table, btnSecondaryCls } from "@/components/ui";
import { won } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await requireAdmin();
  const [center, products] = await Promise.all([
    prisma.center.findUniqueOrThrow({ where: { id: s.centerId } }),
    prisma.product.findMany({ where: { centerId: s.centerId }, orderBy: [{ type: "asc" }, { price: "asc" }] }),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="설정" />
      <Card className="mb-6" title="센터 정보"><CenterForm center={center} /></Card>
      <Card className="mb-6" title="입구 키오스크">
        <p className="mb-2 text-sm text-gray-600">입구 태블릿/PC 브라우저에서 아래 링크를 전체화면으로 열어두세요. 회원이 휴대폰 뒷 4자리를 입력하면 회원권 유효 여부를 확인하고 출석 처리됩니다.</p>
        {center.kioskToken ? (
          <div className="flex flex-wrap items-center gap-3">
            <a href={`/kiosk/${center.kioskToken}`} target="_blank" rel="noreferrer" className="rounded bg-gray-100 px-2 py-1 font-mono text-sm underline">{process.env.APP_URL ?? "http://localhost:3000"}/kiosk/{center.kioskToken}</a>
            <form action={regenerateKioskTokenAction}><button className={btnSecondaryCls}>링크 재발급</button></form>
          </div>
        ) : (
          <form action={regenerateKioskTokenAction}><button className={btnSecondaryCls}>키오스크 링크 발급</button></form>
        )}
        <p className="mt-2 text-xs text-gray-400">링크가 외부에 노출되면 재발급하세요. 이전 링크는 즉시 무효화됩니다.</p>
      </Card>
      <Card className="mb-6" title="상품 추가"><ProductForm /></Card>
      <Card title="상품 목록">
        <Table head={["유형", "상품명", "기간/횟수", "가격", "상태", ""]} empty={products.length === 0}>
          {products.map((p) => (
            <tr key={p.id} className={!p.active ? "text-gray-400" : ""}>
              <td className="px-3 py-2">{p.type === "PT" ? "PT" : "회원권"}</td>
              <td className="px-3 py-2 font-medium">{p.name}</td>
              <td className="px-3 py-2">{p.type === "PT" ? `${p.ptCount}회` : `${p.durationDays}일`}</td>
              <td className="px-3 py-2 tabular-nums">{won(p.price)}</td>
              <td className="px-3 py-2">{p.active ? "판매중" : "중지"}</td>
              <td className="px-3 py-2"><form action={toggleProductAction}><input type="hidden" name="id" value={p.id} /><button className={btnSecondaryCls}>{p.active ? "판매중지" : "판매재개"}</button></form></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
