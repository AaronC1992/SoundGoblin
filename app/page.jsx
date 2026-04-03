import { redirect } from 'next/navigation';

/**
 * Root page — redirects immediately to the main dashboard.
 * This keeps the URL clean while giving us room to add a
 * proper marketing/landing page here in the future.
 *
 * TODO: Replace the redirect with a proper landing page once
 * auth + Stripe are wired up (unauthenticated users should
 * see the marketing page; authenticated users go to /dashboard).
 */
export default function Home() {
  redirect('/dashboard');
}
