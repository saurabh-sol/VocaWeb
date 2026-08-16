'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { Save, Moon, Sun, Monitor, User, CreditCard, Globe, Rocket, Info, Layers, LogOut } from 'lucide-react';
import { IntegrationsSettingsPanel } from '@/components/integrations/IntegrationsSettingsPanel';
import { useAppStore } from '@/store';

type SettingsTab = 'account' | 'integrations' | 'appearance';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, ready: isLoaded, logout } = usePrivy();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('account');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  const username = useAppStore((s) => s.username);

  if (!mounted || !isLoaded) return null;

  const walletAccount = user?.linkedAccounts.find(a => a.type === 'wallet');
  const hasWallet = !!walletAccount;
  const walletAddress =
    walletAccount && 'address' in walletAccount ? walletAccount.address : '';
  const displayName = username || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Vocaweb User');

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold font-serif tracking-tight">Settings</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Manage your account, deployments, and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1 space-y-1">
          <button
            onClick={() => setTab('account')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'account'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <User className="h-4 w-4" /> Account
          </button>
          <button
            onClick={() => setTab('integrations')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'integrations'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Layers className="h-4 w-4" /> Integrations
          </button>
          <button
            onClick={() => setTab('appearance')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'appearance'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Moon className="h-4 w-4" /> Appearance
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] text-sm font-medium transition-colors opacity-50 cursor-not-allowed">
            <CreditCard className="h-4 w-4" /> Billing
          </button>
        </div>

        <div className="md:col-span-3 space-y-8">
          {tab === 'integrations' && <IntegrationsSettingsPanel />}

          {tab === 'account' && (
          <>
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--card)]/10 backdrop-blur-md border border-[var(--border)]/30 rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold mb-6">Profile</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-[var(--muted)] flex items-center justify-center text-2xl font-serif border border-[var(--border)]">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-[var(--foreground)]">{displayName}</p>
                  {hasWallet && walletAddress && (
                    <p className="text-xs text-[var(--muted-foreground)] font-mono mt-1 break-all">
                      {walletAddress}
                    </p>
                  )}
                  {hasWallet && (
                    <p className="text-xs text-[var(--primary)] mt-1">Solana wallet connected</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--muted-foreground)]">Username</label>
                  <input
                    type="text"
                    value={username ?? ''}
                    readOnly
                    className="w-full bg-[var(--background)]/50 border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm opacity-80"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--muted-foreground)]">Wallet</label>
                  <input
                    type="text"
                    value={walletAddress || 'Not connected'}
                    readOnly
                    className="w-full bg-[var(--background)]/50 border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm opacity-80 font-mono text-xs"
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Connect with any Solana wallet (Phantom, Solflare, Backpack, and more).
              </p>
              <div className="pt-4 border-t border-[var(--border)]/30">
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-[var(--card)]/10 backdrop-blur-md border border-[var(--border)]/30 rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Globe className="h-5 w-5 text-[var(--primary)]" />
              Deployment & Domains
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Each project gets a subdomain when published. Set up your root domain once on Namecheap + Vercel.
            </p>
            <div className="rounded-xl border border-[var(--border)]/30 bg-[var(--background)]/30 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <Rocket className="h-4 w-4 text-[var(--primary)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">One-click publish</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Sandbox → Publish. v1 HTML sites deploy as static files; React sites build on Vercel.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="h-4 w-4 text-[var(--primary)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">User subdomain format</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    <code className="text-[var(--primary)]">mysite.drooper.xyz</code> — new
                    publishes use this automatically. Optional override:{' '}
                    <code className="text-[var(--primary)]">DEPLOY_BASE_DOMAIN</code> on Render and{' '}
                    <code className="text-[var(--primary)]">NEXT_PUBLIC_DEPLOY_BASE_DOMAIN</code> on the
                    dashboard host.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border)]/30 bg-[var(--muted)]/10 p-4 space-y-3">
                <p className="text-sm font-medium text-[var(--foreground)]">Namecheap DNS setup (one time)</p>
                <ol className="text-xs text-[var(--muted-foreground)] space-y-2 list-decimal pl-4">
                  <li>
                    Vercel → your team → <strong>Domains</strong> → add{' '}
                    <code>drooper.xyz</code> and <code>*.drooper.xyz</code> (wildcard for
                    user sites).
                  </li>
                  <li>
                    Namecheap → Domain List → Manage → <strong>Advanced DNS</strong>:
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                      <li>
                        <code>@</code> A Record → <code>76.76.21.21</code>
                      </li>
                      <li>
                        <code>www</code> CNAME → <code>cname.vercel-dns.com</code>
                      </li>
                      <li>
                        <code>*</code> CNAME → <code>cname.vercel-dns.com</code> (wildcard subdomains)
                      </li>
                    </ul>
                  </li>
                  <li>Wait 5–30 minutes for DNS. Vercel will show &quot;Valid Configuration&quot; when ready.</li>
                  <li>
                    Render backend env: <code>VERCEL_TOKEN</code>,{' '}
                    <code>DEPLOY_BASE_DOMAIN=drooper.xyz</code> (optional — this is the default)
                  </li>
                </ol>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-[var(--card)]/10 backdrop-blur-md border border-[var(--border)]/30 rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <Info className="h-5 w-5 text-[var(--primary)]" />
              Platform Limits
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              What Vocaweb builds well today — and where to set expectations.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <p className="text-sm font-medium text-green-400 mb-2">Builds well</p>
                <ul className="text-xs text-[var(--muted-foreground)] space-y-1.5 list-disc pl-4">
                  <li>Landing pages & portfolios</li>
                  <li>Marketing sites (hero, features, pricing, FAQ)</li>
                  <li>SaaS-style frontends</li>
                  <li>Small e-commerce UI (no real payments)</li>
                  <li>Next.js 15 + Tailwind 4 + TypeScript</li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm font-medium text-amber-400 mb-2">Hard limits</p>
                <ul className="text-xs text-[var(--muted-foreground)] space-y-1.5 list-disc pl-4">
                  <li>~15–30 files per project</li>
                  <li>No real backend, auth, or database</li>
                  <li>Web only — no native mobile apps</li>
                  <li>Complex 20+ route dashboards often incomplete</li>
                  <li>Deploy requires Vercel token</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-4">
              First preview may take 15–45s while dependencies install. Pre-warming on the dashboard reduces this on subsequent builds.
            </p>
          </motion.section>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-full font-medium hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
          </>
          )}

          {tab === 'appearance' && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--card)]/10 backdrop-blur-md border border-[var(--border)]/30 rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-xl font-semibold mb-6">Appearance</h2>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-[var(--primary)] bg-[var(--muted)]' : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'}`}
              >
                <Sun className="h-6 w-6" />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-[var(--primary)] bg-[var(--muted)]' : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'}`}
              >
                <Moon className="h-6 w-6" />
                <span className="text-sm font-medium">Dark</span>
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-[var(--primary)] bg-[var(--muted)]' : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'}`}
              >
                <Monitor className="h-6 w-6" />
                <span className="text-sm font-medium">System</span>
              </button>
            </div>
          </motion.section>
          )}
        </div>
      </div>
    </div>
  );
}
