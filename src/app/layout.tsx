import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";

import NavBar from "@/components/NavBar";

import "./globals.css";
import "./pixel.css";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });
const body = VT323({ weight: "400", subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Look Up",
  description: "A tiny outdoor mission, then put the phone away.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#fbd3a6",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pixel.variable} ${body.variable}`}>
      <body>
        {children}
        <NavBar />
      </body>
    </html>
  );
}