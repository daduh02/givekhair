import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  // Redirect to appropriate place based on role
  const adminRoles = ["CHARITY_ADMIN", "FINANCE", "PLATFORM_ADMIN"];
  if (adminRoles.includes(session.user.role)) {
    redirect("/admin");
  }

  // Fundraiser / donor dashboard — redirect to homepage for now
  redirect("/");
}
