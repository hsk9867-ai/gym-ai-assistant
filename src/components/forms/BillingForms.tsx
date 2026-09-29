"use client";

import { useActionState, useState } from "react";
import { changePlanAction, chargeCreditsAction } from "@/app/actions/billing";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, btnSecondaryCls } from "@/components/ui";

interface Plan { key: string; name: string; price: number; desc: string; features: readonly string[] }

export function PlanPicker({ plans, current, status, simulated }: { plans: Plan[]; current: string; status: string; simulated: boolean }) {
  const [state, action] = useActionState(changePlanAction, undefined);
  const [selected, setSelected] = useState(current);
  const sel = plans.find((p) => p.key === selected)!;
  const isSame = selected === current && status === "ACTIVE";
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.ok && <Alert kind="success">요금제가 적용되었습니다.</Alert>}
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const active = selected === p.key;
          return (
            <label key={p.key} className={`cursor-pointer rounded-xl border p-4 transition ${active ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200 hover:border-gray-400"}`}>
              <input type="radio" name="plan" value={p.key} checked={active} onChange={() => setSelected(p.key)} className="hidden" />
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">{p.name}</span>
                {current === p.key && <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">현재</span>}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{p.price.toLocaleString()}<span className="text-sm font-normal text-gray-500">원/월</span></div>
              <p className="mt-1 text-xs text-gray-500">{p.desc}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-gray-600">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm">
        <span>선택: <b>{sel.name}</b> · 월 {sel.price.toLocaleString()}원</span>
        <select name="method" className="rounded border border-gray-300 px-2 py-1 text-sm"><option value="CARD">카드 자동결제</option><option value="TRANSFER">계좌이체</option></select>
        <SubmitButton>{isSame ? "지금 갱신 (1개월 연장)" : current === selected ? "구독 재개" : "이 요금제로 변경 · 결제"}</SubmitButton>
        {simulated && <span className="text-xs text-amber-600">테스트 결제: PG 미연동 상태라 실제 청구 없이 즉시 적용됩니다.</span>}
      </div>
    </form>
  );
}

export function CreditCharge({ packs, simulated }: { packs: readonly number[]; simulated: boolean }) {
  const [state, action] = useActionState(chargeCreditsAction, undefined);
  const [amount, setAmount] = useState<number>(packs[1] ?? packs[0]);
  const bonus = amount >= 100000 ? 10000 : amount >= 50000 ? 3000 : 0;
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.ok && <Alert kind="success">충전이 완료되었습니다.</Alert>}
      <div className="flex flex-wrap gap-2">
        {packs.map((p) => (
          <button key={p} type="button" onClick={() => setAmount(p)} className={`rounded-lg px-4 py-2 text-sm font-medium ${amount === p ? "bg-gray-900 text-white" : "bg-white ring-1 ring-gray-200"}`}>
            {p.toLocaleString()}원{p >= 50000 && <span className="ml-1 text-xs opacity-70">+{(p >= 100000 ? 10000 : 3000).toLocaleString()} 보너스</span>}
          </button>
        ))}
      </div>
      <input type="hidden" name="amount" value={amount} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select name="method" className="rounded border border-gray-300 px-2 py-1 text-sm"><option value="CARD">카드</option><option value="TRANSFER">계좌이체</option></select>
        <span>충전 후 잔액 증가: <b>{(amount + bonus).toLocaleString()}원</b></span>
        <SubmitButton>{amount.toLocaleString()}원 결제 · 충전</SubmitButton>
        {simulated && <span className="text-xs text-amber-600">테스트 결제</span>}
      </div>
      <p className="text-xs text-gray-400">발송 단가: 카카오 알림톡 15원 · SMS 20원 · LMS 50원 (건당 차감)</p>
    </form>
  );
}

export function CancelPlanButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <button className={btnSecondaryCls} onClick={(e) => { if (!confirm("구독을 해지할까요? 현재 결제 기간이 끝나면 BASIC 기능만 이용할 수 있습니다.")) e.preventDefault(); }}>구독 해지</button>
    </form>
  );
}
