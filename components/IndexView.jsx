'use client';

/**
 * IndexView.jsx
 * Brutalist text-only table for forensic analysis.
 * Sortable columns, keyboard navigable, fully accessible.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const COLS = [
  { key: 'title',           label: 'TITLE' },
  { key: 'year',            label: 'YEAR' },
  { key: 'season',          label: 'SEASON' },
  { key: 'tags.format',     label: 'FORMAT' },
  { key: 'tags.gender',     label: 'GENDER' },
  { key: 'tags.geography',  label: 'GEOGRAPHY' },
  { key: 'tags.politics',   label: 'POLITICS' },
  { key: 'tags.theories',   label: 'THEORIES' },
];

function getVal(entry, key) {
  if (key.startsWith('tags.')) return entry.tags?.[key.slice(5)] ?? '';
  return entry[key] ?? '';
}

export default function IndexView({ entries }) {
  const router  = useRouter();
  const [sortKey, setSortKey]  = useState('year');
  const [sortDir, setSortDir]  = useState('desc'); // newest first by default

  const sorted = [...entries].sort((a, b) => {
    const va = String(getVal(a, sortKey)).toLowerCase();
    const vb = String(getVal(b, sortKey)).toLowerCase();
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = useCallback((key) => {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else setSortDir('asc');
      return key;
    });
  }, []);

  const openEntry = useCallback((id) => {
    router.push(`/entry/${id}`);
  }, [router]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="index-table" role="grid" aria-label="Archive index">
        <thead>
          <tr>
            {COLS.map(col => (
              <th
                key={col.key}
                role="columnheader"
                tabIndex={0}
                aria-sort={
                  sortKey === col.key
                    ? sortDir === 'asc' ? 'ascending' : 'descending'
                    : 'none'
                }
                onClick={() => handleSort(col.key)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && (
                  <span aria-hidden="true" style={{ marginLeft: '0.4rem', opacity: 0.6 }}>
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(entry => (
            <IndexRow
              key={entry.id}
              entry={entry}
              onOpen={openEntry}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function IndexRow({ entry, onOpen }) {
  const tags = entry.tags || {};

  return (
    <tr
      tabIndex={0}
      role="row"
      aria-label={`${entry.title}, ${entry.season} ${entry.year}`}
      onClick={() => onOpen(entry.id)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onOpen(entry.id)}
    >
      <td style={{ fontWeight: 600 }}>{entry.title}</td>
      <td className="muted">{entry.year}</td>
      <td className="muted">{entry.season}</td>
      <td>{tags.format  ? <span className="tag-pill">{tags.format}</span>    : <span className="muted">—</span>}</td>
      <td>{tags.gender  ? <span className="tag-pill">{tags.gender}</span>    : <span className="muted">—</span>}</td>
      <td>{tags.geography ? <span className="tag-pill">{tags.geography}</span> : <span className="muted">—</span>}</td>
      <td>{tags.politics ? <span className="tag-pill">{tags.politics}</span>  : <span className="muted">—</span>}</td>
      <td>{tags.theories ? <span className="tag-pill">{tags.theories}</span>  : <span className="muted">—</span>}</td>
    </tr>
  );
}
