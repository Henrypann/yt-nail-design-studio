/**
 * Email + Mock 验证码块 · 登录页与注册 Step 1 共用（PRD §2.1 / §3.2）
 *
 * 覆盖异常态：发送失败（Mock 面板注入）/ 错误剩余次数 / 3 次锁定 5 分钟倒计时 /
 * 过期 / 未先取码。固定码 123456，标注「不发送邮件、不保存密码 · MOCK」。
 */

import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Input, cx } from '@/design-system';
import { useToast } from '@/design-system';
import { isScenarioOn, useMockScenarios } from '@/lib/mock-panel';
import { useLocale } from '@/lib/i18n';
import { isValidEmail } from './accounts';
import {
  cooldownRemainingSec,
  requestCode,
  verifyCode,
} from './auth-codes';

function formatLock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CodeVerification(props: {
  /** 验证通过回调（父层决定跳转/进入下一步） */
  onVerified: (email: string) => void;
  /** 外部预填邮箱（如注册页从登录流转带入，锁定不可改） */
  initialEmail?: string;
  emailReadOnly?: boolean;
  verifyLabel?: string;
}) {
  const toast = useToast();
  const { t } = useLocale();
  const flags = useMockScenarios((s) => s.flags);

  const [email, setEmail] = useState(props.initialEmail ?? '');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0); // 秒
  const [lockMs, setLockMs] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef<number | null>(null);

  // 冷却/锁定倒计时（1s tick）
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
      setLockMs((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  const handleSend = () => {
    if (!isValidEmail(email)) {
      setEmailError(t('platform.emailInvalid'));
      return;
    }
    setEmailError(null);
    setSending(true);
    // 模拟网络耗时
    window.setTimeout(() => {
      setSending(false);
      const result = requestCode(email.trim().toLowerCase(), {
        forceFail: isScenarioOn(flags, 'auth.sendFail'),
      });
      if (!result.ok && result.reason === 'locked') {
        setLockMs(result.lockedUntil - Date.now());
        toast.error(t('platform.attemptsLocked'));
        return;
      }
      if (!result.ok && result.reason === 'sendFail') {
        setCooldown(cooldownRemainingSec(email.trim().toLowerCase()));
        toast.error(t('platform.codeSendFailed'));
        return;
      }
      setCooldown(cooldownRemainingSec(email.trim().toLowerCase()));
      setCodeError(null);
      toast.info(t('platform.codeSent'));
    }, 400);
  };

  const handleVerify = () => {
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setEmailError(t('platform.emailInvalid'));
      return;
    }
    if (code.trim() === '') {
      setCodeError(t('platform.codeNeedSend'));
      return;
    }
    setVerifying(true);
    window.setTimeout(() => {
      setVerifying(false);
      const result = verifyCode(normalized, code, {
        forceExpired: isScenarioOn(flags, 'auth.codeExpired'),
      });
      if (result.ok) {
        toast.success(t('platform.verified'));
        props.onVerified(normalized);
        return;
      }
      switch (result.reason) {
        case 'locked':
          setLockMs(result.lockedUntil - Date.now());
          toast.error(t('platform.accountLocked'));
          break;
        case 'justLocked':
          setLockMs(result.lockedUntil - Date.now());
          setCodeError(t('platform.codeLocked'));
          toast.error(t('platform.codeLocked'));
          break;
        case 'wrong':
          setCodeError(t('platform.codeRemaining', { remaining: result.remaining }));
          toast.warning(t('platform.codeRemaining', { remaining: result.remaining }));
          break;
        case 'expired':
          setCodeError(t('platform.codeExpired'));
          toast.error(t('platform.codeExpired'));
          break;
        case 'noCode':
          setCodeError(t('platform.codeNeedSend'));
          break;
      }
    }, 400);
  };

  const locked = lockMs > 0;

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cx(
          'flex items-center gap-2 rounded-panel border border-warning/30 bg-warning-soft px-3 py-2',
        )}
      >
        <Badge variant="warning">MOCK</Badge>
        <p className="text-xs text-gray-600">
          {t('platform.codeMockHint')}
        </p>
      </div>

      <Input
        label={t('platform.email')}
        type="email"
        placeholder={t('platform.emailPlaceholder')}
        value={email}
        readOnly={props.emailReadOnly}
        disabled={props.emailReadOnly}
        error={emailError ?? undefined}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) setEmailError(null);
        }}
      />

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label={t('platform.verificationCode')}
            inputMode="numeric"
            maxLength={6}
            placeholder={t('platform.codePlaceholder')}
            value={code}
            error={codeError ?? undefined}
            onChange={(e) => {
              setCode(e.target.value);
              if (codeError) setCodeError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleVerify();
            }}
          />
        </div>
        <Button
          variant="secondary"
          onClick={handleSend}
          loading={sending}
          disabled={locked || cooldown > 0 || props.emailReadOnly !== true && !email}
          className="shrink-0"
        >
          {cooldown > 0 ? t('platform.getCodeAgain', { seconds: cooldown }) : t('platform.getCode')}
        </Button>
      </div>

      {locked && (
        <p className="rounded-panel border border-error/30 bg-error-soft px-3 py-2 text-xs text-error">
          {t('platform.codeLockedCountdown', { time: formatLock(lockMs) })}
        </p>
      )}

      <Button onClick={handleVerify} loading={verifying} disabled={locked}>
        {props.verifyLabel ?? t('platform.verify')}
      </Button>
    </div>
  );
}
