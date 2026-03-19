import { sendEmail } from '@/lib/email'

// ─── Risk alert email template ────────────────────────────────────────────────
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
  const labelEn: Record<string, string> = {
    blocked: 'BLOCKED',
    problematic: 'PROBLEMATIC',
    watch: 'WATCH',
  }
  const color = labelColors[riskLabel] || '#6b7280'
  const labelText = labelEn[riskLabel] || riskLabel.toUpperCase()

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

    <!-- Alert header -->
    <div style="background:${color};border-radius:16px 16px 0 0;padding:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.7);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Risk Shield · ${storeName}</p>
      <h1 style="color:white;font-size:22px;font-weight:800;margin:0">⚠️ Customer ${labelText}</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:8px 0 0">New order requires immediate attention</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:24px;border-radius:0 0 16px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

      <!-- Risk score -->
      <div style="display:flex;align-items:center;gap:16px;padding:16px;background:#fafafa;border-radius:12px;margin-bottom:20px;border:1px solid #e5e7eb">
        <div style="width:56px;height:56px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="color:white;font-size:18px;font-weight:900">${riskScore}</span>
        </div>
        <div>
          <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Risk Score</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#111827">${recommendation}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#6b7280">Refusal probability: <strong style="color:${refusalProbability > 60 ? '#dc2626' : '#d97706'}">${refusalProbability}%</strong></p>
        </div>
      </div>

      <!-- Customer details -->
      <div style="margin-bottom:20px">
        <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Customer details</p>
        <table style="width:100%;border-collapse:collapse">
          ${customerName ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0;width:100px">Name</td><td style="font-size:13px;font-weight:600;color:#111827">${customerName}</td></tr>` : ''}
          ${customerPhone ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0">Phone</td><td style="font-size:13px;font-weight:600;color:#111827">${customerPhone}</td></tr>` : ''}
          ${customerEmail ? `<tr><td style="font-size:12px;color:#6b7280;padding:4px 0">Email</td><td style="font-size:13px;font-weight:600;color:#111827">${customerEmail}</td></tr>` : ''}
          <tr><td style="font-size:12px;color:#6b7280;padding:4px 0">Order</td><td style="font-size:13px;font-weight:600;color:#111827">#${orderNumber || 'N/A'} — ${orderValue} ${currency}</td></tr>
        </table>
      </div>

      <!-- Risk flags -->
      ${flags.length > 0 ? `
      <div style="margin-bottom:20px">
        <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Detected flags</p>
        ${flagsHtml}
      </div>` : ''}

      <!-- CTA -->
      <a href="${dashboardUrl}" style="display:block;text-align:center;background:#111827;color:white;font-size:13px;font-weight:700;padding:14px 24px;border-radius:10px;text-decoration:none;margin-top:8px">
        Open customer profile →
      </a>

    </div>

    <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0">
      Hontrio Risk Shield · <a href="${dashboardUrl}/settings" style="color:#9ca3af">Disable notifications</a>
    </p>
  </div>
</body>
</html>`
}

// ─── Weekly report email template ─────────────────────────────────────────────
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
    savedValue: number          // value of blocked orders = losses avoided
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
      refusalRateChange: number  // positive = worse, negative = better
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
    ? `Refusal rate increased by ${Math.abs(trend).toFixed(1)}% compared to last week`
    : `Refusal rate decreased by ${Math.abs(trend).toFixed(1)}% — improvement!`

  const topCustomersHtml = stats.topRiskCustomers.slice(0, 5).map((c, i) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6">${i + 1}. ${c.name || c.phone || 'Unknown'}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:${c.score >= 81 ? '#dc2626' : c.score >= 61 ? '#ea580c' : '#d97706'};border-bottom:1px solid #f3f4f6">${c.score}/100</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6">${c.refusedOrders}/${c.totalOrders} refused</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#111827,#1f2937);border-radius:16px 16px 0 0;padding:28px;text-align:center">
      <p style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 6px">Weekly Report · ${storeName}</p>
      <h1 style="color:white;font-size:24px;font-weight:900;margin:0">Risk Shield</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:8px 0 0">${weekStart} → ${weekEnd}</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:28px;border-radius:0 0 16px 16px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

      <!-- Weekly trend -->
      <div style="background:${trend > 0 ? '#fef2f2' : '#f0fdf4'};border:1px solid ${trend > 0 ? '#fecaca' : '#bbf7d0'};border-radius:10px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;gap:12px">
        <span style="font-size:20px">${trend > 0 ? '⚠️' : '✅'}</span>
        <p style="margin:0;font-size:13px;color:${trendColor};font-weight:600">${trendText}</p>
      </div>

      <!-- KPI grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
          <p style="font-size:28px;font-weight:900;color:#111827;margin:0">${stats.collectionRate}%</p>
          <p style="font-size:11px;color:#6b7280;margin:4px 0 0">Collection rate</p>
        </div>
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
          <p style="font-size:28px;font-weight:900;color:${stats.refusalRate > 20 ? '#dc2626' : '#111827'};margin:0">${stats.refusalRate}%</p>
          <p style="font-size:11px;color:#6b7280;margin:4px 0 0">Refusal rate</p>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
          <p style="font-size:22px;font-weight:900;color:#16a34a;margin:0">${stats.savedValue} ${currency}</p>
          <p style="font-size:11px;color:#16a34a;margin:4px 0 0">💰 Losses avoided</p>
        </div>
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
          <p style="font-size:28px;font-weight:900;color:#dc2626;margin:0">${stats.blockedOrders}</p>
          <p style="font-size:11px;color:#6b7280;margin:4px 0 0">Blocked orders</p>
        </div>
      </div>

      <!-- Activity statistics -->
      <div style="margin-bottom:24px">
        <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px">Activity statistics</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;font-size:13px;color:#6b7280">Orders processed</td><td style="font-size:13px;font-weight:600;color:#111827;text-align:right">${stats.totalOrders}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#6b7280">New customers</td><td style="font-size:13px;font-weight:600;color:#111827;text-align:right">${stats.newCustomers}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#6b7280">Alerts generated</td><td style="font-size:13px;font-weight:600;color:#111827;text-align:right">${stats.alertsGenerated}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#6b7280">Refused parcels</td><td style="font-size:13px;font-weight:700;color:#dc2626;text-align:right">${stats.refusedOrders} (${stats.totalRefusalValue} ${currency})</td></tr>
        </table>
      </div>

      <!-- Top high-risk customers -->
      ${stats.topRiskCustomers.length > 0 ? `
      <div style="margin-bottom:24px">
        <p style="font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px">Top high-risk customers</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600">Customer</th>
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600">Score</th>
              <th style="padding:8px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:600">Orders</th>
            </tr>
          </thead>
          <tbody>${topCustomersHtml}</tbody>
        </table>
      </div>` : ''}

      <!-- CTA -->
      <a href="${dashboardUrl}/risk" style="display:block;text-align:center;background:#111827;color:white;font-size:13px;font-weight:700;padding:14px 24px;border-radius:10px;text-decoration:none">
        Open Risk Shield →
      </a>

    </div>

    <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0">
      Hontrio Risk Shield · <a href="${dashboardUrl}/risk/settings" style="color:#9ca3af">Manage notifications</a>
    </p>
  </div>
</body>
</html>`
}

// ─── Send instant risk alert ───────────────────────────────────────────────────
export async function sendRiskAlert(opts: Parameters<typeof buildRiskAlertEmail>[0]) {
  const labelEn: Record<string, string> = {
    blocked: 'BLOCKED', problematic: 'Problematic', watch: 'Watch',
  }
  const html = buildRiskAlertEmail(opts)
  return sendEmail({
    to: opts.to,
    subject: `🚨 Customer ${labelEn[opts.riskLabel] || opts.riskLabel} — New Order #${opts.orderNumber || 'N/A'} (${opts.riskScore}/100) · ${opts.storeName}`,
    html,
  })
}

// ─── Send weekly report ────────────────────────────────────────────────────────
export async function sendWeeklyReport(opts: Parameters<typeof buildWeeklyReportEmail>[0]) {
  const html = buildWeeklyReportEmail(opts)
  const dateRange = `${opts.stats && opts.weekStart} → ${opts.weekEnd}`
  return sendEmail({
    to: opts.to,
    subject: `📊 Weekly Risk Shield Report · ${opts.storeName} · ${opts.stats.savedValue} ${opts.currency} losses avoided`,
    html,
  })
}
