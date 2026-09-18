/**
 * 设置页，只通过 #settings 这个 URL 进入，主界面上没有入口 —— 它给部署这个游戏的人用，
 * 不是玩家流程的一部分。
 *
 * 这里管理解签用的 Manyfold agent：看状态、重跑（免费的）鉴权探测、断开、再连。
 * 重新授权一个已经连着的 agent 会就地换掉它的 token，不会多出一条。
 */

import { useState } from 'react';
import type { ConnectedAgent, ConnectSession } from '../../shared/types';
import { api } from '../api';
import ConnectPanel from './ConnectPanel';

export default function SettingsView(props: {
  agents: ConnectedAgent[];
  initialSession: ConnectSession | null;
  refreshState: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const verify = async (agentId: string) => {
    setBusyId(agentId);
    setError('');
    try {
      await api(`/api/agents/${encodeURIComponent(agentId)}/verify`, { method: 'POST' });
      await props.refreshState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (agentId: string) => {
    setBusyId(agentId);
    setError('');
    try {
      await api(`/api/agents/${encodeURIComponent(agentId)}`, { method: 'DELETE' });
      setConfirmId(null);
      await props.refreshState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel">
      <h2>设置</h2>
      <p className="muted small">
        这一页只有 <code>#settings</code> 这个地址能进，游戏界面上不显示入口。
      </p>

      <h3>解签用的 agent</h3>
      {props.agents.length === 0 && (
        <p className="muted">还没有连接 agent。连一个之后，「解签」才能结合用户的问题作答。</p>
      )}
      {props.agents.length > 1 && (
        <p className="muted small">连了多个时，解签会自动用第一个已验证且未过期的。</p>
      )}

      <div className="agent-list">
        {props.agents.map((agent) => (
          <div className="agent-card" key={agent.agentId}>
            <div className="agent-card-main">
              <div className="agent-card-title">
                <strong>{agent.name}</strong>
                {agent.verified ? (
                  <span className="badge ok">已验证</span>
                ) : (
                  <span className="badge warn" title={agent.warning ?? undefined}>
                    未验证
                  </span>
                )}
              </div>
              {agent.description && <p className="muted">{agent.description}</p>}
              <p className="muted small">
                {new URL(agent.rpcUrl).host} · 连接于 {new Date(agent.connectedAt).toLocaleString()}
                {agent.expiresAt ? ` · 授权到期 ${new Date(agent.expiresAt).toLocaleString()}` : ''}
              </p>
              {agent.warning && <p className="warn small">⚠ {agent.warning}</p>}
            </div>
            <div className="agent-card-actions">
              <button
                className="text-action"
                onClick={() => void verify(agent.agentId)}
                disabled={busyId === agent.agentId}
              >
                {busyId === agent.agentId ? '检查中…' : '重新验证'}
              </button>
              {confirmId === agent.agentId ? (
                <span className="row">
                  <button
                    className="text-action danger"
                    onClick={() => void disconnect(agent.agentId)}
                    disabled={busyId === agent.agentId}
                  >
                    确认断开
                  </button>
                  <button className="text-action" onClick={() => setConfirmId(null)}>
                    保留
                  </button>
                </span>
              ) : (
                <button className="text-action danger" onClick={() => setConfirmId(agent.agentId)}>
                  断开
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="notice error">{error}</div>}

      <h3>连接更多 agent</h3>
      <p className="muted">
        重新授权一个已经连着的 agent 会就地换掉它的 token —— 授权过期时用得上。
      </p>
      <ConnectPanel initialSession={props.initialSession} onConnected={props.refreshState} />

      <h3>关于这个部署</h3>
      <p className="muted">
        agent 的 token 以 AES-GCM 加密存在 D1 里，任何时候都不会发到浏览器。设置{' '}
        <code>ADMIN_PASSWORD</code> 可以把整个站（包括游戏）锁在密码后面，设置{' '}
        <code>CONFIG_ENCRYPTION_KEY</code> 可以让加密密钥不落库。详见 README。
      </p>
    </section>
  );
}
