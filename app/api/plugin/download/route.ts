import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import { PLUGIN_VERSION, PLUGIN_SLUG } from '../config'

// ─── ZIP builder pur — fără dependințe externe, compatibil Vercel ────────────
function crc32(buf: Buffer): number {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function uint16LE(n: number): Buffer {
  const b = Buffer.alloc(2); b.writeUInt16LE(n); return b
}
function uint32LE(n: number): Buffer {
  const b = Buffer.alloc(4); b.writeUInt32LE(n); return b
}

function buildZip(filename: string, content: string): Buffer {
  const fileData    = Buffer.from(content, 'utf8')
  const fileName    = Buffer.from(filename, 'utf8')
  const crc         = crc32(fileData)
  const now         = new Date()
  const dosTime     = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate     = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  // Local file header
  const localHeader = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
    uint16LE(20),           // version needed
    uint16LE(0),            // flags
    uint16LE(0),            // compression (stored)
    uint16LE(dosTime),
    uint16LE(dosDate),
    uint32LE(crc),
    uint32LE(fileData.length),
    uint32LE(fileData.length),
    uint16LE(fileName.length),
    uint16LE(0),            // extra field length
    fileName,
  ])

  const localOffset = 0
  const localEntry  = Buffer.concat([localHeader, fileData])

  // Central directory
  const centralDir = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
    uint16LE(20),           // version made by
    uint16LE(20),           // version needed
    uint16LE(0),            // flags
    uint16LE(0),            // compression
    uint16LE(dosTime),
    uint16LE(dosDate),
    uint32LE(crc),
    uint32LE(fileData.length),
    uint32LE(fileData.length),
    uint16LE(fileName.length),
    uint16LE(0),            // extra
    uint16LE(0),            // comment
    uint16LE(0),            // disk start
    uint16LE(0),            // internal attr
    uint32LE(0),            // external attr
    uint32LE(localOffset),  // offset of local header
    fileName,
  ])

  const centralDirOffset = localEntry.length
  const centralDirSize   = centralDir.length

  // End of central directory
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // signature
    uint16LE(0),            // disk number
    uint16LE(0),            // disk with central dir
    uint16LE(1),            // entries on disk
    uint16LE(1),            // total entries
    uint32LE(centralDirSize),
    uint32LE(centralDirOffset),
    uint16LE(0),            // comment length
  ])

  return Buffer.concat([localEntry, centralDir, eocd])
}

