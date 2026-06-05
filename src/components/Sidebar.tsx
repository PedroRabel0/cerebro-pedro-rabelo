"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BookOpen,
  Search,
  Target,
  Lightbulb,
  Sparkles,
  Brain,
  Menu,
  X,
  Settings,
  LogOut,
  User,
  CalendarDays,
  BarChart3,
  TrendingUp,
  MessageCircle,
  Mail,
  AudioLines,
  NotebookPen,
} from "lucide-react";
import { useUserRole, type UserRole } from "@/lib/hooks/useUserRole";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof Brain;
  roles?: UserRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "CORE",
    items: [
      { href: "/", label: "Cérebro", Icon: Brain },
      { href: "/base-de-conhecimento", label: "Conhecimento", Icon: BookOpen },
      { href: "/gerar-conteudo", label: "Geração", Icon: Sparkles },
    ],
  },
  {
    title: "ANÁLISE",
    items: [
      { href: "/insights-pedro", label: "Insights", Icon: Lightbulb },
      { href: "/tendencias", label: "Tendências", Icon: TrendingUp },
      { href: "/analytics", label: "Analytics", Icon: BarChart3 },
    ],
  },
  {
    title: "FERRAMENTAS",
    items: [
      { href: "/diario", label: "Diario", Icon: NotebookPen },
      { href: "/respostas", label: "Pedro Clone", Icon: MessageCircle },
      { href: "/newsletter", label: "Newsletter", Icon: Mail },
      { href: "/calendario", label: "Calendário", Icon: CalendarDays },
      { href: "/evolucao-voz", label: "Voz", Icon: AudioLines },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { href: "/referencias", label: "Referências", Icon: Search, roles: ["pedro"] },
      { href: "/identidade", label: "Identidade", Icon: Target, roles: ["pedro"] },
    ],
  },
];

function getUserName(email: string | undefined): string {
  if (!email) return "Usuário";
  const nameMap: Record<string, string> = {
    "pedro@cerebro.app": "Pedro",
    "henrique@cerebro.app": "Henrique",
  };
  return nameMap[email] || email.split("@")[0];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const { role, isPedro } = useUserRole();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? undefined);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="logo-gradient flex h-8 w-8 items-center justify-center rounded-lg">
          <Brain className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="font-display text-sm font-bold text-text">
            Segundo Cérebro
          </h1>
          <p className="font-mono text-[11px] text-text-muted">Pedro Rabelo</p>
        </div>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {navSections.map((section, sIdx) => {
          // Filter items by role
          const visibleItems = section.items.filter(
            (item) => !item.roles || (role && item.roles.includes(role))
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className={sIdx > 0 ? "mt-4" : ""}>
              {/* Section header */}
              <p className="mb-1.5 px-3 font-mono text-[11px] font-medium uppercase tracking-wider text-text-muted/60">
                {section.title}
              </p>

              {/* Items */}
              <ul className="space-y-0.5" role="list">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`nav-item-hover group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 ${
                          active
                            ? "nav-item-active text-accent"
                            : "text-text-secondary hover:text-text"
                        }`}
                      >
                        <item.Icon
                          className={`h-[16px] w-[16px] transition-colors ${
                            active
                              ? "text-accent"
                              : "text-text-muted group-hover:text-text-secondary"
                          }`}
                        />
                        <span className={`text-[13px] font-medium ${active ? "text-accent" : ""}`}>
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* Settings — Pedro only */}
        {isPedro && (
          <div className="mt-4">
            <div className="mx-3 border-t border-border/50" />
            <Link
              href="/configuracoes"
              onClick={() => setMobileOpen(false)}
              className={`nav-item-hover group mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200 ${
                pathname.startsWith("/configuracoes")
                  ? "nav-item-active text-accent"
                  : "text-text-secondary hover:text-text"
              }`}
            >
              <Settings
                className={`h-[16px] w-[16px] transition-colors ${
                  pathname.startsWith("/configuracoes")
                    ? "text-accent"
                    : "text-text-muted group-hover:text-text-secondary"
                }`}
              />
              <span className={`text-[13px] font-medium ${
                pathname.startsWith("/configuracoes") ? "text-accent" : ""
              }`}>
                Configurações
              </span>
            </Link>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-violet/20">
            <User className="h-3 w-3 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text truncate">
              {getUserName(userEmail)}
            </p>
            <p className="text-[11px] text-text-muted truncate">
              {userEmail ?? "..."}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-text-muted hover:bg-card-hover hover:text-red transition-colors"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-xl border border-border bg-card p-2 text-text shadow-lg md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 rounded-lg p-1 text-text-muted hover:text-text"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-card md:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
