import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faucet Finder Chat",
  description:
    "Ask the assistant to identify faucets and upload photos when needed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
