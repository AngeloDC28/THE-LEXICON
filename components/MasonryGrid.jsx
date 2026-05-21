'use client';

/**
 * MasonryGrid.jsx
 * Visual-first layout with strict pagination.
 * No infinite scroll — cognitive minimalism is intentional.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';

const PAGE_SIZE = 18; // divisible by 2, 3, 4, 6 — fits every column count cleanly

export default function MasonryGrid({ entries }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const start  = (page - 1) * PAGE_SIZE;
  const slice  = entries.slice(start, start + PAGE_SIZE);

  const prev = useCallback(() => setPage(p => Math.max(1, p - 1)), []);
  const next = useCallback(() => setPage(p => Math.min(totalPages, p + 1)), [totalPages]);

  // Jump to page number; scroll to top of grid
  const goTo = useCallback((n) => {
    setPage(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <section aria-label="Archive grid">
      <div className="masonry-grid">
        {slice.map(entry => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={prev}
          onNext={next}
          onGoTo={goTo}
          total={entries.length}
          start={start + 1}
          end={Math.min(start + PAGE_SIZE, entries.length)}
        />
      )}
    </section>
  );
}

// ── Entry card ────────────────────────────────────────────────────────────────
function EntryCard({ entry }) {
  const img    = entry.images?.[0];
  const src    = img ? `/public/${img.src}` : null;
  const season = `${entry.season} ${entry.year}`;

  return (
    <Link
      href={`/entry/${entry.id}`}
      className="entry-card"
      aria-label={`${entry.title}, ${season}`}
    >
      {src && (
        <img
          className="entry-card__img"
          src={src}
          alt={img.alt || entry.title}
          width={img.width  || undefined}
          height={img.height || undefined}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="entry-card__overlay" aria-hidden="true">
        <div className="entry-card__title">{entry.title}</div>
        <div className="entry-card__meta">{season}</div>
      </div>
    </Link>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPrev, onNext, onGoTo, total, start, end }) {
  // Show at most 5 page numbers centred around the current page
  const range = buildRange(page, totalPages);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="pagination__btn"
        onClick={onPrev}
        disabled={page === 1}
        aria-label="Previous page"
      >
        ←
      </button>

      {range.map((n, i) =>
        n === '…' ? (
          <span key={`ellipsis-${i}`} className="pagination__info">…</span>
        ) : (
          <button
            key={n}
            className="pagination__btn"
            data-active={n === page ? 'true' : undefined}
            onClick={() => onGoTo(n)}
            aria-label={`Page ${n}`}
            aria-current={n === page ? 'page' : undefined}
          >
            {n}
          </button>
        )
      )}

      <button
        className="pagination__btn"
        onClick={onNext}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        →
      </button>

      <span className="pagination__info" aria-live="polite">
        {start}–{end} / {total}
      </span>
    </nav>
  );
}

function buildRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4)  return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}
