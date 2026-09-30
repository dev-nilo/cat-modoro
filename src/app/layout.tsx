import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pomodoro Pet",
  description: "Timer Pomodoro com um monstrengo que cansa enquanto você trabalha e se recupera nas pausas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
