import { useState, useEffect } from 'react';

export function useInputMode() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleTouch = () => setIsMobile(true);
    const handleKeydown = () => setIsMobile(false);

    window.addEventListener('touchstart', handleTouch);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return isMobile;
}