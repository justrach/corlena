import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gemini.corlena.dev"),
  title: {
    default: "Corlena AI Canvas — Gemini + WASM",
    template: "%s — Corlena AI Canvas",
  },
  applicationName: "Corlena AI Canvas",
  description:
    "Figma‑grade, AI‑assisted canvas editor. Generate with Gemini 2.5 and edit as real layers on an infinite, high‑performance canvas powered by a Rust/WASM engine.",
  keywords: [
    "Corlena",
    "Gemini",
    "AI",
    "canvas",
    "editor",
    "WASM",
    "Rust",
    "Next.js",
    "image editing",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://gemini.corlena.dev",
    siteName: "Corlena AI Canvas",
    title: "Corlena AI Canvas — Professional Image Editing with Gemini + WASM",
    description:
      "Professional, Figma‑inspired canvas editor with Gemini AI and a Rust/WASM engine for smooth, precise editing on an infinite canvas.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Corlena AI Canvas — Gemini + WASM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Corlena AI Canvas — Gemini + WASM",
    description:
      "AI‑assisted, Figma‑grade web canvas. Generate with Gemini and edit as real layers on a WASM‑accelerated engine.",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: "Corlena AI Canvas — Gemini + WASM",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
