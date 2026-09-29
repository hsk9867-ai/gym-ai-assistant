"use client";

import { useActionState } from "react";
import { createStaffAction } from "@/app/actions/settings";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";

export function StaffForm() {
  const [state, action] = useActionState(createStaffAction, undefined);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-5">
      {state?.error && <div className="md:col-span-5"><Alert>{state.error}</Alert></div>}
      {state?.ok && <div className="md:col-span-5"><Alert kind="success">직원이 추가되었습니다.</Alert></div>}
      <Field label="이름"><input name="name" required className={inputCls} /></Field>
      <Field label="이메일"><input name="email" type="email" required className={inputCls} /></Field>
      <Field label="초기 비밀번호"><input name="password" type="password" required minLength={6} className={inputCls} /></Field>
      <Field label="권한">
        <select name="role" className={inputCls}><option value="STAFF">직원(트레이너)</option><option value="CENTER_ADMIN">센터관리자</option></select>
      </Field>
      <div className="flex flex-col justify-end gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="canViewSales" />매출 열람 허용</label>
        <SubmitButton>직원 추가</SubmitButton>
      </div>
    </form>
  );
}
