"use client";

import { useActionState, useState } from "react";
import { addMembershipAction } from "@/app/actions/members";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";
import { PAYMENT_METHOD, addDays, ymd } from "@/lib/format";

interface Product { id: string; name: string; durationDays: number | null; price: number }

export function MembershipForm({ memberId, products, isRenewal }: { memberId: string; products: Product[]; isRenewal: boolean }) {
  const [state, action] = useActionState(addMembershipAction, undefined);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [start, setStart] = useState(ymd(new Date()));
  const product = products.find((p) => p.id === productId);
  const [days, setDays] = useState(product?.durationDays ?? 30);
  const [amount, setAmount] = useState(product?.price ?? 0);
  const end = ymd(addDays(new Date(start), days - 1));

  const onProduct = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) { setDays(p.durationDays ?? 30); setAmount(p.price); }
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="memberId" value={memberId} />
      {state?.error && <Alert>{state.error}</Alert>}
      {isRenewal && <Alert kind="info">기존 회원권이 있어 <b>재등록</b>으로 기록됩니다.</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="상품">
          <select name="productId" value={productId} onChange={(e) => onProduct(e.target.value)} className={inputCls}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.price.toLocaleString()}원)</option>)}
            <option value="">직접 입력</option>
          </select>
        </Field>
        {!productId && <Field label="상품명"><input name="productName" className={inputCls} placeholder="예: 헬스 3개월" /></Field>}
        <Field label="시작일"><input type="date" name="startDate" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} /></Field>
        <Field label="이용기간(일)"><input type="number" name="days" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="종료일 (자동계산)"><input type="date" name="endDate" value={end} readOnly className={`${inputCls} bg-gray-50`} /></Field>
        <Field label="결제금액"><input type="number" name="amount" min={0} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="결제수단">
          <select name="method" className={inputCls}>{Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makeContract" defaultChecked />전자계약서 생성 후 서명 화면으로 이동</label>
      <SubmitButton>회원권 등록</SubmitButton>
    </form>
  );
}
