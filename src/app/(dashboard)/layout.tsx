import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-56">
        <div className="mx-auto max-w-5xl px-4 py-6 pt-16 sm:px-6 md:px-8 md:py-10 md:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
