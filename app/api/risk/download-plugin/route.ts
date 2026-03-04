import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import archiver from 'archiver'
import crypto from 'crypto'

function generatePluginPhp(params: {
  apiBase: string
  webhookUrl: string
  webhookSecret: string
  storeId: string
  storeName: string
}): string {
  const { apiBase, webhookUrl, webhookSecret, storeId, storeName } = params

  // PHP scris ca string concatenat - fara template literals ca sa evitam escaping
  const lines: string[] = []
  const p = (line: string) => lines.push(line)

  p('<?php')
  p('/**')
  p(' * Plugin Name: Hontrio Risk Shield — ' + storeName)
  p(' * Plugin URI: https://hontrio.com')
  p(' * Description: Sincronizare automata comenzi WooCommerce cu Hontrio Risk Shield.')
  p(' * Version: 1.0.3')
  p(' * Author: Hontrio')
  p(' * License: GPL2')
  p(' */')
  p('')
  p("if ( ! defined( 'ABSPATH' ) ) exit;")
  p('')
  p("define( 'HONTRIO_RISK_VERSION',     '1.0.3' );")
  p("define( 'HONTRIO_RISK_API_BASE',    '" + apiBase + "' );")
  p("define( 'HONTRIO_RISK_WEBHOOK_URL', '" + webhookUrl + "' );")
  p("define( 'HONTRIO_RISK_SECRET',      '" + webhookSecret + "' );")
  p("define( 'HONTRIO_RISK_STORE_ID',    '" + storeId + "' );")
  p('')
  p('// La activare: seteaza flag, webhooks se inregistreaza la primul woocommerce_loaded')
  p("register_activation_hook( __FILE__, 'hontrio_risk_activate' );")
  p('function hontrio_risk_activate() {')
  p("    update_option( 'hontrio_risk_needs_setup', true );")
  p("    set_transient( 'hontrio_risk_activated', true, 60 );")
  p('}')
  p('')
  p("register_deactivation_hook( __FILE__, 'hontrio_risk_deactivate' );")
  p('function hontrio_risk_deactivate() {')
  p('    hontrio_risk_delete_webhooks();')
  p('}')
  p('')
  p("add_action( 'woocommerce_loaded', 'hontrio_risk_maybe_setup' );")
  p('function hontrio_risk_maybe_setup() {')
  p("    if ( ! get_option( 'hontrio_risk_needs_setup' ) ) return;")
  p('    hontrio_risk_register_webhooks();')
  p("    delete_option( 'hontrio_risk_needs_setup' );")
  p('}')
  p('')
  p('function hontrio_risk_register_webhooks() {')
  p("    if ( ! function_exists( 'wc_get_webhook' ) ) return;")
  p('    $topics = array(')
  p("        'order.created' => 'Hontrio Risk — Comanda noua',")
  p("        'order.updated' => 'Hontrio Risk — Actualizare comanda',")
  p('    );')
  p("    $existing = get_option( 'hontrio_risk_webhook_ids', array() );")
  p('    foreach ( $topics as $topic => $name ) {')
  p('        if ( ! empty( $existing[ $topic ] ) ) {')
  p('            $wh = wc_get_webhook( intval( $existing[ $topic ] ) );')
  p("            if ( $wh && $wh->get_id() && $wh->get_status() === 'active' ) continue;")
  p('        }')
  p('        $webhook = new WC_Webhook();')
  p('        $webhook->set_name( $name );')
  p('        $webhook->set_topic( $topic );')
  p('        $webhook->set_delivery_url( HONTRIO_RISK_WEBHOOK_URL );')
  p('        $webhook->set_secret( HONTRIO_RISK_SECRET );')
  p("        $webhook->set_status( 'active' );")
  p("        $webhook->set_api_version( 'wp_api_v3' );")
  p('        $webhook->set_user_id( get_current_user_id() ?: 1 );')
  p('        $id = $webhook->save();')
  p('        if ( $id ) { $existing[ $topic ] = $id; }')
  p('    }')
  p("    update_option( 'hontrio_risk_webhook_ids', $existing );")
  p('}')
  p('')
  p('function hontrio_risk_delete_webhooks() {')
  p("    $ids = get_option( 'hontrio_risk_webhook_ids', array() );")
  p('    foreach ( $ids as $id ) {')
  p('        $webhook = wc_get_webhook( intval( $id ) );')
  p('        if ( $webhook ) $webhook->delete( true );')
  p('    }')
  p("    delete_option( 'hontrio_risk_webhook_ids' );")
  p('}')
  p('')
  p("add_action( 'admin_notices', 'hontrio_risk_notices' );")
  p('function hontrio_risk_notices() {')
  p("    if ( ! get_transient( 'hontrio_risk_activated' ) ) return;")
  p("    delete_transient( 'hontrio_risk_activated' );")
  p('    echo \'<div class="notice notice-info is-dismissible"><p><strong>Hontrio Risk Shield</strong> activat. <a href="\' . admin_url(\'admin.php?page=hontrio-risk\') . \'">Verifica status →</a></p></div>\';')
  p('}')
  p('')
  p("add_action( 'admin_menu', 'hontrio_risk_admin_menu' );")
  p('function hontrio_risk_admin_menu() {')
  p("    add_submenu_page( 'woocommerce', 'Hontrio Risk Shield', 'Risk Shield', 'manage_woocommerce', 'hontrio-risk', 'hontrio_risk_settings_page' );")
  p('}')
  p('')
  p('function hontrio_risk_settings_page() {')
  p("    if ( isset( $_POST['hontrio_action'] ) && $_POST['hontrio_action'] === 'reregister' && check_admin_referer('hontrio_reregister') ) {")
  p('        hontrio_risk_delete_webhooks();')
  p('        hontrio_risk_register_webhooks();')
  p('        echo \'<div class="notice notice-success"><p>Webhook-uri re-inregistrate cu succes!</p></div>\';')
  p('    }')
  p("    $ids = get_option( 'hontrio_risk_webhook_ids', array() );")
  p('    $ok  = count( $ids ) >= 2;')
  p("    echo '<div class=\"wrap\">';")
  p("    echo '<h1>🛡️ Hontrio Risk Shield</h1>';")
  p("    echo '<p><strong>Status:</strong> ' . ( $ok ? '<span style=\"color:#12b76a\">● Activ</span>' : '<span style=\"color:#f04438\">● Inactiv</span>' ) . '</p>';")
  p("    echo '<p><strong>Webhook URL:</strong> <code>' . esc_html( HONTRIO_RISK_WEBHOOK_URL ) . '</code></p>';")
  p('    if ( ! empty( $ids ) ) {')
  p("        echo '<p><strong>Webhooks:</strong></p><ul>';")
  p('        foreach ( $ids as $t => $i ) {')
  p('            $wh = wc_get_webhook( intval( $i ) );')
  p("            $st = ( $wh && $wh->get_status() === 'active' ) ? '✓' : '✗';")
  p("            echo '<li>' . esc_html( $st . ' ' . $t ) . ' (ID: ' . intval( $i ) . ')</li>';")
  p('        }')
  p("        echo '</ul>';")
  p('    }')
  p("    echo '<form method=\"post\">';")
  p("    wp_nonce_field( 'hontrio_reregister' );")
  p("    echo '<input type=\"hidden\" name=\"hontrio_action\" value=\"reregister\">';")
  p("    echo '<button type=\"submit\" class=\"button button-primary\">' . ( $ok ? 'Re-inregistreaza Webhook-uri' : '⚡ Inregistreaza Webhook-uri acum' ) . '</button>';")
  p("    echo '</form>';")
  p("    echo '<br><a href=\"" + apiBase + '/risk' + "\" class=\"button\" target=\"_blank\">Deschide Dashboard →</a>';")
  p("    echo '</div>';")
  p('}')

  return lines.join('\n')
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()
    const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'

    const { data: store } = await supabase
      .from('stores')
      .select('id, store_url, webhook_secret')
      .eq('user_id', userId)
      .single()

    if (!store) return NextResponse.json({ error: 'Niciun magazin conectat' }, { status: 404 })

    let webhookSecret = store.webhook_secret
    if (!webhookSecret) {
      webhookSecret = crypto.randomBytes(32).toString('hex')
      await supabase.from('stores').update({ webhook_secret: webhookSecret }).eq('id', store.id)
    }

    const pluginSlug = 'hontrio-risk-shield'
    const pluginPhp = generatePluginPhp({
      apiBase,
      webhookUrl: `${apiBase}/api/risk/webhook`,
      webhookSecret,
      storeId: store.id,
      storeName: store.store_url || 'Magazinul tau',
    })

    const tmpDir = join(tmpdir(), `hontrio-risk-${userId.substring(0, 8)}`)
    mkdirSync(join(tmpDir, pluginSlug), { recursive: true })
    writeFileSync(join(tmpDir, pluginSlug, `${pluginSlug}.php`), pluginPhp)

    const chunks: Buffer[] = []
    const archive = archiver('zip', { zlib: { level: 9 } })

    await new Promise<void>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => chunks.push(chunk))
      archive.on('end', resolve)
      archive.on('error', reject)
      archive.directory(join(tmpDir, pluginSlug), pluginSlug)
      archive.finalize()
    })

    const zipBuffer = Buffer.concat(chunks)

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${pluginSlug}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (err: any) {
    console.error('Risk plugin download error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}