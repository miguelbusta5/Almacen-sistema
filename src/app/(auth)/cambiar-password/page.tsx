import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CambiarPasswordForm } from "./_components";

export default async function CambiarPasswordPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <CambiarPasswordForm forzado={!!session.user?.mustChangePassword} />;
}
