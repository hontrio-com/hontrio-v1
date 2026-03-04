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
      .select('id, store_url, webhook_secret')
      .eq('user_id', userId)
      .single()

    if (!store) return NextResponse.json({ error: 'Niciun magazin conectat' }, { status: 404 })

    // Generează sau recuperează webhook_secret din tabelul stores
    let webhookSecret = store.webhook_secret
    if (!webhookSecret) {
      webhookSecret = crypto.randomBytes(32).toString('hex')
      await supabase
        .from('stores')
        .update({ webhook_secret: webhookSecret })
        .eq('id', store.id)
    }

    const storeName = store.store_url || 'Magazinul tău'
    const pluginSlug = 'hontrio-risk-shield'
    const webhookUrl = `${apiBase}/api/risk/webhook`

    const pluginPhp = `<?php
/**
 * Plugin Name: Hontrio Risk Shield${storeName ? ' — ' + storeName : ''}
 * Plugin URI: https://hontrio.com
 * Description: Sincronizare automată comenzi WooCommerce cu Hontrio Risk Shield.
 * Version: 1.0.2
 * Author: Hontrio
 * Author URI: https://hontrio.com
 * License: GPL2
 * Text Domain: hontrio-risk
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'HONTRIO_RISK_VERSION',    '1.0.2' );
define( 'HONTRIO_RISK_API_BASE',   '${apiBase}' );
define( 'HONTRIO_RISK_WEBHOOK_URL','${webhookUrl}' );
define( 'HONTRIO_RISK_SECRET',     '${webhookSecret}' );
define( 'HONTRIO_RISK_STORE_ID',   '${store.id}' );

// ── La activare: setează un flag, webhook-urile se înregistrează la primul init
// (register_activation_hook rulează înainte ca WooCommerce să fie încărcat complet)
register_activation_hook( __FILE__, 'hontrio_risk_activate' );
function hontrio_risk_activate() {
    update_option( 'hontrio_risk_needs_setup', true );
    set_transient( 'hontrio_risk_activated', true, 60 );
}

register_deactivation_hook( __FILE__, 'hontrio_risk_deactivate' );
function hontrio_risk_deactivate() {
    hontrio_risk_delete_webhooks();
}

// ── La fiecare init: dacă e nevoie de setup, înregistrează webhooks ──────────
add_action( 'woocommerce_loaded', 'hontrio_risk_maybe_setup' );
function hontrio_risk_maybe_setup() {
    if ( ! get_option( 'hontrio_risk_needs_setup' ) ) return;
    hontrio_risk_register_webhooks();
    delete_option( 'hontrio_risk_needs_setup' );
}

// ── Înregistrare webhooks via WooCommerce REST API ───────────────────────────
function hontrio_risk_register_webhooks() {
    if ( ! function_exists( 'wc_get_webhook' ) ) return;

    $topics = array(
        'order.created' => 'Hontrio Risk — Comandă nouă',
        'order.updated' => 'Hontrio Risk — Actualizare comandă',
    );

    $existing = get_option( 'hontrio_risk_webhook_ids', array() );

    foreach ( $topics as $topic => $name ) {
        // Verifică dacă există deja și e activ
        if ( ! empty( $existing[ $topic ] ) ) {
            $wh = wc_get_webhook( intval( $existing[ $topic ] ) );
            if ( $wh && $wh->get_id() && $wh->get_status() === 'active' ) {
                continue;
            }
        }

        // Creează webhook nou
        $webhook = new WC_Webhook();
        $webhook->set_name( $name );
        $webhook->set_topic( $topic );
        $webhook->set_delivery_url( HONTRIO_RISK_WEBHOOK_URL );
        $webhook->set_secret( HONTRIO_RISK_SECRET );
        $webhook->set_status( 'active' );
        $webhook->set_api_version( 'wp_api_v3' );
        $webhook->set_user_id( get_current_user_id() ?: 1 );
        $id = $webhook->save();

        if ( $id ) {
            $existing[ $topic ] = $id;
        }
    }

    update_option( 'hontrio_risk_webhook_ids', $existing );
}

// ── Ștergere webhooks ────────────────────────────────────────────────────────
function hontrio_risk_delete_webhooks() {
    $ids = get_option( 'hontrio_risk_webhook_ids', array() );
    foreach ( $ids as $id ) {
        $webhook = wc_get_webhook( intval( $id ) );
        if ( $webhook ) $webhook->delete( true );
    }
    delete_option( 'hontrio_risk_webhook_ids' );
}

// ── Notice activare ──────────────────────────────────────────────────────────
add_action( 'admin_notices', 'hontrio_risk_notices' );
function hontrio_risk_notices() {
    $webhook_ids = get_option( 'hontrio_risk_webhook_ids', array() );

    if ( get_transient( 'hontrio_risk_activated' ) ) {
        delete_transient( 'hontrio_risk_activated' );
        ?>
        <div class="notice notice-info is-dismissible">
            <p><strong>Hontrio Risk Shield</strong> activat. Webhook-urile se înregistrează automat... 
            <a href="<?php echo esc_url( admin_url('admin.php?page=hontrio-risk') ); ?>">Verifică status →</a></p>
        </div>
        <?php
    }

    if ( ! empty( $webhook_ids ) && count( $webhook_ids ) >= 2 ) {
        // Webhook-uri active — nu afișa nimic
        return;
    }
}

// ── Pagină de setări ─────────────────────────────────────────────────────────
add_action( 'admin_menu', 'hontrio_risk_admin_menu' );
function hontrio_risk_admin_menu() {
    add_submenu_page( 'woocommerce', 'Hontrio Risk Shield', 'Risk Shield',
        'manage_woocommerce', 'hontrio-risk', 'hontrio_risk_settings_page' );
}

function hontrio_risk_settings_page() {
    // Procesează acțiunea de re-înregistrare manuală
    if ( isset( \\$_POST['hontrio_action'] ) && \\$_POST['hontrio_action'] === 'reregister'
        && check_admin_referer('hontrio_reregister') ) {
        hontrio_risk_delete_webhooks();
        hontrio_risk_register_webhooks();
        echo '<div class="notice notice-success"><p>Webhook-uri re-înregistrate!</p></div>';
    }

    \\$webhook_ids = get_option( 'hontrio_risk_webhook_ids', array() );
    \\$has_webhooks = count( \\$webhook_ids ) >= 2;
    ?>
    <div class="wrap">
        <h1>🛡️ Hontrio Risk Shield</h1>
        <table class="form-table widefat" style="max-width:600px">
            <tr>
                <th>Status</th>
                <td>
                    <?php if ( \\$has_webhooks ) : ?>
                        <span style="color:#12b76a;font-weight:700">● Activ — comenzile se sincronizează</span>
                    <?php else : ?>
                        <span style="color:#f04438;font-weight:700">● Inactiv — niciun webhook înregistrat</span>
                    <?php endif; ?>
                </td>
            </tr>
            <tr>
                <th>Webhook URL</th>
                <td><code style="font-size:11px"><?php echo esc_html( HONTRIO_RISK_WEBHOOK_URL ); ?></code></td>
            </tr>
            <tr>
                <th>Webhooks înregistrate</th>
                <td>
                    <?php if ( ! empty( \\$webhook_ids ) ) : ?>
                        <?php foreach ( \\$webhook_ids as \\$topic => \\$id ) :
                            \\$wh = wc_get_webhook( intval(\\$id) );
                            \\$active = \\$wh && \\$wh->get_status() === 'active';
                        ?>
                        <div>
                            <span style="color:<?php echo \\$active ? '#12b76a' : '#f04438'; ?>">●</span>
                            <?php echo esc_html(\\$topic); ?> (ID: <?php echo intval(\\$id); ?>)
                        </div>
                        <?php endforeach; ?>
                    <?php else : ?>
                        <em style="color:#f04438">Niciun webhook — apasă butonul de mai jos</em>
                    <?php endif; ?>
                </td>
            </tr>
        </table>

        <p style="margin-top:20px">
            <a href="<?php echo esc_url( HONTRIO_RISK_API_BASE . '/risk' ); ?>"
               class="button button-primary" target="_blank">
                Deschide Dashboard →
            </a>
            &nbsp;
            <form method="post" style="display:inline">
                <?php wp_nonce_field('hontrio_reregister'); ?>
                <input type="hidden" name="hontrio_action" value="reregister">
                <button type="submit" class="button">
                    <?php echo \\$has_webhooks ? 'Re-înregistrează Webhook-uri' : '⚡ Înregistrează Webhook-uri acum'; ?>
                </button>
            </form>
        </p>
    </div>
    <?php
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