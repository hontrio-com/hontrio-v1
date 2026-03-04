import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import archiver from 'archiver'
import crypto from 'crypto'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()
    const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'

    // Ia store-ul utilizatorului
    const { data: store } = await supabase
      .from('stores')
      .select('id, store_url, store_name')
      .eq('user_id', userId)
      .single()

    if (!store) return NextResponse.json({ error: 'Niciun magazin conectat' }, { status: 404 })

    // Generează sau recuperează webhook_secret unic per magazin
    const { data: settings } = await supabase
      .from('risk_store_settings')
      .select('webhook_secret')
      .eq('store_id', store.id)
      .single()

    let webhookSecret = settings?.webhook_secret
    if (!webhookSecret) {
      webhookSecret = crypto.randomBytes(32).toString('hex')
      await supabase
        .from('risk_store_settings')
        .upsert({ store_id: store.id, user_id: userId, webhook_secret: webhookSecret })
    }

    const storeName = store.store_name || store.store_url || 'Magazinul tău'
    const pluginSlug = 'hontrio-risk-shield'
    const webhookUrl = `${apiBase}/api/risk/webhook`

    const pluginPhp = `<?php
/**
 * Plugin Name: Hontrio Risk Shield${storeName ? ' — ' + storeName : ''}
 * Plugin URI: https://hontrio.com
 * Description: Sincronizare automată comenzi WooCommerce cu Hontrio Risk Shield. Detectare clienți problematici în timp real.
 * Version: 1.0.0
 * Author: Hontrio
 * Author URI: https://hontrio.com
 * License: GPL2
 * Text Domain: hontrio-risk
 * Requires at least: 5.0
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'HONTRIO_RISK_VERSION',    '1.0.0' );
define( 'HONTRIO_RISK_API_BASE',   '${apiBase}' );
define( 'HONTRIO_RISK_WEBHOOK_URL','${webhookUrl}' );
define( 'HONTRIO_RISK_SECRET',     '${webhookSecret}' );
define( 'HONTRIO_RISK_STORE_ID',   '${store.id}' );

// ── ACTIVARE: înregistrează webhook-urile WooCommerce ────────────────────────
register_activation_hook( __FILE__, 'hontrio_risk_activate' );
function hontrio_risk_activate() {
    hontrio_risk_register_webhooks();
    set_transient( 'hontrio_risk_activated', true, 60 );
}

// ── DEZACTIVARE: șterge webhook-urile ───────────────────────────────────────
register_deactivation_hook( __FILE__, 'hontrio_risk_deactivate' );
function hontrio_risk_deactivate() {
    hontrio_risk_delete_webhooks();
}

// ── Înregistrare webhooks ────────────────────────────────────────────────────
function hontrio_risk_register_webhooks() {
    if ( ! class_exists( 'WC_Webhook' ) ) return;

    $topics = array(
        'order.created' => 'Hontrio Risk — Comandă nouă',
        'order.updated' => 'Hontrio Risk — Actualizare comandă',
    );

    $existing = get_option( 'hontrio_risk_webhook_ids', array() );

    foreach ( $topics as $topic => $name ) {
        // Evită duplicatele
        if ( ! empty( $existing[ $topic ] ) ) {
            $existing_wh = wc_get_webhook( $existing[ $topic ] );
            if ( $existing_wh && $existing_wh->get_status() === 'active' ) continue;
        }

        $webhook = new WC_Webhook();
        $webhook->set_name( $name );
        $webhook->set_topic( $topic );
        $webhook->set_delivery_url( HONTRIO_RISK_WEBHOOK_URL );
        $webhook->set_secret( HONTRIO_RISK_SECRET );
        $webhook->set_status( 'active' );
        $webhook->set_api_version( 'wp_api_v3' );
        $id = $webhook->save();

        $existing[ $topic ] = $id;
    }

    update_option( 'hontrio_risk_webhook_ids', $existing );
}

// ── Ștergere webhooks ────────────────────────────────────────────────────────
function hontrio_risk_delete_webhooks() {
    $ids = get_option( 'hontrio_risk_webhook_ids', array() );
    foreach ( $ids as $id ) {
        $webhook = wc_get_webhook( $id );
        if ( $webhook ) $webhook->delete( true );
    }
    delete_option( 'hontrio_risk_webhook_ids' );
}

// ── Notice activare ──────────────────────────────────────────────────────────
add_action( 'admin_notices', 'hontrio_risk_activation_notice' );
function hontrio_risk_activation_notice() {
    if ( ! get_transient( 'hontrio_risk_activated' ) ) return;
    ?>
    <div class="notice notice-success is-dismissible">
        <p>
            <strong>Hontrio Risk Shield</strong> activat cu succes! 
            Comenzile noi vor fi analizate automat.
            <a href="<?php echo esc_url( HONTRIO_RISK_API_BASE . '/risk' ); ?>" target="_blank">
                Vezi dashboard →
            </a>
        </p>
    </div>
    <?php
    delete_transient( 'hontrio_risk_activated' );
}

// ── Pagină de setări în admin ────────────────────────────────────────────────
add_action( 'admin_menu', 'hontrio_risk_admin_menu' );
function hontrio_risk_admin_menu() {
    add_submenu_page(
        'woocommerce',
        'Hontrio Risk Shield',
        'Risk Shield',
        'manage_woocommerce',
        'hontrio-risk',
        'hontrio_risk_settings_page'
    );
}

function hontrio_risk_settings_page() {
    $webhook_ids = get_option( 'hontrio_risk_webhook_ids', array() );
    $status = ! empty( $webhook_ids ) ? 'Activ ✓' : 'Inactiv';
    $color  = ! empty( $webhook_ids ) ? '#12b76a' : '#f04438';
    ?>
    <div class="wrap">
        <h1>Hontrio Risk Shield</h1>
        <table class="form-table">
            <tr>
                <th>Status Sincronizare</th>
                <td><span style="color:<?php echo $color; ?>; font-weight:600"><?php echo $status; ?></span></td>
            </tr>
            <tr>
                <th>Webhook URL</th>
                <td><code><?php echo esc_html( HONTRIO_RISK_WEBHOOK_URL ); ?></code></td>
            </tr>
            <tr>
                <th>Store ID</th>
                <td><code><?php echo esc_html( HONTRIO_RISK_STORE_ID ); ?></code></td>
            </tr>
            <tr>
                <th>Webhook-uri active</th>
                <td>
                    <?php if ( ! empty( $webhook_ids ) ) : ?>
                        <?php foreach ( $webhook_ids as $topic => $id ) : ?>
                            <div><?php echo esc_html( $topic ); ?> → ID: <?php echo intval( $id ); ?></div>
                        <?php endforeach; ?>
                    <?php else : ?>
                        <span style="color:#f04438">Niciun webhook înregistrat</span>
                    <?php endif; ?>
                </td>
            </tr>
        </table>
        <p>
            <a href="<?php echo esc_url( HONTRIO_RISK_API_BASE . '/risk' ); ?>" 
               class="button button-primary" target="_blank">
                Deschide Dashboard Risk Shield
            </a>
            <button type="button" class="button" onclick="hontrioRiskReRegister()">
                Re-înregistrează Webhook-uri
            </button>
        </p>
        <script>
        function hontrioRiskReRegister() {
            if (!confirm('Ești sigur? Webhook-urile existente vor fi șterse și recreate.')) return;
            jQuery.post(ajaxurl, {
                action: 'hontrio_risk_reregister',
                nonce: '<?php echo wp_create_nonce("hontrio_risk_reregister"); ?>'
            }, function(r) {
                if (r.success) { alert('Webhook-uri re-înregistrate cu succes!'); location.reload(); }
                else alert('Eroare: ' + (r.data || 'necunoscută'));
            });
        }
        </script>
    </div>
    <?php
}

// ── AJAX: re-înregistrare ────────────────────────────────────────────────────
add_action( 'wp_ajax_hontrio_risk_reregister', 'hontrio_risk_ajax_reregister' );
function hontrio_risk_ajax_reregister() {
    check_ajax_referer( 'hontrio_risk_reregister', 'nonce' );
    if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( 'Permisiuni insuficiente' );
    hontrio_risk_delete_webhooks();
    hontrio_risk_register_webhooks();
    wp_send_json_success();
}
`

    // Creează ZIP
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