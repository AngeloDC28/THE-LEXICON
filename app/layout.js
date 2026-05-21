import './globals.css';

export const metadata = {
  title: 'THE LEXICON',
  description: 'A forensic visual culture research terminal. A rigorous audit of subcultural theory through fashion.',
  openGraph: {
    title: 'THE LEXICON',
    description: 'Forensic visual culture research terminal.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="site-wordmark">THE LEXICON</a>
          <nav className="site-nav" aria-label="Primary navigation">
            <span className="site-nav__meta">ARCHIVE — FORENSIC VISUAL CULTURE</span>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
