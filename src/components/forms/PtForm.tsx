"use client";

import { useActionState, useState } from "react";
import { addPtPackageAction } from "@/app/actions/members";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";
import { PAYMENT_METHOD } from "@/lib/format";

interface Product { id: string; name: string; ptCount: number | null; price: number }
interface Trainer { id: string; name: string }

export function PtForm({ memberId, products, trainers }: { memberId: string; products: Product[]; trainers: Trainer[] }) {
  const [state, action] = useActionState(addPtPackageAction, undefined);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const p = products.find((x) => x.id === productId);
  const [count, setCount] = useState(p?.ptCount ?? 10);
  const [amount, setAmount] = useState(p?.price ?? 0);

  const onProduct = (id: string) => {
    setProductId(id);
    const x = products.find((q) => q.id === id);
    if (x) { setCount(x.ptCount ?? 10); setAmount(x.price); }
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="memberId" value={memberId} />
      {state?.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="PT 상품">
          <select name="productId" value={productId} onChange={(e) => onProduct(e.target.value)} className={inputCls}>
            {products.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.price.toLocaleString()}원)</option>)}
            <option value="">직접 입력</option>
          </select>
        </Field>
        {!productId && <Field label="상품명"><input name="productName" className={inputCls} placeholder="예: PT 10회" /></Field>}
        <Field label="총 횟수"><input type="number" name="totalCount" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="결제금액"><input type="number" name="amount" min={0} step={10000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputCls} /></Field>
        <Field label="담당 트레이너">
          <select name="trainerId" className={inputCls}>
            <option value="">미지정</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="PT 만료일 (선택)"><input type="date" name="expireDate" className={inputCls} /></Field>
        <Field label="결제수단">
          <select name="method" className={inputCls}>{Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makeContract" />전자계약서 생성 후 서명 화면으로 이동</label>
      <SubmitButton>PT 등록</SubmitButton>
    </form>
  );
}
