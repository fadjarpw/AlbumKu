import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlbumKu — Generator Album Foto Lokal",
  description:
    "Susun banyak foto menjadi album siap cetak secara otomatis, langsung di komputer Anda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
