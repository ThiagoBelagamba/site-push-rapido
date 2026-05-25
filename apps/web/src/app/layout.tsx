import type { Metadata } from "next";
import "./globals.css";
import "./login-extra.css";

export const metadata: Metadata = {
  title: "Push Rápido — Admin",
  description: "Painel administrativo Web Push",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
