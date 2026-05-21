/**
 * app/entry/[slug]/page.js
 * Individual entry page — permanent, shareable URL per runway.
 * Server component: fetches the entry from Supabase by slug.
 */

import { notFound }             from 'next/navigation';
import { fetchEntry, fetchAllEntries } from '@/lib/supabase';
import EntryDetail              from '@/components/EntryDetail';

export const revalidate = 60;

// Pre-generate all published entry pages at build time
export async function generateStaticParams() {
  try {
    const entries = await fetchAllEntries();
    return entries.map(e => ({ slug: e.id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }) {
  const entry = await fetchEntry(params.slug);
  if (!entry) return { title: 'Not Found — THE LEXICON' };
  return {
    title: `${entry.title} — THE LEXICON`,
    description: entry.notes?.critique?.slice(0, 160) || `${entry.title}, ${entry.season} ${entry.year}`,
  };
}

export default async function EntryPage({ params }) {
  const entry = await fetchEntry(params.slug);
  if (!entry) notFound();
  return <EntryDetail entry={entry} />;
}
