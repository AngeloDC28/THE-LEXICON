'use client';

/**
 * EntryDetail.jsx
 * Full entry view — image viewer on the left, metadata sidebar on the right.
 * Image navigation, hotspot labels, all editorial notes.
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';

export default function EntryDetail({ entry }) {
  const images = entry.images || [];
  const [idx, setIdx] = useState(0);
  const img = images[idx];

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(images.length - 1, i + 1)), [images.length]);

  return (
    <>
      <Link href="/" className="back-link">
        ← BACK TO ARCHIVE
      </Link>

      <div className="entry-page">
        {/* ── Image viewer ── */}
        <div className="entry-viewer">
          {img && (
            <img
              className="entry-viewer__img"
              src={`/public/${img.src}`}
              alt={img.alt || entry.title}
              width={img.width  || undefined}
              height={img.height || undefined}
            />
          )}

          {images.length > 1 && (
            <div className="entry-viewer__nav" aria-label="Image navigation">
              <button
                className="viewer-btn"
                onClick={prev}
                disabled={idx === 0}
                aria-label="Previous image"
              >
                ←
              </button>
              <span className="viewer-counter">{idx + 1} / {images.length}</span>
              <button
                className="viewer-btn"
                onClick={next}
                disabled={idx === images.length - 1}
                aria-label="Next image"
              >
                →
              </button>
            </div>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="entry-viewer__strip" role="list" aria-label="Image thumbnails">
              {images.map((im, i) => (
                <button
                  key={i}
                  role="listitem"
                  className="strip-thumb"
                  data-active={i === idx ? 'true' : undefined}
                  onClick={() => setIdx(i)}
                  aria-label={`Image ${i + 1}`}
                  aria-pressed={i === idx}
                >
                  <img
                    src={`/public/${im.src}`}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Metadata sidebar ── */}
        <aside className="entry-sidebar" aria-label="Entry metadata">
          {/* Title block */}
          <div>
            <h1 className="entry-sidebar__title">{entry.title}</h1>
            {entry.subtitle && (
              <p className="entry-sidebar__subtitle">{entry.subtitle}</p>
            )}
            <p className="entry-sidebar__subtitle">
              {entry.season} {entry.year}
            </p>
          </div>

          {/* Tags */}
          {Object.keys(entry.tags || {}).length > 0 && (
            <section aria-labelledby="tags-label">
              <p className="entry-section__label" id="tags-label">TAXONOMY</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(entry.tags).map(([k, v]) => (
                  <span key={k} className="tag-pill" title={k.toUpperCase()}>
                    {v}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Hotspots for current image */}
          {img?.hotspots?.length > 0 && (
            <section aria-labelledby="hotspots-label">
              <p className="entry-section__label" id="hotspots-label">
                ANNOTATIONS — IMAGE {idx + 1}
              </p>
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {img.hotspots.map((h, i) => (
                  <li key={i}>
                    <p style={{ fontSize: '0.65rem', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '0.2rem' }}>
                      {h.label}
                    </p>
                    {h.description && (
                      <p className="entry-section__body" style={{ fontSize: '0.65rem' }}>
                        {h.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Editorial notes */}
          {entry.notes?.provenance && (
            <NoteSection id="provenance" label="PROVENANCE" body={entry.notes.provenance} />
          )}
          {entry.notes?.strategy && (
            <NoteSection id="strategy" label="STRATEGY" body={entry.notes.strategy} />
          )}
          {entry.notes?.critique && (
            <NoteSection id="critique" label="CRITIQUE" body={entry.notes.critique} />
          )}
        </aside>
      </div>

      {/* Extra viewer styles scoped to this component */}
      <style>{`
        .entry-viewer__nav {
          position: absolute;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 0;
          background: rgba(10,10,10,0.8);
          border: 1px solid #222;
        }
        .viewer-btn {
          background: none;
          border: none;
          border-right: 1px solid #222;
          color: #e8e8e8;
          font-family: inherit;
          font-size: 0.75rem;
          padding: 0.4rem 0.8rem;
          cursor: pointer;
        }
        .viewer-btn:last-of-type { border-right: none; border-left: 1px solid #222; }
        .viewer-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .viewer-btn:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
        .viewer-counter {
          padding: 0 0.8rem;
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          color: #666;
        }
        .entry-viewer__strip {
          position: absolute;
          bottom: 4rem;
          left: 0;
          right: 0;
          display: flex;
          gap: 2px;
          padding: 0 1rem;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .entry-viewer__strip::-webkit-scrollbar { display: none; }
        .strip-thumb {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          background: none;
          border: 1px solid transparent;
          padding: 0;
          cursor: pointer;
          overflow: hidden;
          opacity: 0.4;
          transition: opacity 80ms;
        }
        .strip-thumb[data-active] { opacity: 1; border-color: #e8e8e8; }
        .strip-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .strip-thumb:focus-visible { outline: 2px solid #fff; }
      `}</style>
    </>
  );
}

function NoteSection({ id, label, body }) {
  return (
    <section aria-labelledby={`note-${id}`}>
      <p className="entry-section__label" id={`note-${id}`}>{label}</p>
      <p className="entry-section__body">{body}</p>
    </section>
  );
}
