"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Zap,
  BookOpen,
  Search,
  Target,
  Lightbulb,
  Sparkles,
  Brain,
  Menu,
  X,
  Wifi,
  Settings,
} from "lucide-react";

const navItems = [
  {
    href: "/",
    label: "Input",
    Icon: Zap,
    description: "Alimentar o cérebro",
  },
  {
    href: "/base-de-conhecimento",
    label: "Conhecimento",
    Icon: BookOpen,
    description: "Playbooks e histórias",
  },
  {
    href: "/referencias",
    label: "Referências",
    Icon: Search,
    description: "Perfis e posts",
  },
  {
    href: "/identidade",
    label: "Identidade",
    Icon: Target,
    description: "Voz e tom",
  },
  {
    href: "/insights-pedro",
    label: "Insights",
    Icon: Lightbulb,
    description: "Capturas e propostas",
  },
  {
    href: "/gerar-conteudo",
    label: "Gerar",
    Icon: Sparkles,
    description: "Criar conteúdo",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover shadow-lg shadow-accent/20">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-sm font-bold text-text">
            Segundo Cérebro
          </h1>
          <p className="font-mono text-[10px] text-text-muted">Pedro Rabelo</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                isActive
                  ? "bg-accent/10 text-accent shadow-sm shadow-accent/5"
                  : "text-text-secondary hover:bg-card-hover hover:text-text"
              }`}
            >
              <item.Icon
                className={`h-[18px] w-[18px] transition-colors ${
                  isActive
                    ? "text-accent"
                    : "text-text-muted group-hover:text-text-secondary"
                }`}
              />
              <div>
                <span
                  className={`block text-sm font-medium ${
                    isActive ? "text-accent" : ""
                  }`}
                >
                  {item.label}
                </span>
                <span className="block text-[11px] text-text-muted">
                  {item.description}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Settings link */}
      <div className="px-3 pb-2">
        <Link
          href="/configuracoes"
          onClick={() => setMobileOpen(false)}
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
            pathname.startsWith("/configuracoes")
              ? "bg-accent/10 text-accent shadow-sm shadow-accent/5"
              : "text-text-secondary hover:bg-card-hover hover:text-text"
          }`}
        >
          <Settings
            className={`h-[18px] w-[18px] transition-colors ${
              pathname.startsWith("/configuracoes")
                ? "text-accent"
                : "text-text-muted group-hover:text-text-secondary"
            }`}
          />
          <div>
            <span
              className={`block text-sm font-medium ${
                pathname.startsWith("/configuracoes") ? "text-accent" : ""
              }`}
            >
              Configurações
            </span>
            <span className="block text-[11px] text-text-muted">
              Custos e preferências
            </span>
          </div>
        </Link>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Wifi className="h-3 w-3 text-green" />
          <span className="font-mono text-[10px] text-text-muted">
            IA Conectada
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {["Claude", "Gemini", "GPT", "Apify"].map((ai) => (
            <span
              key={ai}
              className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[9px] text-text-muted"
            >
              {ai}
            </span>
          ))}
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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1 text-text-muted hover:text-text"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card md:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
