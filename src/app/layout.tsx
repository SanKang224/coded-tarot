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

export const metadata: Metadata = {
  title: "WITCH'S TERMINAL",
  description: "by Coding witch",
};

// viewportFit:cover → 노치/상태바 safe-area-inset 활성화
// interactiveWidget:resizes-content → 키보드가 레이아웃 높이를 줄이도록(지원 브라우저)
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
      {/* 바깥(페이지)은 스크롤 금지 — 스크롤은 터미널 내부에서만. 사업자정보 푸터는 하단 고정.
          height는 실제 보이는 높이(--app-h: visualViewport)로 잡아 키보드 열림/닫힘에 대응.
          safe-area 패딩으로 상태바/노치/홈인디케이터에 가리지 않게 한다. */}
      <body
        className={`${robotoMono.variable} ${notoSansKr.variable} font-kr bg-black w-full flex flex-col items-center overflow-hidden`}
        style={{
          height: 'var(--app-h, 100svh)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <ViewportHeight />
        <main className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden px-3 py-2">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}