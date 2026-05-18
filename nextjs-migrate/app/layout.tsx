import type { Metadata } from "next";
import "./globals.css";
import { AppStoreProvider } from "@/lib/app-store";

export const metadata: Metadata = {
  title: "JobbedIn",
  description: "AI-assisted job application tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppStoreProvider>{children}</AppStoreProvider>
      </body>
    </html>
  );
}
