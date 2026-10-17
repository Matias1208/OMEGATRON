import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { AppShell } from "./_components/app-shell";
import "./globals.css";

// Primaria: titulares, KPIs y kiosco.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Secundaria: logs, RFID, IDs y timestamps.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "HARKAI · Control inteligente de EPP",
    template: "%s · HARKAI",
  },
  description:
    "HARKAI: dispensación de EPP por credencial RFID con control de vida útil, inventario por lotes, registro de accesos y alertas EHS.",
};

export const viewport: Viewport = {
  themeColor: "#030b1a", // = --color-night (los metadatos no aceptan variables CSS)
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
