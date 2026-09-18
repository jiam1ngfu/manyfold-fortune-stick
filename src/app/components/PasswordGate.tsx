/**
 * Shown when the deployment has ADMIN_PASSWORD set and this browser has not
 * provided it (or provided a wrong one). The password lives in sessionStorage —
 * gone when the tab closes, never in a cookie, never in a URL.
 */

import { useState } from 'react';
import { setStoredPassword } from '../api';

export default function PasswordGate(props: { onSubmitted: () => Promise<void> }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setStoredPassword(value.trim());
    await props.onSubmitted();
    setSubmitting(false);
    setTouched(true);
  };

  return (
    <div className="overlay">
      <form className="dialog" onSubmit={(event) => void submit(event)}>
        <h2>需要管理密码</h2>
        <p className="muted">
          这个部署设置了 <code>ADMIN_PASSWORD</code>，输入后才能继续。
        </p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="管理密码"
          aria-label="管理密码"
        />
        {touched && <div className="notice error">密码不对。</div>}
        <button className="text-action strong" type="submit" disabled={submitting || !value.trim()}>
          {submitting ? '检查中…' : '解锁'}
        </button>
      </form>
    </div>
  );
}
