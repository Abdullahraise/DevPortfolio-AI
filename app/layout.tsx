import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevPortfolio AI - Turn your work into a portfolio",
  description:
    "Generate a bespoke developer portfolio from your GitHub profile and resume, customize it, and export clean source code.",
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
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
