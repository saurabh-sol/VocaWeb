# Authentication

**Purpose:** Implement secure sign-up/login/session flows.

**When to use:** When the app needs user accounts.

## Core Principles

- Use a managed auth provider (Clerk, Auth.js/NextAuth, Supabase Auth) rather than hand-rolling password hashing/session logic.
- Always hash passwords with a strong algorithm (bcrypt/argon2) if handling credentials directly — never store plaintext or reversible-encrypted passwords.
- Support OAuth (Google, GitHub, etc.) alongside email/password for lower-friction sign-up when appropriate.
- Protect routes/API handlers with explicit server-side session/role checks — never rely on hiding a UI element as the only protection.
- Set secure, httpOnly, sameSite cookies for session tokens; avoid storing sensitive tokens in localStorage.

## Reference Sources

- Auth.js — https://authjs.dev/
- Clerk — https://clerk.com/docs
- Supabase Auth — https://supabase.com/docs/guides/auth

## Checklist

- [ ] Managed auth provider or vetted library used, not hand-rolled crypto
- [ ] Server-side route protection in place, not just hidden UI
- [ ] Session tokens stored securely (httpOnly cookies)

## Common Pitfalls

- Storing plaintext or weakly-hashed passwords
- Relying only on client-side hiding of UI to 'protect' a route
- Storing session tokens in localStorage
