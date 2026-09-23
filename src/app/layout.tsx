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

/**
 * Strips attributes that browser extensions add to the page.
 *
 * Bitdefender's extension tags every element it scans with `bis_skin_checked`,
 * and password managers mark <body> with their own attribute. They do this
 * after the HTML is parsed but before React hydrates, so React compares its
 * own markup against a DOM that has been edited underneath it and reports a
 * mismatch that has nothing to do with this application.
 *
 * This inline script runs during parsing — before the framework bundle loads
 * and hydration begins — and removes only those known attributes. It is left
 * out of production builds, where React does not log hydration warnings at all.
 */
function ExtensionAttributeCleanup() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var a=['bis_skin_checked','bis_register','bis_size'];for(var i=0;i<a.length;i++){var n=document.querySelectorAll('['+a[i]+']');for(var j=0;j<n.length;j++){n[j].removeAttribute(a[i])}}var b=document.body;if(b){for(var k=b.attributes.length-1;k>=0;k--){var m=b.attributes[k].name;if(m.indexOf('__processed')===0){b.removeAttribute(m)}}}}catch(e){}})()`,
      }}
    />
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
     * `suppressHydrationWarning` is only for the two elements browser
     * extensions reach first. Password managers, anti-tracker tools and the
     * like add their own attributes to <html> and <body> before React starts,
     * which React then reports as a mismatch even though nothing in the app
     * differs. It is deliberately not used anywhere else, so a real mismatch in
     * our own markup still gets reported.
     */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${raleway.variable} h-full`}
    >
      <body suppressHydrationWarning className="min-h-full">
        {children}
        <ExtensionAttributeCleanup />
      </body>
    </html>
  );
}
