import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Organic · Marketing OS",
  description: "Your brand, content and marketing workflow in one workspace.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
