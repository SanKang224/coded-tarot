import type { Metadata } from "next";
import { Roboto_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";

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
  title: "WITCH'S TERMINAL",
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
      {/* 바깥(페이지)은 스크롤 금지 — 스크롤은 터미널 내부에서만. 사업자정보 푸터는 하단 고정 */}
      <body className={`${robotoMono.variable} ${notoSansKr.variable} font-kr bg-black h-[100dvh] w-full flex flex-col items-center overflow-hidden`}>
        <main className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden py-2">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}