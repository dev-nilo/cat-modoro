import type { Metadata, Viewport } from "next";
import { Nunito, Pixelify_Sans } from "next/font/google";

import "./globals.css";

const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Pomodoro Cat",
  description: "A Pomodoro timer with a pixel-art cat that gets tired while you work and recharges on your breaks.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#1d181c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${pixel.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
