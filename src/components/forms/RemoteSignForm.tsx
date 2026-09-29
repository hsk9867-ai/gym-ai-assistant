"use client";

import { useActionState } from "react";
import { signContractRemoteAction } from "@/app/actions/contracts";
import { SignaturePad } from "@/components/SignaturePad";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";

export function RemoteSignForm({ token }: { token: string }) {
  const [state, action] = useActionState(signContractRemoteAction, undefined);
  if (state?.ok) return <Alert kind="success">서명이 완료되었습니다. 계약서는 센터에 안전하게 보관됩니다. 이 창을 닫으셔도 됩니다.</Alert>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="본인 확인: 휴대폰 번호 뒷 4자리" hint="SMS 인증(OTP)은 메시지 연동(MVP 2) 후 적용됩니다.">
        <input name="last4" required maxLength={4} pattern="\d{4}" inputMode="numeric" className={inputCls} />
      </Field>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" className="mt-1" />위 계약 내용, 환불 규정, 개인정보 수집·이용에 동의합니다.</label>
      <SignaturePad />
      <SubmitButton className="w-full">서명 제출</SubmitButton>
    </form>
  );
}
