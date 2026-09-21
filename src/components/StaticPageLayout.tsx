import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import '../styles/static-pages.css'

interface StaticPageLayoutProps {
  eyebrow: string
  title: string
  intro: string
  children: ReactNode
}

export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Information and legal">
      <a href="/methodology">Methodology</a>
      <a href="/impressum">Impressum</a>
      <a href="/privacy">Datenschutz / Privacy</a>
      <a href="/stats">Public stats</a>
    </nav>
  )
}

export function StaticPageLayout({
  eyebrow,
  title,
  intro,
  children,
}: StaticPageLayoutProps) {
  return (
    <main className="static-page">
      <nav className="static-nav">
        <a href="/" className="static-brand">
          <span aria-hidden="true">R</span>
          RocketYield
        </a>
        <a href="/">
          <ArrowLeft size={15} />
          Back to dashboard
        </a>
      </nav>

      <header className="static-hero">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>

      <div className="static-content">{children}</div>

      <footer className="static-footer">
        <LegalLinks />
        <span>Unofficial community tool · Not affiliated with Rocket Pool</span>
      </footer>
    </main>
  )
}
