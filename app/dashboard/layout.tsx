import { cookies } from "next/headers";
import Shell from "@/components/Shell";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = readSession(cookies().get(SESSION_COOKIE)?.value);
  const user = session?.user ?? { name: "Pengguna", role: "staff", email: "", initials: "P" };
  return (
    <Shell user={user} accesses={session?.accesses ?? []} activeToken={session?.token ?? ""}>
      {children}
    </Shell>
  );
}
