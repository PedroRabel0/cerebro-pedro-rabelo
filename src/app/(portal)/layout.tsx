import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-guards";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const role = user?.app_metadata?.role ?? user?.user_metadata?.role;
  if (role !== "cliente") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-2xl px-3 py-6 sm:px-6 md:py-10">
        {children}
      </div>
    </div>
  );
}
