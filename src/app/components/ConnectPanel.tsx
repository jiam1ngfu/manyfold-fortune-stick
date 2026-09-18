/**
 * Device-code handshake against Manyfold: we open their consent page in a popup
 * and poll our own worker, which holds the device code. Tokens are minted on
 * Manyfold's side at poll time and land encrypted in D1 — they never reach the
 * browser, so nothing here ever holds a credential.
 *
 * The userCode is displayed prominently on purpose: comparing it against the code
 * on Manyfold's page is the flow's only anti-phishing check.
 */

import { useEffect, useRef, useState } from 'react';
import type { ConnectSession, PollOutcome } from '../../shared/types';
import { api } from '../api';

export default function ConnectPanel(props: {
  /** In-flight handshake recovered from /api/state, so a reload resumes it. */
  initialSession: ConnectSession | null;
  onConnected: () => Promise<void>;
}) {
  const [session, setSession] = useState<ConnectSession | null>(props.initialSession);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PollOutcome | null>(null);
  const popup = useRef<Window | null>(null);

  const openConsent = (url: string) => {
    popup.current = window.open(url, 'manyfold-connect', 'width=520,height=760,noopener,noreferrer');
    if (!popup.current) {
      setError('The popup was blocked — use "重新打开授权页面" below.');
    }
  };

  const start = async () => {
    setStarting(true);
    setError('');
    setResult(null);
    try {
      const started = await api<{ connect: ConnectSession }>('/api/connect', { method: 'POST' });
      setSession(started.connect);
      openConsent(started.connect.authUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    const current = session;
    setSession(null);
    popup.current?.close();
    if (current) {
      await api(`/api/connect/${encodeURIComponent(current.connectId)}`, { method: 'DELETE' }).catch(
        () => undefined,
      );
    }
  };

  // Polls while a session is live. Manyfold's session TTL is ~15 minutes; the
  // interval stops on any terminal status so an abandoned popup goes quiet.
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    const tick = async () => {
      try {
        const poll = await api<PollOutcome>(
          `/api/connect/${encodeURIComponent(session.connectId)}/poll`,
          { method: 'POST' },
        );
        if (stopped || poll.status === 'pending') return;
        setResult(poll);
        setSession(null);
        popup.current?.close();
        if (poll.status === 'approved') await props.onConnected();
      } catch (cause) {
        if (stopped) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setSession(null);
      }
    };
    const timer = setInterval(() => void tick(), 2_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session, props.onConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="connect-panel">
      {!session && (
        <button className="text-action strong" onClick={() => void start()} disabled={starting}>
          {starting ? '打开中…' : '连接 Manyfold agent'}
        </button>
      )}

      {session && (
        <div className="connect-waiting">
          <div className="connect-code">
            <small>确认码</small>
            <strong>{session.userCode}</strong>
          </div>
          <p className="muted">
            批准前先确认 Manyfold 页面上显示的是同一个码 —— 这是确认你授权的是<em>这个</em>应用的唯一方式。
          </p>
          <p className="muted">等待你在 Manyfold 上批准…</p>
          <div className="row">
            <button className="text-action" onClick={() => openConsent(session.authUrl)}>
              重新打开授权页面
            </button>
            <button className="text-action danger" onClick={() => void cancel()}>
              取消
            </button>
          </div>
        </div>
      )}

      {!session && !result && (
        <p className="muted">
          会弹出 Manyfold 的页面，在那里挑选要分享给这个应用的 agent。
        </p>
      )}

      {result?.status === 'denied' && <div className="notice error">你在 Manyfold 上拒绝了这次请求。</div>}
      {result?.status === 'expired' && (
        <div className="notice error">这次授权已经过期，重新来一次。</div>
      )}
      {result?.status === 'approved' && (
        <div className="connect-result">
          <strong>
            {result.agents?.length
              ? `已连接 ${result.agents.length} 个 agent`
              : '已批准，但没有分享任何 agent'}
          </strong>
          {(result.agents ?? []).map((agent) => (
            <div className="connect-result-row" key={agent.agentId}>
              <span>✓ {agent.name}</span>
              {!agent.verified && (
                <em className="warn">未验证{agent.warning ? ` — ${agent.warning}` : ''}</em>
              )}
            </div>
          ))}
          {(result.failed ?? []).map((entry) => (
            <div className="connect-result-row failed" key={entry.name}>
              <span>✗ {entry.name}</span>
              <em className="warn">{entry.error}</em>
            </div>
          ))}
        </div>
      )}

      {error && <div className="notice error">{error}</div>}
    </div>
  );
}
