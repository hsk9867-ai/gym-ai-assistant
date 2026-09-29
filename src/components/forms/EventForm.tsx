"use client";

import { useActionState } from "react";
import { createEventAction } from "@/app/actions/events";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";

export function EventForm({ aiLive }: { aiLive: boolean }) {
  const [state, action] = useActionState(createEventAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="이벤트명 *"><input name="title" required className={inputCls} placeholder="예: 가을 재등록 이벤트" /></Field>
        <Field label="혜택 (사실 그대로)" hint="AI는 여기 적힌 혜택만 사용하고 할인율을 지어내지 않습니다."><input name="discount" className={inputCls} placeholder="예: 6개월권 20% 할인 + PT 1회 무료" /></Field>
        <Field label="대상"><input name="target" className={inputCls} placeholder="예: 10월 만료 예정 회원, 신규 회원" /></Field>
        <Field label="톤">
          <select name="tone" className={inputCls}>
            <option value="energetic">활기찬 · 운동 동기부여</option>
            <option value="premium">고급스러운 · 프리미엄</option>
            <option value="friendly">친근한 · 동네 센터</option>
          </select>
        </Field>
        <Field label="시작일"><input type="date" name="startDate" className={inputCls} /></Field>
        <Field label="종료일"><input type="date" name="endDate" className={inputCls} /></Field>
      </div>
      <Field label="추가 설명 (선택)"><textarea name="description" rows={2} className={inputCls} placeholder="강조하고 싶은 내용, 조건 등" /></Field>
      <div className="flex items-center gap-3">
        <SubmitButton>{aiLive ? "AI 문구 생성 + 포스터 만들기" : "포스터 만들기 (템플릿 문구)"}</SubmitButton>
        {!aiLive && <span className="text-xs text-gray-400">ANTHROPIC_API_KEY 설정 시 AI가 문구와 색상을 생성합니다.</span>}
      </div>
    </form>
  );
}
