import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cloudEnabled } from '../lib/supabase';
import { signIn, hasSession, onAuthChange } from '../lib/auth';

export function LoginGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(!cloudEnabled);
  const [authed, setAuthed] = useState(!cloudEnabled);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cloudEnabled) return;
    hasSession().then((yes) => {
      setAuthed(yes);
      setChecked(true);
    });
    return onAuthChange((yes) => setAuthed(yes));
  }, []);

  if (!checked) return null;
  if (authed) return <>{children}</>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signIn(username, password);
    setLoading(false);
    if (error) setError('Benutzername oder Passwort falsch.');
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center text-center">
          <img src="/myprosole-logo.png" alt="MyProSole" className="h-20 w-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-800">Projektplaner</h1>
          <p className="text-xs text-gray-400 mt-1">Bitte anmelden, um fortzufahren.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Benutzername</label>
          <input
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Passwort</label>
          <input
            type="password"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-md"
        >
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}
