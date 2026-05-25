import { useState } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { 
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function LoginInline() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (!result.user.emailVerified) {
        setError('Please verify your email before logging in.');
        await auth.signOut();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
  <div className="text-center">
    <h3 className="text-lg font-bold text-white mb-1">Login to your account</h3>
    <p className="text-xs text-white/40">Securely book with your saved details</p>
  </div>

  <div
    onKeyDown={(e) => { if (e.key === 'Enter') handleEmailLogin(e as any); }}
    className="space-y-4"
  >
    {error && (
      <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] p-3 rounded-lg flex items-center gap-2">
        <AlertCircle size={14} />
        {error}
      </div>
    )}

    {/* Desktop: inline row | Mobile: stacked column */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
      <div className="relative flex-1">
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={16} />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-gold outline-none text-sm transition-all text-white placeholder:text-white/20"
          placeholder="Email address"
        />
      </div>

      <div className="relative flex-1">
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={16} />
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-gold outline-none text-sm transition-all text-white placeholder:text-white/20"
          placeholder="Password"
        />
      </div>

      <button
        type="button"
        onClick={handleEmailLogin}
        disabled={loading}
        className="w-full sm:w-auto bg-gold text-black px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? 'Processing...' : 'Login'}
      </button>
    </div>
  </div>
</div>
  );
}
