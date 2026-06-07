'use client';
import { useEffect } from 'react';

// iOS 등에서 키보드가 열리면 visualViewport 높이가 줄어든다.
// 그 높이를 --app-h CSS 변수에 반영해 레이아웃이 키보드 위로 맞춰지고,
// 키보드를 닫으면 원래대로 복원되도록 한다. (100dvh + 키보드 깨짐 방지)
export default function ViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const set = () => {
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
    };
    set();
    vv?.addEventListener('resize', set);
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);
    return () => {
      vv?.removeEventListener('resize', set);
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
    };
  }, []);
  return null;
}
