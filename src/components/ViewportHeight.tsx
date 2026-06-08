'use client';
import { useEffect } from 'react';

// 키보드가 열리면 visualViewport 높이가 줄고(--app-h), 인앱 브라우저(인스타 등)에서는
// 문서가 위로 스크롤되며 visualViewport.offsetTop이 커진다.
// 두 값을 CSS 변수로 반영하고, body를 position:fixed로 그 영역에 정확히 맞춰
// 터미널이 밀려 올라가지 않고 입력창이 키보드 바로 위에 고정되도록 한다.
export default function ViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const set = () => {
      const h = vv ? vv.height : window.innerHeight;
      const top = vv ? vv.offsetTop : 0;
      root.style.setProperty('--app-h', `${Math.round(h)}px`);
      root.style.setProperty('--app-top', `${Math.round(top)}px`);
    };
    set();
    vv?.addEventListener('resize', set);
    vv?.addEventListener('scroll', set);
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);
    return () => {
      vv?.removeEventListener('resize', set);
      vv?.removeEventListener('scroll', set);
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
    };
  }, []);
  return null;
}
