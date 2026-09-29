"use client";

import { useActionState } from "react";
import { addPaymentAction } from "@/app/actions/members";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";
import { PAYMENT_METHOD, PAYMENT_TYPE, ymd } from "@/lib/format";

export function PaymentForm() {
  const [state, action] = useActionState(addPaymentAction, undefined);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-6">
      {state?.error && <div className="md:col-span-6"><Alert>{state.error}</Alert></div>}
      {state?.ok && <div className="md:col-span-6"><Alert kind="success">등록되었습니다.</Alert></div>}
      <Field label="일자"><input type="date" name="paidAt" defaultValue={ymd(new Date())} className={inputCls} /></Field>
      <Field label="항목"><input name="productName" placeholder="예: 락커, 운동복" className={inputCls} /></Field>
      <Field label="금액"><input type="number" name="amount" required min={0} step={1000} className={inputCls} /></Field>
      <Field label="구분"><select name="type" className={inputCls}>{Object.entries(PAYMENT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="결제수단"><select name="method" className={inputCls}>{Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <div className="flex items-end"><SubmitButton className="w-full">기타 매출 등록</SubmitButton></div>
    </form>
  );
}
