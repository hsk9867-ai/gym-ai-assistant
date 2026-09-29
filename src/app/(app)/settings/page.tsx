import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toggleProductAction } from "@/app/actions/settings";
import { regenerateKioskTokenAction } from "@/app/actions/kiosk";
import { cancelPlanAction } from "@/app/actions/billing";
import { CenterForm, ProductForm } from "@/components/forms/SettingsForms";
import { CancelPlanButton, CreditCharge, PlanPicker } from "@/components/forms/BillingForms";
import { Alert, Badge, Card, PageHeader, Stat, Table, btnSecondaryCls } from "@/components/ui";
import { billingMode, billingSummary, CREDIT_PACKS, PLANS } from "@/lib/services/billing";
import { messagingMode } from "@/lib/services/messaging";
import { num, won, ymd, ymdhm } from "@/lib/format";

export const dynamic = "force-dynamic";

const PLAN_STATUS: Record<string, string> = { TRIAL: "체험", ACTIVE: "이용중", PAST_DUE: "미결제", CANCELLED: "해지 예정" };
const TX_TYPE: Record<string, string> = { SUBSCRIPTION: "구독 결제", CREDIT_CHARGE: "크레딧 충전", CREDIT_USE: "발송 차감" };
const TX_STATUS: Record<string, string> = { PENDING: "대기", PAID: "결제완료", FAILED: "실패", SIMULATED: "테스트결제" };

export default async function SettingsPage() {
  const s = await requireAdmin();
  const [center, products, billing] = await Promise.all([
    prisma.center.findUniqueOrThrow({ where: { id: s.centerId } }),
    prisma.product.findMany({ where: { centerId: s.centerId }, orderBy: [{ type: "asc" }, { price: "asc" }] }),
    billingSummary(s.centerId),
  ]);
  const simulated = billingMode() === "SIMULATED";
  const plan = PLANS[center.plan as keyof typeof PLANS] ?? PLANS.BASIC;
  const estMessages = Math.floor(center.messageCredits / 15);

  return (
    <div className="max-w-5xl">
      <PageHeader title="설정" />

      {/* ───────── 구독 · 결제 ───────── */}
      <section className="mb-8 rounded-2xl border border-gray-900 bg-gray-950 p-6 text-white">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/50">구독 · 결제</div>
            <h2 className="mt-1 text-xl font-bold">{plan.name} <span className="text-base font-normal text-white/60">월 {won(plan.price)}</span> <span className="ml-2 align-middle"><Badge value={center.planStatus === "ACTIVE" ? "ACTIVE" : center.planStatus === "CANCELLED" ? "EXPIRED" : "PLANNED"} label={PLAN_STATUS[center.planStatus] ?? center.planStatus} /></span></h2>
            <p className="mt-1 text-sm text-white/60">{center.planRenewsAt ? `다음 결제일 ${ymd(center.planRenewsAt)}` : "결제 이력 없음 (체험 상태)"} · {plan.desc}</p>
          </div>
          {center.planStatus === "ACTIVE" && <CancelPlanButton action={cancelPlanAction} />}
        </div>
        {simulated && <div className="mb-4"><Alert kind="info">PG(토스페이먼츠) 키가 없어 <b>테스트 결제</b>로 동작합니다. 실제 청구 없이 즉시 적용되며, .env에 TOSS_CLIENT_KEY / TOSS_SECRET_KEY를 넣으면 실제 결제창으로 전환됩니다.</Alert></div>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="문자·카톡 잔액" value={won(center.messageCredits)} hint={`알림톡 약 ${num(estMessages)}건 발송 가능`} tone={center.messageCredits < 5000 ? "warn" : "default"} />
          <Stat label="이번 달 발송 차감" value={won(billing.monthUseAmount)} hint={`${num(billing.monthUseCount)}건`} />
          <Stat label="발송 모드" value={messagingMode() === "LIVE" ? "실제 발송" : "시뮬레이션"} hint={messagingMode() === "LIVE" ? "크레딧 차감됨" : "차감 없음"} />
          <Stat label="다음 구독 결제" value={center.planStatus === "ACTIVE" ? won(plan.price) : "-"} hint={center.planRenewsAt ? ymd(center.planRenewsAt) : undefined} />
        </div>
      </section>

      <Card className="mb-6" title="요금제 변경">
        <PlanPicker
          plans={Object.entries(PLANS).map(([key, p]) => ({ key, name: p.name, price: p.price, desc: p.desc, features: p.features }))}
          current={center.plan}
          status={center.planStatus}
          simulated={simulated}
        />
      </Card>

      <Card className="mb-6" title="문자 · 카카오톡 크레딧 충전">
        <CreditCharge packs={CREDIT_PACKS} simulated={simulated} />
      </Card>

      <Card className="mb-8" title="결제 내역">
        <Table head={["일시", "구분", "내용", "금액", "결제수단", "상태"]} empty={billing.txs.length === 0}>
          {billing.txs.map((t) => (
            <tr key={t.id}>
              <td className="px-3 py-2 tabular-nums">{ymdhm(t.createdAt)}</td>
              <td className="px-3 py-2">{TX_TYPE[t.type] ?? t.type}</td>
              <td className="px-3 py-2 text-gray-600">{t.type === "SUBSCRIPTION" ? `${t.plan} 월 구독` : `${won(t.credits)} 충전`}{t.memo ? ` · ${t.memo}` : ""}</td>
              <td className="px-3 py-2 tabular-nums">{won(t.amount)}</td>
              <td className="px-3 py-2">{t.method === "CARD" ? "카드" : "계좌이체"}</td>
              <td className="px-3 py-2"><Badge value={t.status === "SIMULATED" ? "SIMULATED" : t.status === "PAID" ? "SIGNED" : t.status} label={TX_STATUS[t.status] ?? t.status} /></td>
            </tr>
          ))}
        </Table>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-gray-500">센터 · 상품 · 키오스크</h2>
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
