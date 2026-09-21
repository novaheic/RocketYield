import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ImpressumPage } from './ImpressumPage'
import { MethodologyPage } from './MethodologyPage'
import { PrivacyPage } from './PrivacyPage'

describe('informational and legal pages', () => {
  it('publishes the supplied provider details in the Impressum', () => {
    render(<ImpressumPage />)
    expect(document.body).toHaveTextContent('Eckertstr. 2B')
    expect(screen.getAllByRole('link', { name: 'novaheidt@gmail.com' })[0]).toHaveAttribute(
      'href',
      'mailto:novaheidt@gmail.com',
    )
    expect(screen.getByText(/§ 5 DDG/)).toBeInTheDocument()
  })

  it('documents the balance-weighted earnings method and estimate', () => {
    render(<MethodologyPage />)
    expect(screen.getByText(/Earnings = Σ/)).toBeInTheDocument()
    expect(screen.getByText(/Ertrag = Σ/)).toBeInTheDocument()
    expect(screen.getByText(/per-second display estimate/i)).toBeInTheDocument()
  })

  it('discloses providers and cookieless aggregate analytics', () => {
    render(<PrivacyPage />)
    expect(screen.getAllByText(/Cloudflare Pages/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Alchemy übermittelt/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cloudflare Web Analytics' })).toBeInTheDocument()
    expect(document.body).toHaveTextContent('keine Cookies')
    expect(document.body).toHaveTextContent('Art. 6 Abs. 1 lit. f DSGVO')
  })
})
