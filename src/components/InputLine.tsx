import { useRef, useEffect } from 'react';

const MAX_CHARS = 400;

type InputLineProps = {
  onSubmit: (val: string) => void;
  onArrowKey?: (key: 'ArrowUp' | 'ArrowDown') => void;
  disabled?: boolean;
  allowEmpty?: boolean; // 빈 엔터 허용 (confirm 스텝에서 Y로 처리)
};

export default function InputLine({ onSubmit, onArrowKey, disabled, allowEmpty }: InputLineProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  // textarea 높이 자동 조절 (최대 4줄)
  const autoResize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 24; // px
    const maxHeight = lineHeight * 4;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (onArrowKey) onArrowKey(e.key);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // 한글 IME 조합 중이면 무시
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      const val = ref.current?.value.trim() || '';
      if (!val && !allowEmpty) return;
      if (ref.current) {
        ref.current.value = '';
        ref.current.style.height = 'auto';
      }
      onSubmit(val);
    }
  };

  const handleChange = () => {
    const el = ref.current;
    if (!el) return;
    // 글자 수 초과 시 자르기
    if (el.value.length > MAX_CHARS) {
      el.value = el.value.slice(0, MAX_CHARS);
    }
    autoResize();
  };

  return (
    <div className="flex items-start bg-black pt-2 pb-1 gap-2">
      <span className="text-[#00FF41] text-[16px] mt-[2px] shrink-0">{'>'}</span>
      <div className="flex-1 relative">
        <textarea
          ref={ref}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          rows={1}
          style={{
            color: '#00FF41',
            backgroundColor: 'transparent',
            resize: 'none',
            height: 'auto',
            overflowY: 'hidden',
            lineHeight: '24px',
          }}
          className="outline-none border-none ring-0 focus:ring-0 w-full font-mono text-[16px] caret-[#00FF41] hide-scrollbar"
          autoFocus
        />
        {!disabled && (
          <span
            className="inline-block w-2 h-5 bg-[#00FF41] cursor-blink"
            style={{ verticalAlign: 'text-bottom', marginLeft: '2px' }}
          />
        )}
      </div>
    </div>
  );
}
