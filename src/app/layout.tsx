import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";
import "./site.css";
import "./landing.css";
import "./app.css";
import "./features.css";
import "./meet.css";

const text = Atkinson_Hyperlegible_Next({ subsets: ["latin", "latin-ext"], variable: "--font-text", display: "swap", adjustFontFallback: false });
const mono = Atkinson_Hyperlegible_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  metadataBase: new URL("https://dossierly.pages.dev"),
  title: { default: "Dossierly · your AI caseworker for life in Poland", template: "%s · Dossierly" },
  description:
    "A private AI caseworker that remembers your residence case: prepares you for the office, interprets live, reads official letters, links them to what was said and counts the deadline.",
  openGraph: { title: "Dossierly", description: "Your private AI caseworker for life abroad. Poland first.", url: "https://dossierly.pages.dev" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f13" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${text.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
