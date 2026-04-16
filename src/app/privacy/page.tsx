import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — CareRota',
}

export default function PrivacyPage() {
  const updated = '14 April 2026'

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 py-4 px-6">
        <Link href="/" className="text-lg font-bold text-blue-900">CareRota</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-gray">
        <h1>Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: {updated}</p>

        <h2>1. Who we are</h2>
        <p>
          CareRota is a staff rota scheduling SaaS for UK care homes. We are a data controller
          under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
        </p>

        <h2>2. What personal data we collect</h2>
        <ul>
          <li><strong>Staff data:</strong> name, email address, phone number, role, contracted hours, shift history</li>
          <li><strong>Authentication data:</strong> email, encrypted password, 2FA settings (held by Clerk)</li>
          <li><strong>Usage and audit logs:</strong> actions taken within the system (e.g. rota published, shift confirmed), IP address, timestamp</li>
        </ul>
        <p>
          We do <strong>not</strong> collect clinical, health, or resident data of any kind.
        </p>

        <h2>3. Legal basis for processing</h2>
        <p>
          We process personal data under Article 6(1)(b) UK GDPR — processing is necessary for
          the performance of a contract (employment scheduling) — and Article 6(1)(f) — legitimate
          interests (audit logging for compliance and security).
        </p>

        <h2>4. Where data is stored</h2>
        <p>
          All personal data is stored and processed exclusively within the United Kingdom and
          European Union:
        </p>
        <ul>
          <li>Database: Neon PostgreSQL, EU-London region (eu-west-2)</li>
          <li>Authentication: Clerk, EU instance region</li>
          <li>Application hosting: Vercel, London region (lhr1)</li>
        </ul>
        <p>No personal data is transferred outside the UK/EU.</p>

        <h2>5. Data retention</h2>
        <ul>
          <li><strong>Rota/shift data:</strong> retained for 12 months from the shift date, then automatically deleted</li>
          <li><strong>Audit logs:</strong> retained for 3 years, then automatically deleted</li>
          <li><strong>Staff accounts:</strong> retained while the employment relationship exists; soft-deleted on request, anonymised within 30 days</li>
        </ul>

        <h2>6. Your rights under UK GDPR</h2>
        <p>You have the following rights regarding your personal data:</p>
        <ul>
          <li><strong>Right of access (Article 15):</strong> Request a copy of all data we hold about you</li>
          <li><strong>Right to erasure (Article 17):</strong> Request deletion of your personal data</li>
          <li><strong>Right to rectification (Article 16):</strong> Request correction of inaccurate data</li>
          <li><strong>Right to restrict processing (Article 18)</strong></li>
          <li><strong>Right to data portability (Article 20)</strong></li>
          <li><strong>Right to object (Article 21)</strong></li>
        </ul>
        <p>
          To exercise these rights, log in and use the <strong>Download My Data</strong> or{' '}
          <strong>Request Account Deletion</strong> options in your profile, or contact your home
          manager.
        </p>

        <h2>7. Data security</h2>
        <p>
          All data is encrypted in transit (TLS 1.3) and at rest. Access is controlled by
          role-based permissions. Audit logs record all significant actions. Staff accounts
          support two-factor authentication (2FA), which is required for all managers.
        </p>

        <h2>8. Third-party processors</h2>
        <table className="text-sm">
          <thead>
            <tr><th>Processor</th><th>Purpose</th><th>Region</th></tr>
          </thead>
          <tbody>
            <tr><td>Clerk</td><td>Authentication &amp; identity</td><td>EU</td></tr>
            <tr><td>Neon</td><td>Database</td><td>EU-London</td></tr>
            <tr><td>Vercel</td><td>Application hosting</td><td>UK (lhr1)</td></tr>
            <tr><td>Resend</td><td>Transactional email</td><td>EU</td></tr>
            <tr><td>Twilio</td><td>SMS notifications (optional)</td><td>UK/EU</td></tr>
          </tbody>
        </table>

        <h2>9. Cookies</h2>
        <p>
          We use session cookies strictly necessary for authentication. We do not use tracking,
          advertising, or analytics cookies.
        </p>

        <h2>10. Contact &amp; complaints</h2>
        <p>
          For data protection enquiries, contact your care home manager or our data protection
          contact at <a href="mailto:privacy@carerota.co.uk">privacy@carerota.co.uk</a>.
        </p>
        <p>
          You have the right to lodge a complaint with the Information Commissioner&apos;s Office (ICO)
          at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a> or
          call 0303 123 1113.
        </p>
      </main>
    </div>
  )
}
