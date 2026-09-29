import { prisma } from "@/lib/db";
import { KioskScreen } from "@/components/KioskScreen";

export const dynamic = "force-dynamic";

export default async function KioskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const center = await prisma.center.findUnique({ where: { kioskToken: token }, select: { name: true, status: true } });
  if (!center || center.status !== "ACTIVE") {
    return <main className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">사용할 수 없는 키오스크 링크입니다. 설정 화면에서 링크를 다시 발급하세요.</main>;
  }
  return <KioskScreen token={token} centerName={center.name} />;
}
