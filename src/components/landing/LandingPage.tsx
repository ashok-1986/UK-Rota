'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import styles from './landing.module.css'

export default function LandingPage() {
  useEffect(() => {
    // Scroll-in animation
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const delay = Number(el.dataset.delay ?? 0)
            setTimeout(() => el.classList.add(styles.visible), delay)
          }
        })
      },
      { threshold: 0.1 }
    )

    document
      .querySelectorAll(
        `.${styles.featureCard}, .${styles.hiwStep}, .${styles.pricingCard}, .${styles.testimonialCard}`
      )
      .forEach((el, i) => {
        ;(el as HTMLElement).dataset.delay = String((i % 3) * 100)
        observer.observe(el)
      })

    // Nav active state on scroll
    const navLinks = document.querySelectorAll<HTMLAnchorElement>(
      `.${styles.navLinks} a[href^="#"]`
    )
    const sections = document.querySelectorAll<HTMLElement>('section[id]')

    const handleScroll = () => {
      let current = ''
      sections.forEach((s) => {
        if (window.scrollY >= s.offsetTop - 120) current = s.id
      })
      navLinks.forEach((a) => {
        a.style.color =
          a.getAttribute('href') === `#${current}` ? '#0D2D5E' : ''
      })
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className={styles.page}>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <span className={styles.navLogo}>
          Care<span>Rota</span>
        </span>
        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#compliance">Compliance</a>
          <a href="#pricing">Pricing</a>
          <a href="#testimonials">Reviews</a>
          <Link href="/sign-in" className={styles.btnNav} style={{ background: 'transparent', color: '#1A56A0', border: '1.5px solid #1A56A0', marginRight: 4 }}>
            Sign In
          </Link>
          <Link href="/sign-up" className={styles.btnNav}>
            Request Pilot Access
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div>
          <div className={styles.heroEyebrow}>
            <div className={styles.dot} />
            Built exclusively for UK care homes
          </div>
          <h1 className={`${styles.h1} ${styles.fadeIn}`}>
            Stop building rotas<br />in <em>spreadsheets.</em>
          </h1>
          <p className={`${styles.heroSub} ${styles.fadeIn}`}>
            CareRota replaces Excel chaos with a simple scheduling system that enforces Working Time
            Regulations automatically, reduces agency calls, and gives you CQC-ready evidence at the
            click of a button.
          </p>
          <div className={`${styles.heroCta} ${styles.fadeIn}`}>
            <Link href="/sign-up" className={styles.btnPrimary}>
              Request Free Pilot Access →
            </Link>
            <a href="#features" className={styles.btnGhost}>
              See how it works <span>→</span>
            </a>
          </div>
          <div className={styles.heroTrust}>
            <div className={styles.trustBadge}>
              <div className={styles.trustIcon}>🇬🇧</div> UK data hosting
            </div>
            <div className={styles.trustBadge}>
              <div className={styles.trustIcon}>✓</div> CQC-aligned audit trail
            </div>
            <div className={styles.trustBadge}>
              <div className={styles.trustIcon}>🔒</div> UK-GDPR compliant
            </div>
          </div>
        </div>

        {/* Demo card */}
        <div className={styles.heroVisual}>
          <div className={styles.floatingBadge + ' ' + styles.fbSaved}>
            💰 ~£4,200 saved this month <span>vs. agency costs</span>
          </div>
          <div className={styles.demoCard}>
            <div className={styles.demoHeader}>
              <span className={styles.demoHeaderTitle}>🏠 Sunrise Care Home — Week Rota</span>
              <span className={styles.demoHeaderWeek}>28 Apr – 4 May 2026</span>
            </div>
            <div>
              <table className={styles.rotaTable}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Mon</th><th>Tue</th><th>Wed</th>
                    <th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Early<br /><span className={styles.rowLabel}>07:00–15:00</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Sarah K</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Sarah K</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeSick}`}>SICK</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Priya M</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Sarah K</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>James T</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Priya M</span></td>
                  </tr>
                  <tr>
                    <td>Late<br /><span className={styles.rowLabel}>14:00–22:00</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Priya M</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>James T</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Priya M</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>James T</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeScheduling}`}>Unassigned</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Priya M</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>James T</span></td>
                  </tr>
                  <tr>
                    <td>Night<br /><span className={styles.rowLabel}>21:00–07:00</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>James T</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Ada R</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>James T</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Ada R</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>James T</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeConfirmed}`}>Ada R</span></td>
                    <td><span className={`${styles.shiftBadge} ${styles.badgeGap}`}>⚠ GAP</span></td>
                  </tr>
                </tbody>
              </table>
              <div className={styles.alertBar}>
                ⚠ 2 coverage gaps detected — click to assign bank staff
              </div>
            </div>
          </div>
          <div className={`${styles.floatingBadge} ${styles.fbCqc}`}>
            📋 CQC audit log ready <span>All actions tracked automatically</span>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <div className={styles.statNum}>£<span>2.4</span>bn</div>
          <div className={styles.statLabel}>spent on agency staff by<br />UK care sector annually</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}><span>30</span>%</div>
          <div className={styles.statLabel}>annual staff turnover in<br />UK social care (Skills for Care)</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}><span>3–4</span>hrs</div>
          <div className={styles.statLabel}>managers spend building<br />each week&apos;s rota manually</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}><span>11</span>hrs</div>
          <div className={styles.statLabel}>minimum rest between shifts<br />under UK Working Time Regs</div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" className={styles.section}>
        <div className={styles.sectionLabel}>Platform Features</div>
        <h2 className={styles.h2}>Everything a care home<br />manager actually needs</h2>
        <p className={styles.sectionSub}>
          No bloat. No payroll. No clinical notes. Just clean, fast rota management that fits how
          care homes actually work.
        </p>
        <div className={styles.featuresGrid}>
          {[
            {
              icon: '📅',
              title: 'Weekly Rota Calendar',
              desc: 'Visual table view of your entire week — Early, Late, and Night shifts — across all units. Assign staff with a single click. No drag-and-drop complexity to learn.',
              tag: 'Core Feature',
            },
            {
              icon: '⚖️',
              title: 'Rules Engine',
              desc: 'Automatically enforces minimum 11-hour rest between shifts, 48-hour weekly maximum, and night shift caps per Working Time Regulations 1998. Blocks illegal assignments before they happen.',
              tag: 'Compliance',
            },
            {
              icon: '🔔',
              title: 'Gap Alerts',
              desc: 'Instantly see understaffed shifts before they become last-minute agency calls. Get notified the moment a gap appears — sick calls, cancellations, or unfilled scheduling slots.',
              tag: 'Cost Control',
            },
            {
              icon: '📱',
              title: 'Staff Self-Service',
              desc: 'Staff see their upcoming shifts on any phone browser. They can confirm shifts, flag issues, and never need to chase the manager for their rota again. Reduces WhatsApp chaos immediately.',
              tag: 'Staff Welfare',
            },
            {
              icon: '📄',
              title: 'PDF & CSV Export',
              desc: "Print-ready weekly rota PDF in one click. CSV export of staff hours per week for your payroll team or agency reconciliation. No more manual formatting in Excel.",
              tag: 'Reporting',
            },
            {
              icon: '🏠',
              title: 'Multi-Home Ready',
              desc: "Running more than one care home? Manage all sites from a single login. Group managers get cross-home visibility. Each home's data stays completely separate — GDPR-safe by design.",
              tag: 'Scale',
            },
          ].map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span className={styles.featureTag}>{f.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className={styles.hiwSection}>
        <div className={styles.sectionLabel}>How It Works</div>
        <h2 className={styles.h2}>Up and running in <em>under a day</em></h2>
        <p className={styles.sectionSub}>
          We have designed CareRota for home managers, not IT teams. No installation, no servers, no
          training courses required.
        </p>
        <div className={styles.hiwSteps}>
          {[
            {
              n: '1',
              title: 'We onboard your home',
              desc: 'We set up your home, add your shift types, and configure your compliance rules together. Takes about 30 minutes on a video call.',
            },
            {
              n: '2',
              title: 'Import your staff',
              desc: 'Send us your staff list or enter them directly. Each staff member gets an invite email and sets their own password. No IT admin needed.',
            },
            {
              n: '3',
              title: 'Build your first rota',
              desc: "Click on a shift slot, select a staff member, and the rules engine checks compliance instantly. Publish when you're ready.",
            },
            {
              n: '4',
              title: 'Staff confirm, gaps are flagged',
              desc: 'Staff confirm their shifts on their phone. You get instant alerts for any gaps. Your audit trail builds itself in the background.',
            },
          ].map((s) => (
            <div key={s.n} className={styles.hiwStep}>
              <div className={styles.stepNum}>{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMPLIANCE ── */}
      <section id="compliance" className={styles.complianceSection}>
        <div className={styles.complianceGrid}>
          <div>
            <div className={styles.sectionLabel}>For CQC Confidence</div>
            <h2 className={styles.h2}>Built to help you pass<br /><em>inspections.</em></h2>
            <p className={styles.sectionSub}>
              CQC inspectors ask for staffing evidence. CareRota gives you an automatic, timestamped
              audit trail of every rota decision — who assigned what, when, and why it was changed.
            </p>
            {[
              {
                title: 'Automatic audit trail',
                desc: 'Every rota publish, staff edit, and shift change is logged with a timestamp, the user who made it, and what changed. Retained for 3 years.',
              },
              {
                title: 'Working Time Regulation enforcement',
                desc: 'Rules engine defaults to UK legal minimums. You cannot accidentally schedule a staff member with less than 11 hours rest — the system blocks it.',
              },
              {
                title: 'UK data residency (UK-GDPR)',
                desc: 'All staff data — names, shifts, hours — is stored exclusively in UK/EU data centres. We act as your GDPR Data Processor and sign a DPA with every home.',
              },
            ].map((item) => (
              <div key={item.title} className={styles.complianceItem}>
                <div className={styles.complianceCheck}>✓</div>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.complianceVisual}>
            {[
              {
                icon: '🗂️',
                title: 'CQC Evidence Pack',
                desc: 'One-click PDF showing safe staffing over any date range',
              },
              {
                icon: '⏰',
                title: 'Working Time Compliance Log',
                desc: 'Automatic record of rest hours between all assigned shifts',
              },
              {
                icon: '🇬🇧',
                title: 'UK-GDPR Staff Rights',
                desc: 'Data export and deletion on request — Article 15 & 17 compliant',
              },
              {
                icon: '🔐',
                title: '2FA for All Managers',
                desc: 'Multi-factor authentication enforced for home manager accounts',
              },
            ].map((b) => (
              <div key={b.title} className={styles.cqcBadge}>
                <span className={styles.badgeIcon}>{b.icon}</span>
                <div>
                  <h5>{b.title}</h5>
                  <p>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className={styles.testimonials}>
        <div className={styles.sectionLabel}>Early Access Feedback</div>
        <h2 className={styles.h2}>What pilot care homes<br />are saying</h2>
        <p className={styles.sectionSub}>
          CareRota is currently in private pilot with UK care homes. Here is what managers told us
          after their first month.
        </p>
        <div className={styles.testimonialsGrid}>
          {[
            {
              quote:
                "I used to spend Sunday afternoon dreading the rota. Now I'm done in under 30 minutes and I can actually see the gaps before they become panic calls on Monday morning.",
              name: 'Margaret T.',
              role: 'Registered Home Manager, West Midlands (38-bed residential)',
              initial: 'M',
              bg: '#1A56A0',
            },
            {
              quote:
                'The compliance piece alone is worth it. My last CQC inspection, the inspector asked for staffing records. I showed them the audit log export and that was it — no further questions.',
              name: 'Derek R.',
              role: 'Area Operations Manager, Yorkshire (3-home group)',
              initial: 'D',
              bg: '#0D2D5E',
            },
            {
              quote:
                'Staff actually check their shifts now because they can see it on their phone. The WhatsApp chaos has almost completely stopped. That alone made my life better.',
              name: 'Priya S.',
              role: 'Unit Manager, Greater Manchester (nursing home)',
              initial: 'P',
              bg: '#10B981',
            },
          ].map((t) => (
            <div key={t.name} className={styles.testimonialCard}>
              <div className={styles.stars}>★★★★★</div>
              <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
              <div className={styles.testimonialAuthor}>
                <div className={styles.avatar} style={{ background: t.bg }}>{t.initial}</div>
                <div>
                  <h5>{t.name}</h5>
                  <p>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className={styles.section}>
        <div className={styles.sectionLabel}>Simple Pricing</div>
        <h2 className={styles.h2} style={{ textAlign: 'center' }}>
          Transparent pricing.<br /><em>No surprises.</em>
        </h2>
        <p className={styles.sectionSub} style={{ margin: '0 auto 60px', textAlign: 'center' }}>
          Per user, per month. No setup fees. No long-term contracts. Cancel any time.
        </p>
        <div className={styles.pricingGrid}>
          {/* Starter */}
          <div className={styles.pricingCard}>
            <h3>Starter</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey)' }}>Up to 20 staff</p>
            <div className={styles.price}>
              <sup>£</sup>1<span style={{ fontSize: '1.2rem', color: 'var(--grey)' }}>/user/mo</span>
            </div>
            <p className={styles.priceNote}>~£20/month for a 20-person team</p>
            {['Weekly rota calendar', 'Rules engine (compliance)', 'Staff self-service', 'PDF & CSV export', 'Audit log'].map((f) => (
              <div key={f} className={styles.pricingFeature}>
                <span className={styles.tick}>✓</span> {f}
              </div>
            ))}
            <Link href="/sign-up" className={styles.btnOutline}>Start Free Pilot</Link>
          </div>

          {/* Professional */}
          <div className={`${styles.pricingCard} ${styles.featured}`}>
            <div className={styles.popularTag}>Most Popular</div>
            <h3>Professional</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey)' }}>Up to 60 staff · Multi-unit</p>
            <div className={styles.price}>
              <sup>£</sup>2<span style={{ fontSize: '1.2rem', color: 'var(--grey)' }}>/user/mo</span>
            </div>
            <p className={styles.priceNote}>~£100/month for a 50-person home</p>
            {['Everything in Starter', 'Multi-unit management', 'Email shift notifications', 'Gap alerts & coverage view', 'Priority support'].map((f) => (
              <div key={f} className={styles.pricingFeature}>
                <span className={styles.tick}>✓</span> {f}
              </div>
            ))}
            <Link href="/sign-up" className={styles.btnFilled}>Start Free Pilot</Link>
          </div>

          {/* Group */}
          <div className={styles.pricingCard}>
            <h3>Group</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey)' }}>2–10 homes · Group manager</p>
            <div className={styles.price} style={{ fontSize: '2rem', marginTop: '16px' }}>Custom</div>
            <p className={styles.priceNote}>Billed per active user, across all homes</p>
            {['Everything in Professional', 'Group-level rota overview', 'Cross-home reporting', 'Dedicated onboarding', 'SLA support agreement'].map((f) => (
              <div key={f} className={styles.pricingFeature}>
                <span className={styles.tick}>✓</span> {f}
              </div>
            ))}
            <a href="mailto:connect@laybhaari.com" className={styles.btnOutline}>Talk to Us</a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={styles.ctaSection}>
        <div className={styles.sectionLabel}>Get Started</div>
        <h2 className={styles.h2}>Ready to replace your<br />spreadsheet rota?</h2>
        <p>
          Join the pilot programme. We onboard your home personally, for free. No credit card
          needed.
        </p>
        <div className={styles.ctaButtons}>
          <Link href="/sign-up" className={styles.btnPrimary}>
            Request Pilot Access →
          </Link>
          <a
            href="mailto:connect@laybhaari.com"
            className={styles.btnGhost}
            style={{ fontSize: '0.95rem', color: '#0D2D5E' }}
          >
            Email us directly →
          </a>
        </div>
        <p className={styles.ctaNote}>
          🇬🇧 UK-based team · 🔒 UK data hosting · ✓ No lock-in
        </p>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <h4>Care<span>Rota</span></h4>
            <p>
              Staff rota software built exclusively for UK care homes. Replacing spreadsheets with
              compliance, clarity, and calm.
            </p>
          </div>
          <div className={styles.footerCol}>
            <h5>Product</h5>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#compliance">Compliance</a>
            <a href="#">Changelog</a>
          </div>
          <div className={styles.footerCol}>
            <h5>Legal</h5>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Data Processing Agreement</a>
            <a href="#">Cookie Policy</a>
          </div>
          <div className={styles.footerCol}>
            <h5>Support</h5>
            <a href="#">Help Centre</a>
            <a href="mailto:connect@laybhaari.com">Contact Us</a>
            <a href="/sign-up">Request Demo</a>
            <a href="#">Status Page</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 CareRota. All rights reserved. Built in the UK, for UK care homes.</span>
          <div className={styles.gdprBadges}>
            <span className={styles.gdprBadge}>🇬🇧 UK-GDPR</span>
            <span className={styles.gdprBadge}>🔒 UK Data Hosted</span>
            <span className={styles.gdprBadge}>✓ CQC-Aligned</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
