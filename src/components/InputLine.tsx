import { useRef, useEffect } from 'react';

const MAX_CHARS = 400;

type InputLineProps = {
  onSubmit: (val: string) => void;
  onArrowKey?: (key: 'ArrowUp' | 'ArrowDown') => void;
  disabled?: boolean;
  allowEmpty?: boolean; // 빈 엔터 허용 (confirm 스텝에서 Y로 처리)
  focusKey?: string | number; // 값이 바뀌면 입력창을 다시 포커스 (버튼 클릭으로 포커스 뺏긴 경우 복구)
  wantKeyboard?: boolean; // 모바일에서 키보드를 자동으로 띄울지 (텍스트 입력 스텝에서만 true)
};

export default function InputLine({ onSubmit, onArrowKey, disabled, allowEmpty, focusKey, wantKeyboard = true }: InputLineProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const lastSubmitRef = useRef(0); // 중복 제출(keydown+keyup 동시 발생) 방지

  useEffect(() => {
    if (disabled) return;
    const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
    // 모바일은 텍스트 입력 스텝(wantKeyboard)에서만 키보드를 띄운다.
    // 버튼/메뉴 스텝이면 포커스를 풀어 키보드를 내린다. (입력창을 직접 탭하면 언제든 입력 가능)
    if (isTouch && !wantKeyboard) { ref.current?.blur(); return; }
    // preventScroll: 재포커스 시 브라우저가 입력창을 보이려고 화면을 스크롤(위로 밀림)하는 것을 막는다.
    ref.current?.focus({ preventScroll: true });
  }, [disabled, focusKey, wantKeyboard]);

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

  const submitValue = () => {
    const val = ref.current?.value.trim() || '';
    if (!val && !allowEmpty) return;
    // keydown과 keyup이 같은 Enter에 대해 둘 다 제출하는 것을 차단 (모바일/IME 환경 대응)
    const now = Date.now();
    if (now - lastSubmitRef.current < 120) return;
    lastSubmitRef.current = now;
    if (ref.current) {
      ref.current.value = '';
      ref.current.style.height = 'auto';
    }
    onSubmit(val);
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
      submitValue();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 모바일 키보드에서 Enter가 keydown 대신 keyup으로만 오는 경우 처리
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      const el = ref.current;
      if (el && el.value.trim() === '' && !allowEmpty) return;
      // 이미 keydown에서 처리된 경우 중복 방지 (value가 비어있으면 이미 제출됨)
      if (el && el.value !== '') {
        submitValue();
      }
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
          onKeyUp={handleKeyUp}
          onChange={handleChange}
          rows={1}
          enterKeyHint="send"
          style={{
            color: '#00FF41',
            backgroundColor: 'transparent',
            resize: 'none',
            height: 'auto',
            overflowY: 'hidden',
            lineHeight: '24px',
          }}
          className="outline-none border-none ring-0 focus:ring-0 w-full font-mono text-[16px] caret-[#00FF41] hide-scrollbar"
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
