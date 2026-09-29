"use client";

import { btnCls, btnSecondaryCls } from "./ui";

/** 폼 제출 전에 브라우저 확인창을 한 번 더 띄우는 버튼 (서버 액션 폼과 함께 사용) */
export function ConfirmButton({ message, children, secondary = true, title }: { message: string; children: React.ReactNode; secondary?: boolean; title?: string }) {
  return (
    <button
      type="submit"
      title={title}
      className={secondary ? btnSecondaryCls : btnCls}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
