"use client";

import { useActionState } from "react";
import { checkInAction } from "@/app/actions/members";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, inputCls } from "@/components/ui";

export function CheckInForm() {
  const [state, action] = useActionState(checkInAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        <input name="q" required autoFocus placeholder="전화번호 전체, 뒷 4자리 또는 이름" className={`${inputCls} text-lg`} />
        <SubmitButton>출석</SubmitButton>
      </div>
      {state?.error && !state.ok && <Alert>{state.error}</Alert>}
      {state?.ok && state.error && <Alert kind="info">{state.error}</Alert>}
      {state?.ok && !state.error && <Alert kind="success">출석 처리되었습니다.</Alert>}
    </form>
  );
}
