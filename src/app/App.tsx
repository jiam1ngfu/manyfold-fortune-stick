/**
 * 外壳：加载一次 /api/state，用 location.hash 在三个页面之间切换（没有 router 依赖），
 * 并在部署设了密码而本浏览器还没给出时升起密码门。
 *
 * 外壳自己几乎不占地方 —— 一行牌记、一行页脚，中间全是机器和纸。宽屏上两侧再立
 * 两条竖排的铭牌，把版面撑开，免得所有东西挤在中间一小条里（窄屏不显示）。
 *
 * 设置页只留 URL 入口（#settings），主界面上不放按钮 —— 它是部署者用的，
 * 不是玩家流程的一部分。
 */

import { useCallback, useEffect, useState } from 'react';
import type { AppState } from '../shared/types';
import { api, onUnauthorized } from './api';
import FortuneGame from './components/FortuneGame';
import HistoryView from './components/HistoryView';
import PasswordGate from './components/PasswordGate';
import SettingsView from './components/SettingsView';
import { getPrefs, setPrefs, type Prefs } from './storage';

type Route = 'game' | 'history' | 'settings';

const routeFromHash = (): Route => {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash === 'settings') return 'settings';
  if (hash === 'history') return 'history';
  return 'game';
};

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [gateOpen, setGateOpen] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(() => getPrefs());

  const refreshState = useCallback(async () => {
    try {
      const next = await api<AppState>('/api/state');
      setState(next);
      setLoadError('');
      setGateOpen(next.adminRequired && !next.adminOk);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    onUnauthorized(() => setGateOpen(true));
    void refreshState();
    return () => onUnauthorized(null);
  }, [refreshState]);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const updatePrefs = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    setPrefs(next);
  };

  if (loadError) {
    return (
      <main className="shell">
        <p className="stage-loading">
          连不上服务：{loadError}{' '}
          <button type="button" className="text-action" onClick={() => void refreshState()}>
            重试
          </button>
        </p>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="shell">
        <p className="stage-loading">正在预热打印机…</p>
      </main>
    );
  }

  return (
    <main className={`shell${prefs.reducedMotion ? ' calm' : ''}`}>
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-chips" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="brand-name">问一签</span>
          <span className="brand-sub">FORTUNE PRINTER</span>
        </a>
        <a className="text-action" href={route === 'game' ? '#history' : '#/'}>
          {route === 'game' ? '求签记录' : '回到求签'}
        </a>
      </header>

      {route === 'settings' && (
        <SettingsView
          agents={state.agents}
          initialSession={state.connect.session}
          refreshState={refreshState}
        />
      )}
      {route === 'history' && <HistoryView />}
      {route === 'game' && (
        <FortuneGame prefs={prefs} interpreterReady={state.interpreterReady} />
      )}

      <span className="rail rail-left" aria-hidden>
        MODEL WY-36 · MADE IN CHINA
      </span>
      <span className="rail rail-right" aria-hidden>
        三 十 六 签 · 一 问 一 答
      </span>

      <footer className="footer">
        <button
          type="button"
          className="text-action tiny"
          aria-pressed={prefs.sound}
          onClick={() => updatePrefs({ sound: !prefs.sound })}
        >
          声音{prefs.sound ? '开' : '关'}
        </button>
        <button
          type="button"
          className="text-action tiny"
          aria-pressed={prefs.reducedMotion}
          onClick={() => updatePrefs({ reducedMotion: !prefs.reducedMotion })}
        >
          动画{prefs.reducedMotion ? '已减少' : '正常'}
        </button>
        <span className="footer-note">签为参考，路要自己走</span>
      </footer>

      {gateOpen && <PasswordGate onSubmitted={refreshState} />}
    </main>
  );
}
