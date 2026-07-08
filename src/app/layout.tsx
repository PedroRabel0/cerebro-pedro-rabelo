import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Bebas_Neue } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// Fonte de títulos da marca — pesada, condensada, caixa alta (igual ao site do Pedro)
const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // zoom permitido (WCAG 1.4.4) — nao bloquear maximumScale/userScalable
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: "Segundo Cérebro do Pedro",
  description: "Sistema de gestão de conhecimento e geração de conteúdo com IA",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Segundo Cérebro do Pedro",
    description: "Plataforma de gestão de conhecimento e geração de conteúdo com IA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-bg text-text">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
