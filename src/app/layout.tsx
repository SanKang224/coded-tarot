import type { Metadata, Viewport } from "next";
import { Roboto_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import ViewportHeight from "@/components/ViewportHeight";

const robotoMono = Roboto_Mono({ 
  subsets: ["latin"],
  variable: '--font-roboto-mono'
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ['400', '500'],
  variable: '--font-noto-sans-kr'
});

const SITE_URL = "https://witchsterminal.dev";
const NOINDEX = process.env.NEXT_PUBLIC_NOINDEX === "true";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "WITCH'S TERMINAL",
  description: "by Coding witch",
  applicationName: "WITCH'S TERMINAL",
  alternates: { canonical: "/" },
  robots: NOINDEX
    ? { index: false, follow: false }
    : { index: true, follow: true },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "WITCH'S TERMINAL",
    title: "WITCH'S TERMINAL",
    description: "by Coding witch",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "WITCH'S TERMINAL",
    description: "by Coding witch",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${robotoMono.variable} ${notoSansKr.variable} font-kr bg-black flex flex-col items-center overflow-hidden`}
        style={{
          position: 'fixed',
          top: 'var(--app-top, 0px)',
          left: 0,
          right: 0,
          height: 'var(--app-h, 100svh)',
          paddingTop: 'max(env(safe-area-inset-top), 8px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <ViewportHeight />
        <main className="flex-1 min-h-0 w-full overflow-hidden px-4 py-2">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}