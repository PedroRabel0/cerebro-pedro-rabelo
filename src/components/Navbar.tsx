"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/base-de-conhecimento", label: "Base de Conhecimento" },
  { href: "/referencias", label: "Referências" },
  { href: "/identidade", label: "Identidade" },
  { href: "/insights-pedro", label: "Insights Pedro" },
  { href: "/gerar-conteudo", label: "Gerar Conteúdo" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-7xl items-center px-4 py-3">
        <Link href="/base-de-conhecimento" className="flex items-baseline gap-2">
          <span className="font-display text-lg font-bold text-ink">
            Segundo Cérebro
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            do Pedro
          </span>
        </Link>
      </div>

      <nav className="mx-auto max-w-7xl overflow-x-auto px-4">
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-ink-muted hover:text-ink-soft"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
