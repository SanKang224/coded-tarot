import type { Metadata } from "next";
import { Roboto_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const robotoMono = Roboto_Mono({ 
  subsets: ["latin"],
  variable: '--font-roboto-mono'
});

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ['400', '500'],
  variable: '--font-noto-sans-kr'
});

export const metadata: Metadata = {
  title: "CODED-TAROT",
  description: "by Coding witch",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      {/* 바깥 스크롤이 발생하지 않도록 overflow-hidden 추가 */}
      <body className={`${robotoMono.variable} ${notoSansKr.variable} font-kr bg-black min-h-[100dvh] w-full flex items-start justify-center overflow-y-auto`}>
        {children}
      </body>
    </html>
  );
}