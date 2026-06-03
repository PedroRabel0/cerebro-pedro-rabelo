import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Skip to content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white focus:text-sm"
      >
        Pular para o conteúdo
      </a>
      <Sidebar />
      <main id="main-content" className="flex-1 md:ml-56">
        <div className="mx-auto max-w-5xl px-4 py-6 pt-16 sm:px-6 md:px-8 md:py-10 md:pt-10">
          {children}
        </div>
      </main>
    </div>
  );
}
