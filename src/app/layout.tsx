import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // zoom permitido (WCAG 1.4.4) — nao bloquear maximumScale/userScalable
  themeColor: "#09090b",
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-bg text-text">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
