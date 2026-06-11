import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIWOS — AI Workforce Operating System",
  description:
    "Manage, orchestrate, and scale your AI workforce with AIWOS — the AI Workforce Operating System.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark h-full antialiased"
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
