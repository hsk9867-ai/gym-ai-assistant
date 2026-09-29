"use client";

import { useActionState } from "react";
import { createContractAction } from "@/app/actions/contracts";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";

export function ContractForm({ memberId, defaultRefundPolicy }: { memberId: string; defaultRefundPolicy: string }) {
  const [state, action] = useActionState(createContractAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="memberId" value={memberId} />
      {state?.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="상품명 *"><input name="productName" required className={inputCls} placeholder="예: 헬스 6개월 + PT 10회" /></Field>
        <Field label="금액"><input type="number" name="amount" min={0} step={1000} defaultValue={0} className={inputCls} /></Field>
        <Field label="이용 시작일"><input type="date" name="startDate" className={inputCls} /></Field>
        <Field label="이용 종료일"><input type="date" name="endDate" className={inputCls} /></Field>
        <Field label="PT 횟수 (선택)"><input type="number" name="ptCount" min={0} className={inputCls} /></Field>
      </div>
      <Field label="환불규정"><textarea name="refundPolicy" rows={4} defaultValue={defaultRefundPolicy} className={inputCls} /></Field>
      <SubmitButton>계약서 생성</SubmitButton>
    </form>
  );
}
