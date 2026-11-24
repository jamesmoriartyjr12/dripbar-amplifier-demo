import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/components/orbs/orbs.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The DRIPBaR · How are you feeling?",
  icons: { icon: "/brand/dripbar-mark.svg" },
  description: "Tell us how you feel and get options a clinician confirms at your visit. Demo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4efe9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
