'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Wallet, User, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { authenticated, login, user } = usePrivy();
  const username = useAppStore((s) => s.username);
  const setUsername = useAppStore((s) => s.setUsername);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const walletConnected = authenticated && !!user?.wallet?.address;
  const hasUsername = !!username;

  if (walletConnected && hasUsername) {
    return <>{children}</>;
  }

  const handleSetUsername = () => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (trimmed.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError('Only letters, numbers, and underscores allowed');
      return;
    }
    setError('');
    setUsername(trimmed);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] max-md:min-h-[calc(100dvh-5rem)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md mx-auto"
      >
        <div className="rounded-2xl border border-[var(--border)]/40 bg-[var(--card)]/20 backdrop-blur-xl p-8 shadow-xl">
          <h2 className="font-serif text-2xl font-bold text-[var(--foreground)] mb-2">
            Welcome to Vocaweb
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-8">
            Connect your wallet and choose a username to get started.
          </p>

          <div className="space-y-4">
            {/* Step 1: Connect Wallet */}
            <div
              className={`rounded-xl border p-4 transition-all duration-300 ${
                walletConnected
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-[var(--border)]/40 bg-[var(--card)]/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    walletConnected
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-[var(--primary)]/10 text-[var(--primary)]'
                  }`}
                >
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Connect Wallet
                  </p>
                  {walletConnected ? (
                    <p className="text-xs text-green-500 font-medium">
                      {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Solana wallet required
                    </p>
                  )}
                </div>
                {!walletConnected && (
                  <button
                    onClick={() => login({ loginMethods: ['wallet'] })}
                    className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    Connect
                  </button>
                )}
                {walletConnected && (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Choose Username */}
            <AnimatePresence>
              {walletConnected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-[var(--border)]/40 bg-[var(--card)]/10 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--primary)]/10 text-[var(--primary)]">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          Choose Username
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          This will be your identity on Vocaweb
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value);
                          setError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
                        placeholder="e.g. Alex_dev"
                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)]/40 bg-[var(--background)]/50 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                      />
                      <button
                        onClick={handleSetUsername}
                        className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
                      >
                        Go
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {error && (
                      <p className="text-xs text-red-400 mt-2">{error}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-xs text-[var(--muted-foreground)]/60 mt-6 text-center">
            No fees. Just connect and start building.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
