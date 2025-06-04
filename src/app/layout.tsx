import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UwUlarpy - AI-Powered GitHub Assistant",
  description: "Interactive code assistant that can answer questions, review code, implement features, and integrate with GitHub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
