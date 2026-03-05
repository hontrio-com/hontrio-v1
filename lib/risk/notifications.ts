import { sendEmail } from '@/lib/email'

// ─── Template email alertă risc ───────────────────────────────────────────────
export function buildRiskAlertEmail(opts: {
  to: string
  storeName: string
  storeUrl: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  riskScore: number
  riskLabel: string
  orderNumber: string | null
  orderValue: number
  currency: string
  flags: Array<{ label: string; severity: string }>
  recommendation: string
  refusalProbability: number
  dashboardUrl: string
}): string {
  const {
    storeName, customerName, customerPhone, customerEmail,
    riskScore, riskLabel, orderNumber, orderValue, currency,
    flags, recommendation, refusalProbability, dashboardUrl,
  } = opts

  const labelColors: Record<string, string> = {
    blocked: '#dc2626',
    problematic: '#ea580c',
    watch: '#d97706',
  }
  const labelRo: Record<string, string> = {
    blocked: 'BLOCAT',
    problematic: 'PROBLEMATIC',
    watch: 'WATCH',
  }
  const color = labelColors[riskLabel] || '#6b7280'
  const labelText = labelRo[riskLabel] || riskLabel.toUpperCase()

  const flagsHtml = flags.slice(0, 5).map(f => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.severity === 'high' ? '#dc2626' : f.severity === 'medium' ? '#ea580c' : '#d97706'};flex-shrink:0"></span>
      <span style="font-size:13px;color:#374151">${f.label}</span>
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto">

    <!-- Header alertă -->
    <div style="background:${color};border-radius:16px 16px 0 0;padding:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.7);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Risk Shield · ${storeName}</p>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:0">⚠️ Client ${labelText}</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:8px 0 0">Comandă nouă necesită atenție imediată</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:24px;border-radius:0 0 16px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

      <!-- Scor risc -->
      <div style="display:flex;align-items:center;gap:16px;padding:16px;background:#fafafa;border-radius:12px;margin-bottom:20px;border:1px solid #e5e7eb">
        <div style="width:56px;height:56px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="color:white;font-size:18px;font-weight:900">${riskScore}</span>
        </div>
        <div>
          <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Scor risc</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#111827">${recommendation}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Probabilitate refuz: <strong style="color:${refusalProbability > 60 ? '#dc2626' : '#d97706'}">${refusalProbability}%</strong></p>
        </div>
      </div>

      <!-- Date client -->
      <div style="margin-bottom:20px">
        <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Date client</p>
        <table style="width:100%;border-collapse:collapse">
          ${customerName ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0;width:100px">Nume</td><td style="font-size:13px;font-weight:600;color:#111827">${customerName}</td></tr>` : ''}
          ${customerPhone ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0">Telefon</td><td style="font-size:13px;font-weight:600;color:#111827">${customerPhone}</td></tr>` : ''}
          ${customerEmail ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0">Email</td><td style="font-size:13px;font-weight:600;color:#111827">${customerEmail}</td></tr>` : ''}
          <tr><td style="font-size:12px;color:#6b7280;padding:4px 0">Comandă</td><td style="font-size:13px;font-weight:600;color:#111827">#${orderNumber || 'N/A'} — ${orderValue} ${currency}</td></tr>
        </table>
      </div>

      <!-- Motive risc -->
      ${flags.length > 0 ? `
      <div style="margin-bottom:20px">
        <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Motive detectate</p>
        ${flagsHtml}
      </div>` : ''}

      <!-- CTA -->
      <a href="${dashboardUrl}" style="display:block;text-align:center;background:#111827;color:white;font-size:13px;font-weight:700;padding:14px 24px;border-radius:10px;text-decoration:none;margin-top:8px">
        Deschide profil client →
      </a>

    </div>

    <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0">
      Hontrio Risk Shield · <a href="${dashboardUrl}/settings" style="color:#9ca3af">Dezactivează notificările</a>
    </p>
  </div>
</body>
</html>`
}

// ─── Template raport săptămânal ────────────────────────────────────────────────
export function buildWeeklyReportEmail(opts: {
  to: string
  storeName: string
  storeUrl: string
  dashboardUrl: string
  weekStart: string
  weekEnd: string
  stats: {
    totalOrders: number
    blockedOrders: number
    problematicOrders: number
    watchOrders: number
    refusedOrders: number
    totalRefusalValue: number
    savedValue: number          // valoare comenzi blocate = pierderi evitate
    newCustomers: number
    alertsGenerated: number
    topRiskCustomers: Array<{
      name: string | null
      phone: string | null
      score: number
      label: string
      totalOrders: number
      refusedOrders: number
    }>
    collectionRate: number
    refusalRate: number
    vsLastWeek: {
      refusalRateChange: number  // pozitiv = mai rău, negativ = mai bine
      blockedChange: number
    }
  }
  currency: string
}): string {
  const { storeName, dashboardUrl, weekStart, weekEnd, stats, currency } = opts

  const trend = stats.vsLastWeek.refusalRateChange
  const trendColor = trend > 0 ? '#dc2626' : '#16a34a'
  const trendIcon = trend > 0 ? '↑' : '↓'
  const trendText = trend > 0
    ? `Rata de refuz a crescut cu ${Math.abs(trend).toFixed(1)}% față de săptămâna trecută`
    : `Rata de refuz a scăzut cu ${Math.abs(trend).toFixed(1)}% — îmbunătățire!`

  const topCustomersHtml = stats.topRiskCustomers.slice(0, 5).map((c, i) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6">${i + 1}. ${c.name || c.phone || 'Necunoscut'}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:${c.score >= 81 ? '#dc2626' : c.score >= 61 ? '#ea580c' : '#d97706'};border-bottom:1px solid #f3f4f6">${c.score}/100</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6">${c.refusedOrders}/${c.totalOrders} refuzate</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#111827,#1f2937);border-radius:16px 16px 0 0;padding:28px;text-align:center">
      <p style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Raport Săptămânal · ${storeName}</p>
      <h1 style="color:white;font-size:24px;font-weight:900;margin:0">Risk Shield</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:8px 0 0">${weekStart} → ${weekEnd}</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:28px;border-radius:0 0 16px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

      <!-- Trend săptămânal -->
      <div style="background:${trend > 0 ? '#fef2f2' : '#f0fdf4'};border:1px solid ${trend > 0 ? '#fecaca' : '#bbf7d0'};border-radius:10px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;gap:12px">
        <span style="font-size:20px">${trend > 0 ? '⚠️' : '✅'}</span>
        <p style="margin:0;font-size:13px;color:${trendColor};font-weight:600">${trendText}</p>
      </div>

      <!-- KPI grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
          <p style="font-size:28px;font-weight:900;color:#111827;margin:0">${stats.collectionRate}%</p>
          <p style="font-size:11px;color:#6b7280;margin:4px 0 0">Rată ridicare</p>
        </div>
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
          <p style="font-size:28px;font-weight:900;color:${stats.refusalRate > 20 ? '#dc2626' : '#111827'};margin:0">${stats.refusalRate}%</p>
          <p style="font-size:11px;color:#6b7280;margin:4px 0 0">Rată refuz</p>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
          <p style="font-size:22px;font-weight:900;color:#16a34a;margin:0">${stats.savedValue} ${currency}</p>
          <p style="font-size:11px;color:#16a34a;margin:4px 0 0">💰 Pierderi evitate</p>
        </div>
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
          <p style="font-size:28px;font-weight:900;color:#dc2626;margin:0">${stats.blockedOrders}</p>
          <p style="font-size:11px;color:#6b7280;margin:4px 0 0">Comenzi blocate</p>
        </div>
      </div>

      <!-- Statistici săptămână -->
      <div style="margin-bottom:24px">
        <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px">Activitate săptămână</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;font-size:13px;color:#6b7280">Total comenzi procesate</td><td style="font-size:13px;font-weight:600;color:#111827;text-align:right">${stats.totalOrders}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#6b7280">Clienți noi</td><td style="font-size:13px;font-weight:600;color:#111827;text-align:right">${stats.newCustomers}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#6b7280">Alerte generate</td><td style="font-size:13px;font-weight:600;color:#111827;text-align:right">${stats.alertsGenerated}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#6b7280">Colete refuzate</td><td style="font-size:13px;font-weight:700;color:#dc2626;text-align:right">${stats.refusedOrders} (${stats.totalRefusalValue} ${currency})</td></tr>
        </table>
      </div>

      <!-- Top clienți risc -->
      ${stats.topRiskCustomers.length > 0 ? `
      <div style="margin-bottom:24px">
        <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px">Top clienți cu risc maxim</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600">Client</th>
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600">Scor</th>
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600">Comenzi</th>
            </tr>
          </thead>
          <tbody>${topCustomersHtml}</tbody>
        </table>
      </div>` : ''}

      <!-- CTA -->
      <a href="${dashboardUrl}/risk" style="display:block;text-align:center;background:#111827;color:white;font-size:13px;font-weight:700;padding:14px 24px;border-radius:10px;text-decoration:none">
        Deschide Risk Shield →
      </a>

    </div>

    <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0">
      Hontrio Risk Shield · <a href="${dashboardUrl}/risk/settings" style="color:#9ca3af">Gestionează notificările</a>
    </p>
  </div>
</body>
</html>`
}

// ─── Trimitere alertă risc instant ────────────────────────────────────────────
export async function sendRiskAlert(opts: Parameters<typeof buildRiskAlertEmail>[0]) {
  const labelRo: Record<string, string> = {
    blocked: 'BLOCAT', problematic: 'Problematic', watch: 'Watch',
  }
  const html = buildRiskAlertEmail(opts)
  return sendEmail({
    to: opts.to,
    subject: `🚨 Client ${labelRo[opts.riskLabel] || opts.riskLabel} — Comandă nouă #${opts.orderNumber || 'N/A'} (${opts.riskScore}/100) · ${opts.storeName}`,
    html,
  })
}

// ─── Trimitere raport săptămânal ──────────────────────────────────────────────
export async function sendWeeklyReport(opts: Parameters<typeof buildWeeklyReportEmail>[0]) {
  const html = buildWeeklyReportEmail(opts)
  const dateRange = `${opts.stats && opts.weekStart} → ${opts.weekEnd}`
  return sendEmail({
    to: opts.to,
    subject: `📊 Raport săptămânal Risk Shield · ${opts.storeName} · ${opts.stats.savedValue} ${opts.currency} pierderi evitate`,
    html,
  })
}