import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Sinhala } from "next/font/google";
import ProvidersWrapper from "./providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const notoSansSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-sinhala",
  subsets: ["sinhala"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Number Slot Game",
  description: "Mobile-first 100-slot number guessing game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSansSinhala.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-base text-hi">
        <ProvidersWrapper>{children}</ProvidersWrapper>
      </body>
    </html>
  );
}
