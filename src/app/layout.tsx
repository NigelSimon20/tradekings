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
    /*
     * Browser extensions edit the page before React hydrates — password
     * managers mark <body>, and anti-virus extensions tag elements throughout
     * the tree. React then reports a mismatch that has nothing to do with this
     * application.
     *
     * `suppressHydrationWarning` covers the two elements extensions reach
     * first, and only those: it does not apply to descendants, and using it
     * more widely would hide a genuine mismatch in our own markup. Warnings
     * about elements deeper in the page come from the extension and can only be
     * silenced in the browser.
     */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${raleway.variable} h-full`}
    >
      <body suppressHydrationWarning className="min-h-full">
        {children}
      </body>
    </html>
  );
}
