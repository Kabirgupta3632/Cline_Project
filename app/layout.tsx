// Root layout for the whole app: loads fonts, global styles, and page metadata.
// Shared infra - not owned by a single feature.
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "RakshaRakt - Emergency Blood Donation Network",
  description:
    "Hospitals broadcast urgent blood needs, nearby donors respond in minutes.",
  // Manifest link for the donor PWA bonus (scope is limited to /donor inside
  // manifest.json itself) - Feature: Donor PWA (Person 3).
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#bc1414",
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
