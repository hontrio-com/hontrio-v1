import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createWriteStream, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import archiver from 'archiver'
import crypto from 'crypto'
import { PLUGIN_VERSION, PLUGIN_SLUG } from '../update/route'

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

  // Activare/dezactivare
  o("register_activation_hook( __FILE__, 'hontrio_activate' );")
  o('function hontrio_activate() {')
  o("    update_option( 'hontrio_needs_setup', true );")
  o("    set_transient( 'hontrio_just_activated', true, 60 );")
  o('}')
  o('')
  o("register_deactivation_hook( __FILE__, 'hontrio_deactivate' );")
  o('function hontrio_deactivate() { hontrio_delete_webhooks(); }')
  o('')

  // Setup webhooks la prima rulare
  o("add_action( 'woocommerce_loaded', 'hontrio_maybe_setup' );")
  o('function hontrio_maybe_setup() {')
  o("    if ( ! get_option( 'hontrio_needs_setup' ) ) return;")
  o('    hontrio_register_webhooks();')
  o("    delete_option( 'hontrio_needs_setup' );")
  o('}')
  o('')
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
  o('        $wh->set_name( $label );')
  o('        $wh->set_topic( $topic );')
  o('        $wh->set_delivery_url( HONTRIO_WEBHOOK_URL );')
  o('        $wh->set_secret( HONTRIO_WEBHOOK_SECRET );')
  o("        $wh->set_status( 'active' );")
  o("        $wh->set_api_version( 'wp_api_v3' );")
  o('        $wh->set_user_id( get_current_user_id() ?: 1 );')
  o('        $id = $wh->save();')
  o('        if ( $id ) $existing[$topic] = $id;')
  o('    }')
  o("    update_option( 'hontrio_webhook_ids', $existing );")
  o('}')
  o('')
  o('function hontrio_delete_webhooks() {')
  o("    foreach ( get_option( 'hontrio_webhook_ids', array() ) as $id ) {")
  o('        $wh = wc_get_webhook( intval( $id ) );')
  o('        if ( $wh ) $wh->delete( true );')
  o('    }')
  o("    delete_option( 'hontrio_webhook_ids' );")
  o('}')
  o('')

  // AI Agent widget
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

  // ── AUTO-UPDATE ─────────────────────────────────────────────────────────────
  // Aceasta sectiune face sa apara butonul "Actualizează" in WordPress → Plugins
  o("add_filter( 'pre_set_site_transient_update_plugins', 'hontrio_check_update' );")
  o('function hontrio_check_update( $transient ) {')
  o('    if ( empty( $transient->checked ) ) return $transient;')
  o("    $res = wp_remote_get( HONTRIO_API_BASE . '/api/plugin/update?v=' . HONTRIO_VERSION, array( 'timeout' => 10 ) );")
  o('    if ( is_wp_error( $res ) ) return $transient;')
  o("    $data = json_decode( wp_remote_retrieve_body( $res ), true );")
  o("    if ( empty( $data['has_update'] ) ) return $transient;")
  o("    $transient->response['hontrio/hontrio.php'] = (object) array(")
  o("        'slug'        => 'hontrio',")
  o("        'plugin'      => 'hontrio/hontrio.php',")
  o("        'new_version' => $data['new_version'],")
  o("        'url'         => 'https://hontrio.com',")
  o("        'package'     => $data['download_url'],")
  o('    );')
  o('    return $transient;')
  o('}')
  o('')
  // Informatii plugin (click "View details" in WP)
  o("add_filter( 'plugins_api', 'hontrio_plugin_info', 20, 3 );")
  o('function hontrio_plugin_info( $result, $action, $args ) {')
  o("    if ( $action !== 'plugin_information' || $args->slug !== 'hontrio' ) return $result;")
  o("    $res = wp_remote_get( HONTRIO_API_BASE . '/api/plugin/update?v=' . HONTRIO_VERSION, array( 'timeout' => 10 ) );")
  o('    if ( is_wp_error( $res ) ) return $result;')
  o("    $data = json_decode( wp_remote_retrieve_body( $res ), true );")
  o('    if ( empty( $data ) ) return $result;')
  o('    return (object) array(')
  o("        'name'          => 'Hontrio',")
  o("        'slug'          => 'hontrio',")
  o("        'version'       => $data['new_version'] ?? HONTRIO_VERSION,")
  o("        'requires'      => '5.8',")
  o("        'tested'        => '6.6',")
  o("        'download_link' => $data['download_url'] ?? '',")
  o("        'sections'      => $data['sections'] ?? array( 'description' => 'AI Agent + Risk Shield pentru WooCommerce.' ),")
  o('    );')
  o('}')
  o('')

  // Pagina admin
  o("add_action( 'admin_menu', 'hontrio_menu' );")
  o("function hontrio_menu() { add_menu_page( 'Hontrio', 'Hontrio', 'manage_woocommerce', 'hontrio', 'hontrio_page', 'dashicons-shield', 56 ); }")
  o('')
  o('function hontrio_page() {')
  o("    if ( isset( $_POST['hontrio_action'] ) && $_POST['hontrio_action'] === 'reregister' && check_admin_referer( 'hontrio_reregister' ) ) {")
  o('        hontrio_delete_webhooks(); hontrio_register_webhooks();')
  o("        echo '<div class=\"notice notice-success\"><p>✓ Webhook-uri re-înregistrate!</p></div>';")
  o('    }')
  o("    $ids   = get_option( 'hontrio_webhook_ids', array() );")
  o('    $ok    = count( $ids ) >= 2;')
  o("    $dash  = HONTRIO_API_BASE; ?>")
  o('    <div class="wrap" style="max-width:680px">')
  o(`        <h1>🛡️ Hontrio <span style="font-size:13px;font-weight:normal;color:#6b7280">v<?php echo HONTRIO_VERSION; ?></span></h1>`)
  o('        <p><a href="<?php echo esc_url($dash); ?>" target="_blank">Deschide dashboard →</a></p>')
  o('        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0">')
  o('            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px">')
  o('                <h3 style="margin:0 0 8px">🤖 AI Agent</h3>')
  o('                <p style="color:#12b76a;margin:0">● Activ</p>')
  o('                <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Agent: <?php echo esc_html(HONTRIO_AGENT_NAME); ?></p>')
  o('                <a href="<?php echo esc_url($dash.\'/agent\'); ?>" target="_blank" class="button" style="margin-top:10px">Configurează</a>')
  o('            </div>')
  o('            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px">')
  o('                <h3 style="margin:0 0 8px">🛡️ Risk Shield</h3>')
  o('                <p style="color:<?php echo $ok?\'#12b76a\':\'#f04438\'; ?>;margin:0"><?php echo $ok?\'● Activ\':\'● Inactiv\'; ?></p>')
  o('                <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Webhooks: order.created + order.updated</p>')
  o('                <a href="<?php echo esc_url($dash.\'/risk\'); ?>" target="_blank" class="button" style="margin-top:10px">Dashboard</a>')
  o('            </div>')
  o('        </div>')
  o('        <?php if(!empty($ids)): ?>')
  o('        <h3>Webhooks</h3><ul>')
  o('        <?php foreach($ids as $t=>$i): $wh=wc_get_webhook(intval($i)); $st=($wh&&$wh->get_status()==="active")?"✓":"✗"; ?>')
  o('            <li><?php echo esc_html("$st $t (ID: $i)"); ?></li>')
  o('        <?php endforeach; ?></ul>')
  o('        <?php endif; ?>')
  o('        <form method="post" style="margin-top:16px">')
  o('            <?php wp_nonce_field(\'hontrio_reregister\'); ?>')
  o('            <input type="hidden" name="hontrio_action" value="reregister">')
  o('            <button type="submit" class="button button-secondary"><?php echo $ok?\'🔄 Re-înregistrează webhooks\':\'⚡ Înregistrează webhooks acum\'; ?></button>')
  o('        </form>')
  o('    </div>')
  o('    <?php')
  o('}')
  o('')
  // Admin notice dupa activare
  o("add_action( 'admin_notices', 'hontrio_notice' );")
  o('function hontrio_notice() {')
  o("    if ( ! get_transient( 'hontrio_just_activated' ) ) return;")
  o("    delete_transient( 'hontrio_just_activated' ); ?>")
  o('    <div class="notice notice-success is-dismissible"><p>')
  o('        <strong>Hontrio</strong> activat! AI Agent <strong><?php echo esc_html(HONTRIO_AGENT_NAME); ?></strong> + Risk Shield funcționează.')
  o('        <a href="<?php echo esc_url(admin_url(\'admin.php?page=hontrio\')); ?>">Verifică status →</a>')
  o('    </p></div>')
  o('    <?php')
  o('}')

  return L.join('\n')
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId  = (session.user as any).id
    const supabase = createAdminClient()
    const apiBase  = process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'

    const [{ data: store }, { data: config }] = await Promise.all([
      supabase.from('stores').select('id, store_url, store_name, webhook_secret').eq('user_id', userId).single(),
      supabase.from('agent_configs').select('agent_name, widget_color, widget_position').eq('user_id', userId).single(),
    ])

    if (!store) return NextResponse.json({ error: 'Niciun magazin conectat.' }, { status: 404 })

    let secret = store.webhook_secret
    if (!secret) {
      secret = crypto.randomBytes(32).toString('hex')
      await supabase.from('stores').update({ webhook_secret: secret }).eq('id', store.id)
    }

    const php = buildPluginPhp({
      apiBase, userId, storeId: store.id,
      storeName:   store.store_name || store.store_url?.replace(/^https?:\/\//,'').replace(/\/$/,'') || '',
      webhookSecret: secret,
      agentName:   config?.agent_name    || 'Asistent Hontrio',
      widgetColor: config?.widget_color  || '#2563eb',
      widgetPos:   config?.widget_position || 'bottom-right',
    })

    const tmpDir    = join(tmpdir(), `hontrio-${userId.slice(0,8)}`)
    const pluginDir = join(tmpDir, PLUGIN_SLUG)
    mkdirSync(pluginDir, { recursive: true })
    writeFileSync(join(pluginDir, `${PLUGIN_SLUG}.php`), php)

    const zipPath = join(tmpDir, `${PLUGIN_SLUG}.zip`)
    await new Promise<void>((res, rej) => {
      const out = createWriteStream(zipPath)
      const arc = archiver('zip', { zlib: { level: 6 } })
      out.on('close', res); arc.on('error', rej)
      arc.pipe(out)
      arc.file(join(pluginDir, `${PLUGIN_SLUG}.php`), { name: `${PLUGIN_SLUG}/${PLUGIN_SLUG}.php` })
      arc.finalize()
    })

    const buf = readFileSync(zipPath)
    try { rmSync(tmpDir, { recursive: true }) } catch {}

    return new NextResponse(buf, {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${PLUGIN_SLUG}.zip"`,
        'Content-Length':      String(buf.length),
      }
    })
  } catch (err: any) {
    console.error('[Plugin Download]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}