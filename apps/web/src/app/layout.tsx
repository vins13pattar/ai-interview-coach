import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Interview Coach — Adaptive interview practice",
  description:
    "An open-source AI interviewer that adapts in real time and produces evidence-backed recruiter reports.",
  openGraph: {
    title: "Interview Coach",
    description: "Practice the interview that reacts to you—not a script.",
    type: "website",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f2efe6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
