"use client";

import { useActionState } from "react";
import { createMemberAction, updateMemberAction } from "@/app/actions/members";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field, inputCls } from "@/components/ui";
import { MEMBER_STATUS, ymd } from "@/lib/format";

interface StaffOpt { id: string; name: string }

export interface MemberFormValues {
  id?: string;
  name?: string;
  phone?: string;
  gender?: string | null;
  memo?: string | null;
  staffId?: string | null;
  status?: string;
  joinedAt?: Date;
  smsAdConsent?: boolean;
  kakaoAdConsent?: boolean;
  alimtalkConsent?: boolean;
}

export function MemberForm({ staff, values }: { staff: StaffOpt[]; values?: MemberFormValues }) {
  const isEdit = Boolean(values?.id);
  const [state, action] = useActionState(isEdit ? updateMemberAction : createMemberAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.ok && <Alert kind="success">저장되었습니다.</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="이름 *"><input name="name" required defaultValue={values?.name} className={inputCls} /></Field>
        <Field label="연락처 *" hint="010-0000-0000 / 센터 내 중복 불가"><input name="phone" required defaultValue={values?.phone} className={inputCls} placeholder="010-0000-0000" /></Field>
        <Field label="성별">
          <select name="gender" defaultValue={values?.gender ?? ""} className={inputCls}>
            <option value="">선택 안 함</option>
            <option value="M">남</option>
            <option value="F">여</option>
          </select>
        </Field>
        <Field label="담당 직원">
          <select name="staffId" defaultValue={values?.staffId ?? ""} className={inputCls}>
            <option value="">미지정</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        {isEdit ? (
          <Field label="회원 상태" hint="휴회/탈퇴는 수동 관리, 나머지는 회원권·출석으로 자동 계산">
            <select name="status" defaultValue={values?.status ?? "ACTIVE"} className={inputCls}>
              {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="가입일"><input name="joinedAt" type="date" defaultValue={ymd(new Date())} className={inputCls} /></Field>
        )}
      </div>
      <Field label="메모"><textarea name="memo" rows={3} defaultValue={values?.memo ?? ""} className={inputCls} /></Field>

      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">수신 동의</legend>
        <div className="flex flex-wrap gap-6 text-sm">
          {isEdit && <label className="flex items-center gap-2"><input type="checkbox" name="alimtalkConsent" defaultChecked={values?.alimtalkConsent ?? true} />알림톡(정보성)</label>}
          <label className="flex items-center gap-2"><input type="checkbox" name="smsAdConsent" defaultChecked={values?.smsAdConsent} />SMS 광고 수신 동의</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="kakaoAdConsent" defaultChecked={values?.kakaoAdConsent} />카카오 광고 수신 동의</label>
        </div>
        <p className="mt-2 text-xs text-gray-400">광고성 메시지는 동의한 회원에게만 발송됩니다. 정보성 메시지(만료 안내 등)는 별도 동의 없이 발송 가능합니다.</p>
      </fieldset>

      <SubmitButton>{isEdit ? "저장" : "회원 등록"}</SubmitButton>
    </form>
  );
}
