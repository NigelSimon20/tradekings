import type { Metadata } from "next";
import { Geist, Geist_Mono, Raleway } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
/** Raleway is the Trade Kings brand typeface, used here for headings. */
const raleway = Raleway({ variable: "--font-raleway", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Contract Tracker · Trade Kings & Zimkings",
  description:
    "Automated contract tracking, contract-limit monitoring and weekly reporting for blue collar and casual employees.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${raleway.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
