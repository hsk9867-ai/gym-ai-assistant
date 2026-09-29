import { ymd } from "@/lib/format";

export const DEFAULT_REFUND_POLICY =
  "회원권 환불은 「체력단련장 이용 표준약관」에 따릅니다. 이용 개시 전 해지 시 전액 환불하며, 개시 후 해지 시 총 이용금액에서 이용일수(또는 회차)에 해당하는 금액과 총 금액의 10% 위약금을 공제한 후 환불합니다.";

export interface ContractParams {
  centerName: string;
  centerAddress?: string | null;
  centerPhone?: string | null;
  memberName: string;
  memberPhone: string;
  productName: string;
  amount: number;
  startDate?: Date | null;
  endDate?: Date | null;
  ptCount?: number | null;
  refundPolicy: string;
  termsVersion: string;
}

/** 서명 시점에 그대로 저장되는 계약 본문. 해시 계산의 원본이 된다. */
export function buildContractContent(p: ContractParams): string {
  const lines = [
    `회원권 이용 계약서 (${p.termsVersion})`,
    ``,
    `[센터] ${p.centerName}${p.centerAddress ? ` / ${p.centerAddress}` : ""}${p.centerPhone ? ` / ${p.centerPhone}` : ""}`,
    `[회원] ${p.memberName} / ${p.memberPhone}`,
    ``,
    `1. 계약 상품: ${p.productName}`,
    `2. 결제 금액: ${p.amount.toLocaleString("ko-KR")}원`,
  ];
  if (p.startDate && p.endDate) lines.push(`3. 이용 기간: ${ymd(p.startDate)} ~ ${ymd(p.endDate)}`);
  if (p.ptCount) lines.push(`4. PT 횟수: ${p.ptCount}회`);
  lines.push(
    ``,
    `[환불 규정]`,
    p.refundPolicy,
    ``,
    `[개인정보 수집·이용 동의]`,
    `센터는 회원관리, 이용안내, 계약 이행을 위해 이름·연락처·회원권 정보를 수집하며, 계약 종료 후 관련 법령이 정한 기간 동안 보관 후 파기합니다. 회원은 동의를 거부할 수 있으나, 거부 시 회원권 이용이 제한될 수 있습니다.`,
    ``,
    `[광고성 정보 수신]`,
    `할인·이벤트 등 광고성 정보는 회원이 별도로 동의한 경우에만 발송되며, 언제든 철회할 수 있습니다.`,
    ``,
    `본인은 위 계약 내용과 환불 규정, 개인정보 처리 내용을 확인하였으며 이에 동의합니다.`,
  );
  return lines.join("\n");
}
