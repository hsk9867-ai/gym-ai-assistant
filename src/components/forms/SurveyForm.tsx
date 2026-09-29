"use client";

import { useActionState, useState } from "react";
import { submitSurveyAction } from "@/app/actions/renewals";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, inputCls } from "@/components/ui";
import { RENEWAL_REASON } from "@/lib/format";

export function SurveyForm({ token, memberName }: { token: string; memberName: string }) {
  const [state, action] = useActionState(submitSurveyAction, undefined);
  const [answer, setAnswer] = useState<"RENEW" | "NOT_RENEW" | "">("");
  if (state?.ok) {
    return <Alert kind="success">{answer === "RENEW" ? "감사합니다! 센터에서 재등록 안내를 드리겠습니다." : "소중한 의견 감사합니다. 더 나은 센터가 되도록 노력하겠습니다."}</Alert>;
  }
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state?.error && <Alert>{state.error}</Alert>}
      <p className="text-sm text-gray-700">{memberName}님, 회원권 만료가 다가오고 있습니다. 재등록 계획이 있으신가요?</p>
      <div className="grid grid-cols-2 gap-2">
        <label className={`cursor-pointer rounded-xl border p-4 text-center text-sm font-medium ${answer === "RENEW" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"}`}>
          <input type="radio" name="answer" value="RENEW" className="hidden" onChange={() => setAnswer("RENEW")} />네, 재등록할게요
        </label>
        <label className={`cursor-pointer rounded-xl border p-4 text-center text-sm font-medium ${answer === "NOT_RENEW" ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300"}`}>
          <input type="radio" name="answer" value="NOT_RENEW" className="hidden" onChange={() => setAnswer("NOT_RENEW")} />아니요, 이번엔 어려워요
        </label>
      </div>
      {answer === "NOT_RENEW" && (
        <div className="space-y-2">
          <p className="text-sm font-medium">재등록하지 않는 가장 큰 이유는 무엇인가요?</p>
          {Object.entries(RENEWAL_REASON).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-sm"><input type="radio" name="reason" value={k} required />{v}</label>
          ))}
        </div>
      )}
      {answer && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">건의사항 (선택)</span>
          <textarea name="feedback" rows={3} className={inputCls} placeholder="센터에 바라는 점을 자유롭게 적어주세요." />
        </label>
      )}
      {answer && <SubmitButton className="w-full">제출</SubmitButton>}
    </form>
  );
}
