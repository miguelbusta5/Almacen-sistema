import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/common/Sidebar";
import Header from "@/components/common/Header";

// Vercel: hasta 30 s para que el layout complete en cold starts
export const maxDuration = 30;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.mustChangePassword) redirect("/cambiar-password");

  return (
    <div className="g-shell" style={{ background: "var(--bg)" }}>
      <Sidebar role={session.user?.role} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header user={session.user} />
        <main className="dash-main" style={{ flex: 1, maxWidth: 1400, width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
