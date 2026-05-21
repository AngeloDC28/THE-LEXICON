/**
 * app/page.js — The archive directory
 * Server component: fetches all entries from Supabase at request time.
 * Passes data down to client components (MasonryGrid / IndexView).
 */

import { fetchAllEntries } from '@/lib/supabase';
import DirectoryClient    from '@/components/DirectoryClient';

export const revalidate = 60; // ISR — revalidate every 60 s

export default async function DirectoryPage() {
  let entries = [];
  try {
    entries = await fetchAllEntries();
  } catch (err) {
    console.error('[LEXICON] Failed to fetch entries:', err.message);
  }

  return <DirectoryClient entries={entries} />;
}
