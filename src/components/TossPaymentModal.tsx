'use client';
import Script from 'next/script';
import { useEffect, useRef, useState, useCallback } from 'react';
import { REFUND } from '@/lib/legalDocs';

const FONT = 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace';
const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
// Toss Payments SDK v2 (결제위젯) — CDN이 window.TossPayments로 주입
const TOSS_SCRIPT_SRC = 'https://js.tosspayments.com/v2/standard';

// v2 결제위젯 인스턴스 타입
type TossWidgets = {
  setAmount: (amount: { currency: string; value: number }) => Promise<void>;
  renderPaymentMethods: (opts: { selector: string; variantKey?: string }) => Promise<unknown>;
  renderAgreement: (opts: { selector: string; variantKey?: string }) => Promise<unknown>;
  requestPayment: (opts: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
  }) => Promise<void>;
};
type TossPaymentsInstance = {
  widgets: (opts: { customerKey: string }) => TossWidgets;
};
type TossPaymentsFn = ((clientKey: string) => TossPaymentsInstance) & { ANONYMOUS: string };

export const TOSS_PACKAGES = [
  { id: 1, tokens: 3,  amount: 990,  label: '3토큰   —   990원',  name: "WITCH'S TERMINAL 3토큰" },
  { id: 2, tokens: 15, amount: 4450, label: '15토큰  —  4,450원', name: "WITCH'S TERMINAL 15토큰" },
  { id: 3, tokens: 30, amount: 8910, label: '30토큰  —  8,910원', name: "WITCH'S TERMINAL 30토큰" },
] as const;

type Props = {
  packageId: number;
  userId: string;
  onClose: () => void;
};

