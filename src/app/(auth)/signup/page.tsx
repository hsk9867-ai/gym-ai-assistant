"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";

export default function SignupPage() {
  const [state, action] = useActionState(signupAction, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">헬스장 AI 경영비서</div>
          <h1 className="mt-1 text-xl font-bold">센터 만들기</h1>
          <p className="mt-1 text-sm text-gray-500">센터와 관리자 계정을 함께 생성합니다.</p>
        </div>
        <form action={action} className="space-y-4">
          {state?.error && <Alert>{state.error}</Alert>}
          <Field label="센터명"><input name="centerName" required className={inputCls} placeholder="예: 강남 피트니스" /></Field>
          <Field label="센터 전화번호"><input name="phone" className={inputCls} placeholder="02-000-0000" /></Field>
          <Field label="관리자 이름"><input name="name" required className={inputCls} /></Field>
          <Field label="이메일"><input name="email" type="email" required className={inputCls} /></Field>
          <Field label="비밀번호" hint="6자 이상"><input name="password" type="password" required minLength={6} className={inputCls} /></Field>
          <SubmitButton className="w-full">센터 생성</SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          이미 계정이 있나요? <Link href="/login" className="font-medium text-gray-900 underline">로그인</Link>
        </p>
      </div>
    </main>
  );
}
