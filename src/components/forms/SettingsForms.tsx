"use client";

import { useActionState, useState } from "react";
import { createProductAction, updateCenterAction } from "@/app/actions/settings";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";

export function CenterForm({ center }: { center: { name: string; businessNumber: string | null; phone: string | null; address: string | null; plan: string; reportHour: number } }) {
  const [state, action] = useActionState(updateCenterAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.ok && <Alert kind="success">저장되었습니다.</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="센터명"><input name="name" required defaultValue={center.name} className={inputCls} /></Field>
        <Field label="사업자번호"><input name="businessNumber" defaultValue={center.businessNumber ?? ""} className={inputCls} /></Field>
        <Field label="전화번호"><input name="phone" defaultValue={center.phone ?? ""} className={inputCls} /></Field>
        <Field label="주소"><input name="address" defaultValue={center.address ?? ""} className={inputCls} /></Field>
        <Field label="요금제 (데모용 전환)" hint="실제 서비스에서는 슈퍼관리자/결제로 관리">
          <select name="plan" defaultValue={center.plan} className={inputCls}>
            <option value="BASIC">BASIC (7,900원)</option>
            <option value="SMART">SMART (15,900원)</option>
            <option value="AI_PRO">AI PRO (19,900원)</option>
          </select>
        </Field>
        <Field label="일일보고 시각 (SMART 이상)"><input type="number" name="reportHour" min={0} max={23} defaultValue={center.reportHour} className={inputCls} /></Field>
      </div>
      <SubmitButton>저장</SubmitButton>
    </form>
  );
}

export function ProductForm() {
  const [state, action] = useActionState(createProductAction, undefined);
  const [type, setType] = useState("MEMBERSHIP");
  return (
    <form action={action} className="grid gap-3 md:grid-cols-5">
      {state?.error && <div className="md:col-span-5"><Alert>{state.error}</Alert></div>}
      {state?.ok && <div className="md:col-span-5"><Alert kind="success">상품이 추가되었습니다.</Alert></div>}
      <Field label="유형"><select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}><option value="MEMBERSHIP">회원권</option><option value="PT">PT</option></select></Field>
      <Field label="상품명"><input name="name" required className={inputCls} placeholder={type === "PT" ? "PT 10회" : "헬스 3개월"} /></Field>
      {type === "MEMBERSHIP" ? <Field label="이용기간(일)"><input type="number" name="durationDays" min={1} defaultValue={30} className={inputCls} /></Field> : <Field label="PT 횟수"><input type="number" name="ptCount" min={1} defaultValue={10} className={inputCls} /></Field>}
      <Field label="가격"><input type="number" name="price" min={0} step={1000} defaultValue={0} className={inputCls} /></Field>
      <div className="flex items-end"><SubmitButton className="w-full">상품 추가</SubmitButton></div>
    </form>
  );
}