export default function TossPaymentModal({ packageId, userId, onClose }: Props) {
  const pkg = TOSS_PACKAGES.find(p => p.id === packageId)!;
  const widgetRef = useRef<TossWidgets | null>(null);
  const mountedRef = useRef(true);
  const [widgetReady, setWidgetReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [refundAgreed, setRefundAgreed] = useState(false); // 청약철회(환불) 정책 필수 동의
  const [showRefund, setShowRefund] = useState(false); // 환불 정책 전문 패널 표시

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const initWidget = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const TossPayments = (window as any).TossPayments as TossPaymentsFn | undefined;

      // 진단: 어떤 SDK가 로드됐는지 / 키가 들어왔는지 콘솔로 확인 (실패 디버깅용)
      console.info('[TossPaymentModal] SDK v2 init',
        '| TossPayments:', typeof TossPayments,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        '| v1 PaymentWidget(있으면 캐시):', typeof (window as any).PaymentWidget,
        '| CLIENT_KEY prefix:', (CLIENT_KEY || '(EMPTY)').slice(0, 17));

      if (!TossPayments) {
        console.error('[TossPaymentModal] window.TossPayments not found after script load');
        if (mountedRef.current) {
          setError('결제 모듈을 찾을 수 없다. 페이지를 새로고침하라.');
          setLoading(false);
        }
        return;
      }

      const tossPayments = TossPayments(CLIENT_KEY);
      const widgets = tossPayments.widgets({
        customerKey: userId || TossPayments.ANONYMOUS,
      });

      await widgets.setAmount({ currency: 'KRW', value: pkg.amount });
      await widgets.renderPaymentMethods({ selector: '#toss-payment-methods', variantKey: 'DEFAULT' });
      await widgets.renderAgreement({ selector: '#toss-payment-agreement', variantKey: 'AGREEMENT' });

      if (mountedRef.current) {
        widgetRef.current = widgets;
        setWidgetReady(true);
        setLoading(false);
      }
    } catch (e) {
      console.error('[TossPaymentModal]', e);
      if (mountedRef.current) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`오류: ${msg}`);
        setLoading(false);
      }
    }
  }, [pkg.amount, userId]);

  // 스크립트가 이미 로드되어 있으면 onLoad를 기다리지 않고 즉시 초기화
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).TossPayments) {
      initWidget();
    }
  }, [initWidget]);

  const handlePay = async () => {
    if (!widgetRef.current || paying || !refundAgreed) return;
    setPaying(true);
    setError('');

    const orderId = `ct-${packageId}-${Date.now()}`;

    // 리다이렉트 전 beforeunload 경고 억제
    window.sessionStorage.setItem('safe_leave', 'true');

    try {
      await widgetRef.current.requestPayment({
        orderId,
        orderName: pkg.name,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
      // requestPayment는 리다이렉트 → 여기까지 오면 취소됨
      window.sessionStorage.removeItem('safe_leave');
    } catch (e: unknown) {
      window.sessionStorage.removeItem('safe_leave');
      const err = e as { code?: string };
      if (err?.code === 'USER_CANCEL') {
        setError('결제가 취소되었다.');
      } else {
        setError('결제 요청 실패. 다시 시도하라.');
        console.error('[TossPaymentModal pay]', e);
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <Script
        src={TOSS_SCRIPT_SRC}
        strategy="afterInteractive"
        onLoad={initWidget}
        onError={() => {
          if (mountedRef.current) {
            setError('결제 스크립트 로드 실패. 네트워크 연결을 확인하라.');
            setLoading(false);
          }
        }}
      />
      <div style={{
        position: 'fixed',
        top: 'var(--app-top, 0px)',
        left: 0,
        right: 0,
        height: 'var(--app-h, 100dvh)',
        zIndex: 9999,
        background: 'rgba(0,0,0,0.96)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: FONT,
        padding: '16px',
      }}>
        <div style={{
          width: '100%', maxWidth: '420px',
          maxHeight: '100%',
          border: '1px solid #00FF41',
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* 헤더 (고정) */}
          <div style={{
            flexShrink: 0,
            borderBottom: '1px solid rgba(0,255,65,0.25)',
            padding: '14px 20px',
            color: 'rgba(0,255,65,0.5)',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>▶ TOKEN_CHARGE</span>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'rgba(0,255,65,0.4)', cursor: 'pointer', fontFamily: FONT, fontSize: '12px' }}
            >
              [취소]
            </button>
          </div>

          {/* 패키지 정보 (고정) */}
          <div style={{ flexShrink: 0, padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
            <div style={{ color: '#00FF41', fontSize: '16px' }}>{pkg.label}</div>
            <div style={{ color: 'rgba(0,255,65,0.4)', fontSize: '11px', marginTop: '4px' }}>
              결제 즉시 지급된다.
            </div>
          </div>

          {/* 토스 위젯 영역 (스크롤) — 결제 버튼은 아래에 항상 고정 */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px' }}>
            {loading && (
              <div style={{ color: 'rgba(0,255,65,0.5)', fontSize: '12px', padding: '20px', textAlign: 'center' }}>
                결제 모듈 로드 중...
              </div>
            )}
            <div id="toss-payment-methods" />
            <div id="toss-payment-agreement" />
          </div>

          {/* 푸터 (하단 고정): 에러 + 결제 버튼 — 스크롤과 무관하게 항상 보인다 */}
          <div style={{ flexShrink: 0, borderTop: '1px solid rgba(0,255,65,0.2)' }}>
            {error && (
              <div style={{ color: '#FF3300', fontSize: '12px', padding: '8px 20px 0', fontFamily: FONT }}>
                ■ {error}
              </div>
            )}
            {widgetReady && (
              <div style={{ padding: '12px 20px 20px' }}>
                {/* 청약철회(환불) 정책 필수 동의 */}
                <div style={{ marginBottom: '12px' }}>
                  <button
                    onClick={() => setRefundAgreed(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '6px',
                      background: 'transparent', border: 'none', padding: 0,
                      color: '#00FF41', fontFamily: FONT, fontSize: '12px',
                      lineHeight: 1.5, textAlign: 'left', cursor: 'pointer', width: '100%',
                    }}
                  >
                    <span style={{ flexShrink: 0 }}>{refundAgreed ? '[x]' : '[ ]'}</span>
                    <span>[필수] 구매 조건 확인 및 청약철회(환불) 정책에 동의한다. 디지털 콘텐츠를 이용(토큰 사용)하면 환불이 제한된다.</span>
                  </button>
                  <button
                    onClick={() => setShowRefund(true)}
                    style={{ background: 'transparent', border: 'none', padding: '4px 0 0 18px', color: 'rgba(0,255,65,0.6)', fontFamily: FONT, fontSize: '11px', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    청약철회정책 전문 보기
                  </button>
                </div>
                <button
                  onClick={handlePay}
                  disabled={paying || !refundAgreed}
                  style={{
                    width: '100%',
                    background: (paying || !refundAgreed) ? 'rgba(0,255,65,0.4)' : '#00FF41',
                    color: '#000',
                    border: 'none',
                    padding: '13px',
                    fontFamily: FONT,
                    fontSize: '15px',
                    fontWeight: 'bold',
                    cursor: (paying || !refundAgreed) ? 'default' : 'pointer',
                    letterSpacing: '0.04em',
                  }}
                >
                  {paying ? '결제 진행 중...' : !refundAgreed ? '약관 동의 후 결제 가능' : `${pkg.tokens}토큰 결제하기`}
                </button>
              </div>
            )}
          </div>

          {/* 청약철회정책 전문 패널 (모달 내 오버레이) */}
          {showRefund && (
            <div style={{ position: 'absolute', inset: 0, background: '#000', zIndex: 3, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                flexShrink: 0, borderBottom: '1px solid rgba(0,255,65,0.25)',
                padding: '14px 20px', color: 'rgba(0,255,65,0.5)', fontSize: '12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>▶ 청약철회정책</span>
                <button
                  onClick={() => setShowRefund(false)}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(0,255,65,0.4)', cursor: 'pointer', fontFamily: FONT, fontSize: '12px' }}
                >
                  [닫기]
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', color: '#00FF41', fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {REFUND}
              </div>
                            {/* 하단 동의 + 닫기 — 우상단 [닫기]가 잘 안 보일 때 사용 */}
              <div style={{
                flexShrink: 0, borderTop: '1px solid rgba(0,255,65,0.25)',
                padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
              }}>
                <button
                  onClick={() => { setRefundAgreed(true); setShowRefund(false); }}
                  style={{ background: 'transparent', border: 'none', padding: '8px 0', color: '#00FF41', fontFamily: FONT, fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {refundAgreed ? '[x]' : '[ ]'} 동의
                </button>
                <button
                  onClick={() => setShowRefund(false)}
                  style={{ background: 'transparent', border: 'none', padding: '8px 12px', color: 'rgba(0,255,65,0.7)', fontFamily: FONT, fontSize: '14px', cursor: 'pointer' }}
                >
                  닫기 ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
