'use client';
import { useEffect, useRef, useState } from 'react';
import type { PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';

const FONT = 'var(--font-roboto-mono), var(--font-noto-sans-kr), "Courier New", monospace';
const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;

export const TOSS_PACKAGES = [
  { id: 1, tokens: 3,  amount: 990,  label: '3토큰   —   990원',  name: 'CODED TAROT 3토큰' },
  { id: 2, tokens: 15, amount: 4450, label: '15토큰  —  4,450원', name: 'CODED TAROT 15토큰' },
  { id: 3, tokens: 30, amount: 8910, label: '30토큰  —  8,910원', name: 'CODED TAROT 30토큰' },
] as const;

type Props = {
  packageId: number;
  userId: string;
  onClose: () => void;
};

export default function TossPaymentModal({ packageId, userId, onClose }: Props) {
  const pkg = TOSS_PACKAGES.find(p => p.id === packageId)!;
  const widgetRef = useRef<PaymentWidgetInstance | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { loadPaymentWidget } = await import('@tosspayments/payment-widget-sdk');
        const widget = await loadPaymentWidget(CLIENT_KEY, userId);

        if (cancelled) return;

        await widget.renderPaymentMethods('#toss-payment-methods', { value: pkg.amount });
        await widget.renderAgreement('#toss-payment-agreement', { variantKey: 'AGREEMENT' });

        widgetRef.current = widget;
        setWidgetReady(true);
      } catch (e) {
        if (!cancelled) setError('결제 모듈 로드 실패. 새로고침 후 다시 시도하라.');
        console.error('[TossPaymentModal]', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pkg.amount, userId]);

  const handlePay = async () => {
    if (!widgetRef.current || paying) return;
    setPaying(true);
    setError('');

    const orderId = `ct-${packageId}-${Date.now()}`;

    try {
      await widgetRef.current.requestPayment({
        orderId,
        orderName: pkg.name,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
      // requestPayment는 리다이렉트이므로 여기까지 오면 취소된 것
    } catch (e: unknown) {
      // 사용자가 결제창 닫기 / 취소
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.96)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
      padding: '16px',
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        border: '1px solid #00FF41',
        background: '#000',
        maxHeight: '90dvh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* 헤더 */}
        <div style={{
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

        {/* 패키지 정보 */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(0,255,65,0.15)' }}>
          <div style={{ color: '#00FF41', fontSize: '16px' }}>{pkg.label}</div>
          <div style={{ color: 'rgba(0,255,65,0.4)', fontSize: '11px', marginTop: '4px' }}>
            결제 즉시 지급된다.
          </div>
        </div>

        {/* 토스 위젯 영역 */}
        <div style={{ padding: '0 12px' }}>
          {loading && (
            <div style={{ color: 'rgba(0,255,65,0.5)', fontSize: '12px', padding: '20px', textAlign: 'center' }}>
              결제 모듈 로드 중...
            </div>
          )}
          <div id="toss-payment-methods" />
          <div id="toss-payment-agreement" />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div style={{ color: '#FF3300', fontSize: '12px', padding: '0 20px 8px', fontFamily: FONT }}>
            ■ {error}
          </div>
        )}

        {/* 결제 버튼 */}
        {widgetReady && (
          <div style={{ padding: '12px 20px 20px' }}>
            <button
              onClick={handlePay}
              disabled={paying}
              style={{
                width: '100%',
                background: paying ? 'rgba(0,255,65,0.4)' : '#00FF41',
                color: '#000',
                border: 'none',
                padding: '13px',
                fontFamily: FONT,
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: paying ? 'default' : 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {paying ? '결제 진행 중...' : `${pkg.tokens}토큰 결제하기`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
