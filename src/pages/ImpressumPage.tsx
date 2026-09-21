import { StaticPageLayout } from '../components/StaticPageLayout'

export function ImpressumPage() {
  return (
    <StaticPageLayout
      eyebrow="LEGAL NOTICE · IMPRESSUM"
      title="Impressum"
      intro="Anbieterkennzeichnung und rechtliche Hinweise für RocketYield."
    >
      <section className="static-section legal-copy" lang="de">
        <span className="static-index">DE</span>
        <h2>Angaben gemäß § 5 DDG</h2>
        <address>
          Nova Heidt<br />
          Eckertstr. 2B<br />
          10249 Berlin<br />
          Deutschland
        </address>
        <h3>Kontakt</h3>
        <p>E-Mail: <a href="mailto:novaheidt@gmail.com">novaheidt@gmail.com</a></p>
        <h3>Verantwortlich für den Inhalt</h3>
        <p>
          Verantwortlich gemäß § 18 Abs. 2 MStV, soweit anwendbar: Nova Heidt, Anschrift wie oben.
        </p>
        <h3>Verbraucherstreitbeilegung</h3>
        <p>
          Ich bin nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
        <h3>Haftungshinweis</h3>
        <p>
          RocketYield ist ein inoffizielles Community-Werkzeug und steht in keiner Verbindung zu
          Rocket Pool. Die bereitgestellten Informationen stellen keine Anlage-, Finanz-, Steuer-
          oder Rechtsberatung dar. Trotz sorgfältiger Erstellung wird keine Gewähr für Richtigkeit,
          Vollständigkeit, Aktualität oder dauerhafte Verfügbarkeit der Daten übernommen.
        </p>
        <p>
          Für Inhalte externer Websites, auf die verlinkt wird, sind ausschließlich deren
          Betreiber verantwortlich. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht
          erkennbar. Hinweise auf konkrete Rechtsverletzungen werden geprüft und betroffene Links
          gegebenenfalls entfernt.
        </p>
      </section>

      <section className="static-section legal-copy" lang="en">
        <span className="static-index">EN</span>
        <h2>Provider information</h2>
        <address>
          Nova Heidt<br />
          Eckertstr. 2B<br />
          10249 Berlin<br />
          Germany
        </address>
        <h3>Contact</h3>
        <p>Email: <a href="mailto:novaheidt@gmail.com">novaheidt@gmail.com</a></p>
        <h3>Disclaimer</h3>
        <p>
          RocketYield is an unofficial community tool and is not affiliated with Rocket Pool.
          Information shown by the service is not investment, financial, tax, or legal advice. No
          guarantee is made regarding the accuracy, completeness, timeliness, or continuous
          availability of blockchain, market, fiat, or calculated data.
        </p>
        <p>
          External websites are the responsibility of their respective operators. Links will be
          reviewed and removed where a specific legal violation becomes known.
        </p>
      </section>

      <aside className="static-callout">
        <strong>Stand / Last updated: 21.09.2026</strong>
        <p>This template should be reviewed by qualified German counsel before launch.</p>
      </aside>
    </StaticPageLayout>
  )
}
