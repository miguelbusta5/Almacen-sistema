import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/common/Sidebar";
import Header from "@/components/common/Header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg, #f5f7fa)" }}>
      <Sidebar role={(session.user as any)?.role} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header user={session.user} />
        <main style={{ flex: 1, padding: "1.5rem", maxWidth: 1400, width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
