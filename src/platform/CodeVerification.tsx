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
      setEmailError('请输入有效的邮箱地址');
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
        toast.error('尝试次数过多，账号已临时锁定。请稍后再试。');
        return;
      }
      if (!result.ok && result.reason === 'sendFail') {
        setCooldown(cooldownRemainingSec(email.trim().toLowerCase()));
        toast.error('验证码发送失败，请重试。');
        return;
      }
      setCooldown(cooldownRemainingSec(email.trim().toLowerCase()));
      setCodeError(null);
      toast.info('验证码已发送（Mock：固定验证码 123456）。');
    }, 400);
  };

  const handleVerify = () => {
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setEmailError('请输入有效的邮箱地址');
      return;
    }
    if (code.trim() === '') {
      setCodeError('请输入验证码');
      return;
    }
    setVerifying(true);
    window.setTimeout(() => {
      setVerifying(false);
      const result = verifyCode(normalized, code, {
        forceExpired: isScenarioOn(flags, 'auth.codeExpired'),
      });
      if (result.ok) {
        toast.success('验证成功。');
        props.onVerified(normalized);
        return;
      }
      switch (result.reason) {
        case 'locked':
          setLockMs(result.lockedUntil - Date.now());
          toast.error('账号已锁定，请稍后再试。');
          break;
        case 'justLocked':
          setLockMs(result.lockedUntil - Date.now());
          setCodeError('验证码连续错误 3 次，已锁定 5 分钟。');
          toast.error('验证码连续错误 3 次，已锁定 5 分钟。');
          break;
        case 'wrong':
          setCodeError(`验证码错误，你还剩 ${result.remaining} 次尝试。`);
          toast.warning(`验证码错误，你还剩 ${result.remaining} 次尝试。`);
          break;
        case 'expired':
          setCodeError('验证码已过期，请重新获取。');
          toast.error('验证码已过期，请重新获取。');
          break;
        case 'noCode':
          setCodeError('请先获取验证码。');
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
          不发送邮件、不保存密码 · 原型固定验证码 123456
        </p>
      </div>

      <Input
        label="邮箱"
        type="email"
        placeholder="you@example.com"
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
            label="验证码"
            inputMode="numeric"
            maxLength={6}
            placeholder="6 位数字验证码"
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
          {cooldown > 0 ? `重新获取 (${cooldown}s)` : '获取验证码'}
        </Button>
      </div>

      {locked && (
        <p className="rounded-panel border border-error/30 bg-error-soft px-3 py-2 text-xs text-error">
          验证码连续错误 3 次，已锁定。请 {formatLock(lockMs)} 后重试。
        </p>
      )}

      <Button onClick={handleVerify} loading={verifying} disabled={locked}>
        {props.verifyLabel ?? '验证'}
      </Button>
    </div>
  );
}
