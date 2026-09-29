import { prisma } from "@/lib/db";
import { requireCenterSession } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCenterSession();
  const center = await prisma.center.findUnique({ where: { id: session.centerId }, select: { name: true, plan: true } });
  return (
    <div className="flex min-h-screen">
      <div className="no-print">
        <Sidebar session={session} centerName={center?.name ?? "센터"} plan={center?.plan ?? "BASIC"} />
      </div>
      <main className="flex-1 overflow-x-hidden p-6 lg:p-8">{children}</main>
    </div>
  );
}
