'use client';

/**
 * DirectoryClient.jsx
 * Owns the view toggle (GRID ↔ INDEX) and renders the appropriate component.
 * Kept as a thin shell so MasonryGrid and IndexView stay focused.
 */

import { useState } from 'react';
import MasonryGrid from './MasonryGrid';
import IndexView   from './IndexView';

export default function DirectoryClient({ entries }) {
  const [view, setView] = useState('grid'); // 'grid' | 'index'

  return (
    <>
      <div className="directory-toolbar">
        <span className="directory-count">
          {entries.length} ENTRIES — THE LEXICON
        </span>
        <div className="view-controls" role="group" aria-label="View mode">
          <button
            className="view-btn"
            data-active={view === 'grid' ? 'true' : undefined}
            onClick={() => setView('grid')}
            aria-pressed={view === 'grid'}
          >
            GRID
          </button>
          <button
            className="view-btn"
            data-active={view === 'index' ? 'true' : undefined}
            onClick={() => setView('index')}
            aria-pressed={view === 'index'}
          >
            INDEX
          </button>
        </div>
      </div>

      {view === 'grid'
        ? <MasonryGrid entries={entries} />
        : <IndexView   entries={entries} />
      }
    </>
  );
}
