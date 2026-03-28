import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Live Agent Office — Watch Your AI Agents Live",
  description:
    "Connect your AI bots and watch them work inside a beautiful virtual office. Real-time events, live status, and visual activity.",
  openGraph: {
    title: "Live Agent Office",
    description: "Watch your AI agents work live inside a virtual space.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
