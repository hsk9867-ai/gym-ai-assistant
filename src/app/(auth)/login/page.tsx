"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">헬스장 AI 경영비서</div>
          <h1 className="mt-1 text-xl font-bold">로그인</h1>
        </div>
        <form action={action} className="space-y-4">
          {state?.error && <Alert>{state.error}</Alert>}
          <Field label="이메일"><input name="email" type="email" required className={inputCls} autoComplete="email" /></Field>
          <Field label="비밀번호"><input name="password" type="password" required className={inputCls} autoComplete="current-password" /></Field>
          <SubmitButton className="w-full">로그인</SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          아직 센터가 없나요? <Link href="/signup" className="font-medium text-gray-900 underline">센터 만들기</Link>
        </p>
        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
          데모 계정: admin@demo.gym / demo1234
        </p>
      </div>
    </main>
  );
}