// ─── Generator PHP plugin ────────────────────────────────────────────────────
function buildPluginPhp(cfg: {
  apiBase: string, userId: string, storeId: string, storeName: string,
  webhookSecret: string, agentName: string, widgetColor: string, widgetPos: string,
}): string {
  const { apiBase, userId, storeId, storeName, webhookSecret, agentName, widgetColor, widgetPos } = cfg
  const L: string[] = []
  const o = (s: string) => L.push(s)

  o('<?php')
  o('/**')
  o(` * Plugin Name: Hontrio${storeName ? ' — ' + storeName : ''}`)
  o(' * Plugin URI:  https://hontrio.com')
  o(' * Description: AI Agent + Risk Shield pentru WooCommerce. Powered by Hontrio.')
  o(` * Version:     ${PLUGIN_VERSION}`)
  o(' * Author:      Hontrio')
  o(' * Author URI:  https://hontrio.com')
  o(' * License:     GPL2')
  o(' * Requires at least: 5.8')
  o(' * Requires PHP: 7.4')
  o(' */')
  o('')
  o("if ( ! defined( 'ABSPATH' ) ) exit;")
  o('')
  o(`define( 'HONTRIO_VERSION',        '${PLUGIN_VERSION}' );`)
  o(`define( 'HONTRIO_API_BASE',       '${apiBase}' );`)
  o(`define( 'HONTRIO_USER_ID',        '${userId}' );`)
  o(`define( 'HONTRIO_STORE_ID',       '${storeId}' );`)
  o(`define( 'HONTRIO_WEBHOOK_SECRET', '${webhookSecret}' );`)
  o(`define( 'HONTRIO_WEBHOOK_URL',    '${apiBase}/api/risk/webhook' );`)
  o(`define( 'HONTRIO_AGENT_NAME',     '${agentName.replace(/'/g, "\\'")}' );`)
  o(`define( 'HONTRIO_WIDGET_COLOR',   '${widgetColor}' );`)
  o(`define( 'HONTRIO_WIDGET_POS',     '${widgetPos}' );`)
  o('')
  o("register_activation_hook( __FILE__, 'hontrio_activate' );")
  o('function hontrio_activate() {')
  o("    update_option( 'hontrio_needs_setup', true );")
  o("    set_transient( 'hontrio_just_activated', true, 60 );")
  o('}')
  o("register_deactivation_hook( __FILE__, 'hontrio_deactivate' );")
  o('function hontrio_deactivate() { hontrio_delete_webhooks(); }')
  o('')
  o("add_action( 'woocommerce_loaded', 'hontrio_maybe_setup' );")
  o('function hontrio_maybe_setup() {')
  o("    if ( ! get_option( 'hontrio_needs_setup' ) ) return;")
  o('    hontrio_register_webhooks();')
  o("    delete_option( 'hontrio_needs_setup' );")
  o('}')
  o('function hontrio_register_webhooks() {')
  o("    if ( ! function_exists( 'wc_get_webhook' ) ) return;")
  o("    $topics = array( 'order.created' => 'Hontrio — Comandă nouă', 'order.updated' => 'Hontrio — Actualizare' );")
  o("    $existing = get_option( 'hontrio_webhook_ids', array() );")
  o('    foreach ( $topics as $topic => $label ) {')
  o('        if ( ! empty( $existing[$topic] ) ) {')
  o('            $wh = wc_get_webhook( intval( $existing[$topic] ) );')
  o("            if ( $wh && $wh->get_id() && $wh->get_status() === 'active' ) continue;")
  o('        }')
  o('        $wh = new WC_Webhook();')
  o('        $wh->set_name( $label ); $wh->set_topic( $topic );')
  o('        $wh->set_delivery_url( HONTRIO_WEBHOOK_URL );')
  o('        $wh->set_secret( HONTRIO_WEBHOOK_SECRET );')
  o("        $wh->set_status( 'active' ); $wh->set_api_version( 'wp_api_v3' );")
  o('        $wh->set_user_id( get_current_user_id() ?: 1 );')
  o('        $id = $wh->save(); if ( $id ) $existing[$topic] = $id;')
  o('    }')
  o("    update_option( 'hontrio_webhook_ids', $existing );")
  o('}')
  o('function hontrio_delete_webhooks() {')
  o("    foreach ( get_option( 'hontrio_webhook_ids', array() ) as $id ) {")
  o('        $wh = wc_get_webhook( intval( $id ) ); if ( $wh ) $wh->delete( true );')
  o('    }')
  o("    delete_option( 'hontrio_webhook_ids' );")
  o('}')
  o('')
  o("add_action( 'wp_footer', 'hontrio_inject_widget' );")
  o('function hontrio_inject_widget() {')
  o('    if ( is_admin() ) return; ?>')
  o('    <script>')
  o('    window.HontrioConfig = {')
  o('        userId:   "<?php echo esc_js( HONTRIO_USER_ID ); ?>",')
  o('        storeId:  "<?php echo esc_js( HONTRIO_STORE_ID ); ?>",')
  o('        apiBase:  "<?php echo esc_js( HONTRIO_API_BASE ); ?>",')
  o('        color:    "<?php echo esc_js( HONTRIO_WIDGET_COLOR ); ?>",')
  o('        position: "<?php echo esc_js( HONTRIO_WIDGET_POS ); ?>"')
  o('    };')
  o('    </script>')
  o('    <script src="<?php echo esc_url( HONTRIO_API_BASE ); ?>/agent-widget.js?v=<?php echo HONTRIO_VERSION; ?>" defer></script>')
  o('    <?php')
  o('}')
  o('')
  o("add_filter( 'pre_set_site_transient_update_plugins', 'hontrio_check_update' );")
  o('function hontrio_check_update( $transient ) {')
  o('    if ( empty( $transient->checked ) ) return $transient;')
  o("    $res = wp_remote_get( HONTRIO_API_BASE . '/api/plugin/update?v=' . HONTRIO_VERSION, array( 'timeout' => 10 ) );")
  o('    if ( is_wp_error( $res ) ) return $transient;')
  o("    $data = json_decode( wp_remote_retrieve_body( $res ), true );")
  o("    if ( empty( $data['has_update'] ) ) return $transient;")
  o("    $transient->response['hontrio/hontrio.php'] = (object) array(")
  o("        'slug' => 'hontrio', 'plugin' => 'hontrio/hontrio.php',")
  o("        'new_version' => $data['new_version'], 'url' => 'https://hontrio.com',")
  o("        'package' => $data['download_url'],")
  o('    );')
  o('    return $transient;')
  o('}')
  o("add_filter( 'plugins_api', 'hontrio_plugin_info', 20, 3 );")
  o('function hontrio_plugin_info( $result, $action, $args ) {')
  o("    if ( $action !== 'plugin_information' || $args->slug !== 'hontrio' ) return $result;")
  o("    $res = wp_remote_get( HONTRIO_API_BASE . '/api/plugin/update?v=' . HONTRIO_VERSION, array( 'timeout' => 10 ) );")
  o('    if ( is_wp_error( $res ) ) return $result;')
  o("    $data = json_decode( wp_remote_retrieve_body( $res ), true );")
  o('    if ( empty( $data ) ) return $result;')
  o('    return (object) array(')
  o("        'name' => 'Hontrio', 'slug' => 'hontrio',")
  o("        'version' => $data['new_version'] ?? HONTRIO_VERSION,")
  o("        'requires' => '5.8', 'tested' => '6.6',")
  o("        'download_link' => $data['download_url'] ?? '',")
  o("        'sections' => $data['sections'] ?? array( 'description' => 'AI Agent + Risk Shield pentru WooCommerce.' ),")
  o('    );')
  o('}')
  o('')
  o("add_action( 'admin_menu', 'hontrio_menu' );")
  o("function hontrio_menu() { add_menu_page( 'Hontrio', 'Hontrio', 'manage_woocommerce', 'hontrio', 'hontrio_page', 'dashicons-shield', 56 ); }")
  o('function hontrio_page() {')
  o("    if ( isset( $_POST['hontrio_action'] ) && $_POST['hontrio_action'] === 'reregister' && check_admin_referer( 'hontrio_reregister' ) ) {")
  o('        hontrio_delete_webhooks(); hontrio_register_webhooks();')
  o("        echo '<div class=\"notice notice-success\"><p>✓ Webhook-uri re-înregistrate!</p></div>';")
  o('    }')
  o("    $ids = get_option( 'hontrio_webhook_ids', array() ); $ok = count( $ids ) >= 2; $dash = HONTRIO_API_BASE; ?>")
  o('    <div class="wrap" style="max-width:680px">')
  o('        <h1>🛡️ Hontrio <span style="font-size:13px;font-weight:normal;color:#6b7280">v<?php echo HONTRIO_VERSION; ?></span></h1>')
  o('        <p><a href="<?php echo esc_url($dash); ?>" target="_blank">Deschide dashboard →</a></p>')
  o('        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0">')
  o('            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px">')
  o('                <h3 style="margin:0 0 8px">🤖 AI Agent</h3><p style="color:#12b76a;margin:0">● Activ</p>')
  o('                <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Agent: <?php echo esc_html(HONTRIO_AGENT_NAME); ?></p>')
  o('                <a href="<?php echo esc_url($dash.\'/agent\'); ?>" target="_blank" class="button" style="margin-top:10px">Configurează</a>')
  o('            </div>')
  o('            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px">')
  o('                <h3 style="margin:0 0 8px">🛡️ Risk Shield</h3>')
  o('                <p style="color:<?php echo $ok?\'#12b76a\':\'#f04438\';?>;margin:0"><?php echo $ok?\'● Activ\':\'● Inactiv\';?></p>')
  o('                <a href="<?php echo esc_url($dash.\'/risk\'); ?>" target="_blank" class="button" style="margin-top:10px">Dashboard</a>')
  o('            </div>')
  o('        </div>')
  o('        <?php if(!empty($ids)): ?><h3>Webhooks</h3><ul>')
  o('        <?php foreach($ids as $t=>$i): $wh=wc_get_webhook(intval($i)); $st=($wh&&$wh->get_status()==="active")?"✓":"✗"; ?>')
  o('            <li><?php echo esc_html("$st $t (ID: $i)"); ?></li>')
  o('        <?php endforeach; ?></ul><?php endif; ?>')
  o('        <form method="post" style="margin-top:16px"><?php wp_nonce_field(\'hontrio_reregister\'); ?>')
  o('            <input type="hidden" name="hontrio_action" value="reregister">')
  o('            <button type="submit" class="button button-secondary"><?php echo $ok?\'🔄 Re-înregistrează\':\'⚡ Înregistrează webhooks\';?></button>')
  o('        </form></div><?php')
  o('}')
  o("add_action( 'admin_notices', 'hontrio_notice' );")
  o('function hontrio_notice() {')
  o("    if ( ! get_transient( 'hontrio_just_activated' ) ) return; delete_transient( 'hontrio_just_activated' ); ?>")
  o('    <div class="notice notice-success is-dismissible"><p>')
  o('        <strong>Hontrio</strong> activat! Agent <strong><?php echo esc_html(HONTRIO_AGENT_NAME); ?></strong> + Risk Shield funcționează.')
  o('        <a href="<?php echo esc_url(admin_url(\'admin.php?page=hontrio\')); ?>">Verifică →</a>')
  o('    </p></div><?php')
  o('}')

  return L.join('\n')
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId   = (session.user as any).id
    const supabase = createAdminClient()
    const apiBase  = process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'

    const [storeRes, configRes] = await Promise.all([
      supabase.from('stores').select('id, store_url, webhook_secret').eq('user_id', userId).single(),
      supabase.from('agent_configs').select('agent_name, widget_color, widget_position').eq('user_id', userId).single(),
    ])
    const store  = storeRes.data
    const config = configRes.data

    console.log('[Plugin Download] userId:', userId, 'store:', store, 'storeErr:', storeRes.error)
    if (!store) return NextResponse.json({ error: 'Niciun magazin conectat. userId=' + userId + ' err=' + storeRes.error?.message }, { status: 400 })

    let secret = store.webhook_secret
    if (!secret) {
      secret = crypto.randomBytes(32).toString('hex')
      await supabase.from('stores').update({ webhook_secret: secret }).eq('id', store.id)
    }

    const php = buildPluginPhp({
      apiBase, userId, storeId: store.id,
      storeName:    store.store_url?.replace(/^https?:\/\//,'').replace(/\/$/,'') || '',
      webhookSecret: secret,
      agentName:    config?.agent_name      || 'Asistent Hontrio',
      widgetColor:  config?.widget_color    || '#2563eb',
      widgetPos:    config?.widget_position || 'bottom-right',
    })

    // ZIP pur în memorie — fără dependințe externe
    const zipBuffer = buildZip(`${PLUGIN_SLUG}/${PLUGIN_SLUG}.php`, php)

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${PLUGIN_SLUG}.zip"`,
        'Content-Length':      String(zipBuffer.length),
      }
    })
  } catch (err: any) {
    console.error('[Plugin Download]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}