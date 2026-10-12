import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexo | Gestión de proyectos",
  description: "Proyectos, equipo y tareas en un solo lugar.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
