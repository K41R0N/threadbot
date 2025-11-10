import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const bebasNeue = localFont({
  src: "../public/fonts/BebasNeue-Regular.ttf",
  variable: "--font-bebas",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Threadbot - Notion to Telegram Automation",
  description: "Automate sending Notion prompts to Telegram and log replies back",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bebasNeue.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
