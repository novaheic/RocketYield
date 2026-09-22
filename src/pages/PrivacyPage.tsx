import { StaticPageLayout } from '../components/StaticPageLayout'

export function PrivacyPage() {
  return (
    <StaticPageLayout
      eyebrow="DATENSCHUTZ · PRIVACY"
      title="Datenschutzerklärung"
      intro="Wie RocketYield Daten verarbeitet, welche externen Dienste beteiligt sind und welche Rechte Sie haben."
    >
      <section className="static-section legal-copy" lang="de">
        <span className="static-index">DE / 01</span>
        <h2>Verantwortlicher</h2>
        <address>
          Nova Heidt<br />
          Eckertstr. 2B<br />
          10249 Berlin<br />
          Deutschland<br />
          E-Mail: <a href="mailto:novaheidt@gmail.com">novaheidt@gmail.com</a>
        </address>
      </section>

      <section className="static-section legal-copy" lang="de">
        <span className="static-index">DE / 02</span>
        <h2>Hosting und Seitenaufruf</h2>
        <p>
          RocketYield wird über Cloudflare Pages bereitgestellt. Beim Aufruf verarbeitet Cloudflare
          technisch erforderliche Verbindungsdaten, insbesondere IP-Adresse, Zeitpunkt, angeforderte
          URL, Browser- und Geräteinformationen. Dies dient der sicheren und zuverlässigen
          Auslieferung sowie der Abwehr von Missbrauch. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
          DSGVO. Das berechtigte Interesse liegt im sicheren Betrieb des Dienstes.
        </p>
        <p>
          Cloudflare kann Daten in Staaten außerhalb des Europäischen Wirtschaftsraums verarbeiten.
          Cloudflare beschreibt die eingesetzten Garantien in seiner{' '}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">
            Datenschutzerklärung
          </a>.
        </p>
      </section>

      <section className="static-section legal-copy" lang="de">
        <span className="static-index">DE / 03</span>
        <h2>Wallet- und Blockchain-Abfragen</h2>
        <p>
          Eine Wallet-Adresse oder ein ENS-Name wird nur verarbeitet, wenn Sie ihn selbst eingeben
          oder über eine entsprechend parametrisierte URL aufrufen. Die Eingabe wird zur Erbringung
          der gewünschten Auswertung direkt aus Ihrem Browser an Alchemy übermittelt. Dabei erhält
          Alchemy außerdem technisch bedingt Ihre IP-Adresse und Browser-Metadaten. Rechtsgrundlage
          ist Art. 6 Abs. 1 lit. b DSGVO beziehungsweise Art. 6 Abs. 1 lit. f DSGVO.
        </p>
        <p>
          RocketYield speichert Wallet-Adressen nicht in der eigenen Analytics-Datenbank. Die
          aufgerufene Adresse verbleibt jedoch in der URL und kann dadurch in Ihrem Browserverlauf,
          in Lesezeichen oder beim Teilen der URL sichtbar sein. Blockchain- und Kursdaten werden
          zur Beschleunigung lokal im IndexedDB-Speicher Ihres Browsers zwischengespeichert. Die
          ausgewählte Fiatwährung wird im Local Storage gespeichert, damit sie bei späteren
          Besuchen wiederhergestellt werden kann.
          Informationen zu Alchemy finden Sie in der{' '}
          <a href="https://www.alchemy.com/policies/privacy-policy" target="_blank" rel="noreferrer">
            Alchemy Privacy Policy
          </a>.
        </p>
      </section>

      <section className="static-section legal-copy" lang="de">
        <span className="static-index">DE / 04</span>
        <h2>Fiat- und Marktdaten</h2>
        <p>
          Für die Anzeige in USD, EUR, AUD, CAD, CNY, GBP, JPY oder KRW und den
          rETH/WETH-Marktvergleich stellt der Browser Anfragen an CoinGecko und GeckoTerminal.
          Historische tägliche ETH/USD-Kurse für die Ertragstabelle werden von DefiLlama abgerufen
          und zur Beschleunigung im IndexedDB-Speicher des Browsers zwischengespeichert.
          Dabei werden keine Wallet-Adresse und keine Portfoliodaten übermittelt; die Anbieter
          erhalten jedoch die technisch erforderliche
          IP-Adresse und Browserinformationen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Das
          berechtigte Interesse liegt in der Darstellung aktueller Preis- und Marktdaten.
        </p>
      </section>

      <section className="static-section legal-copy" lang="de">
        <span className="static-index">DE / 05</span>
        <h2>Cloudflare Web Analytics</h2>
        <p>
          RocketYield verwendet Cloudflare Web Analytics zur aggregierten Reichweiten- und
          Performance-Messung. Erfasst werden insbesondere Seitenaufrufe, Besuche, Referrer,
          ungefährer Standort, Gerätetyp und Ladezeiten. Es werden keine Wallet-Adresse,
          ENS-Namen, Salden, Erträge, RPC-Inhalte oder Fehlermeldungen an die Webanalyse übermittelt.
        </p>
        <p>
          Nach Angaben von Cloudflare verwendet Web Analytics keine Cookies, keinen Local Storage,
          keine individuellen Nutzerprofile und kein Fingerprinting. Für Analysezwecke wird kein
          clientseitiger Identifikator auf Ihrem Gerät gespeichert oder ausgelesen. Eine
          Einwilligung nach § 25 Abs. 1 TDDDG ist daher für diese Reichweitenmessung nicht
          erforderlich.
        </p>
        <p>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Das berechtigte Interesse liegt darin,
          Reichweite, technische Qualität und Popularität des Dienstes mit einer
          datensparsamen Lösung zu verstehen. Sie können dieser Verarbeitung aus Gründen, die sich
          aus Ihrer besonderen Situation ergeben, per E-Mail an die oben genannte Adresse
          widersprechen. Öffentliche Statistiken zeigen ausschließlich aggregierte Seitenaufrufe
          und Besuche; das dafür verwendete Cloudflare-API-Token bleibt serverseitig geheim.
        </p>
      </section>

      <section className="static-section legal-copy" lang="de">
        <span className="static-index">DE / 06</span>
        <h2>Ihre Rechte</h2>
        <p>
          Unter den gesetzlichen Voraussetzungen haben Sie Rechte auf Auskunft, Berichtigung,
          Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine
          Verarbeitung auf Grundlage berechtigter Interessen können Sie aus Gründen Ihrer
          besonderen Situation widersprechen. Anfragen richten Sie an die oben genannte
          E-Mail-Adresse.
        </p>
        <p>
          Sie können sich außerdem bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere
          bei der{' '}
          <a href="https://www.datenschutz-berlin.de/" target="_blank" rel="noreferrer">
            Berliner Beauftragten für Datenschutz und Informationsfreiheit
          </a>.
        </p>
        <p>Es findet keine automatisierte Entscheidungsfindung und kein Profiling statt.</p>
      </section>

      <section className="static-section legal-copy" lang="en">
        <span className="static-index">EN / SUMMARY</span>
        <h2>Privacy summary</h2>
        <p>
          The controller is Nova Heidt at the address above. Cloudflare processes technical request
          data to host and protect the site. When you ask RocketYield to read a wallet or ENS name,
          your browser sends that query to Alchemy; the address also remains in your URL and may be
          stored in your own browser history. Your selected fiat currency is saved in localStorage
          so it can be restored on later visits. CoinGecko, GeckoTerminal, and DefiLlama receive
          ordinary browser request metadata when current or historical prices are loaded.
          Historical daily ETH/USD prices are cached in your browser’s IndexedDB storage.
        </p>
        <p>
          Cloudflare Web Analytics measures aggregate page views, visits, referral information,
          approximate region, device type, and performance. According to Cloudflare it uses no
          cookies, localStorage, individual profiles, or fingerprinting. Wallets, ENS names,
          balances, earnings, RPC contents, and error messages are not included. The legal basis is
          the legitimate interest in privacy-preserving reach and performance measurement under
          Article 6(1)(f) GDPR. The public statistics endpoint exposes aggregate visits and page
          views only; its read-only Cloudflare token stays on the server.
        </p>
        <p>
          You may request access, correction, deletion, restriction, portability, or object to
          processing where applicable, and complain to a data protection authority. Contact{' '}
          <a href="mailto:novaheidt@gmail.com">novaheidt@gmail.com</a>.
        </p>
      </section>

      <aside className="static-callout">
        <strong>Stand / Last updated: 21.09.2026</strong>
        <p>Material changes to providers or processing will be reflected on this page.</p>
      </aside>
    </StaticPageLayout>
  )
}
