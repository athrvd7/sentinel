import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Sentinel Proof — Speak safely. Prove everything.",
  description: "Anonymous evidence submission with encrypted storage and verifiable integrity."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
