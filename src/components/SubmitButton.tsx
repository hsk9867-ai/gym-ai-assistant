"use client";

import { useFormStatus } from "react-dom";
import { btnCls, btnSecondaryCls } from "./ui";

export function SubmitButton({ children, secondary = false, className = "" }: { children: React.ReactNode; secondary?: boolean; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${secondary ? btnSecondaryCls : btnCls} ${className}`}>
      {pending ? "처리 중..." : children}
    </button>
  );
}
