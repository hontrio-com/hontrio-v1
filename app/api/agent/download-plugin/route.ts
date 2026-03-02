import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { createAdminClient } from '@/lib/supabase/admin'
import { createWriteStream, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import archiver from 'archiver'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

    const userId = (session.user as any).id
    const supabase = createAdminClient()

    // Load config
    const { data: config } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    const { data: store } = await supabase
      .from('stores')
      .select('store_name, store_url')
      .eq('user_id', userId)
      .single()

    const agentName = config?.agent_name || 'Asistent'
    const color = config?.widget_color || '#2563eb'
    const position = config?.widget_position || 'bottom-right'
    const size = config?.widget_size || 'medium'
    const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://hontrio.com'
    const storeName = store?.store_name || ''

    // Generate plugin PHP content
    const pluginSlug = 'hontrio-agent'
    const pluginPhp = `<?php
/**
 * Plugin Name: Hontrio AI Agent${storeName ? ' — ' + storeName : ''}
 * Plugin URI: https://hontrio.com
 * Description: Asistent AI conversational pentru magazinul tau online. Powered by Hontrio.
 * Version: 1.0.3
 * Author: Hontrio
 * Author URI: https://hontrio.com
 * License: GPL2
 * Text Domain: hontrio-agent
 * Update URI: ${apiBase}/api/agent/plugin-update
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'HONTRIO_USER_ID', '${userId}' );
define( 'HONTRIO_COLOR', '${color}' );
define( 'HONTRIO_POSITION', '${position}' );
define( 'HONTRIO_SIZE', '${size}' );
define( 'HONTRIO_API_BASE', '${apiBase}' );
define( 'HONTRIO_BOTTOM_OFFSET', ${config?.widget_bottom_offset || 20} );
define( 'HONTRIO_PLUGIN_VERSION', '1.0.3' );

function hontrio_agent_inject() {
    ?>
    <script>
    window.HontrioAgent = {
        userId: "<?php echo esc_js( HONTRIO_USER_ID ); ?>",
        color: "<?php echo esc_js( HONTRIO_COLOR ); ?>",
        position: "<?php echo esc_js( HONTRIO_POSITION ); ?>",
        size: "<?php echo esc_js( HONTRIO_SIZE ); ?>",
        apiBase: "<?php echo esc_js( HONTRIO_API_BASE ); ?>",
        bottomOffset: <?php echo intval( HONTRIO_BOTTOM_OFFSET ); ?>
    };
    </script>
    <script src="<?php echo esc_url( HONTRIO_API_BASE ); ?>/agent-widget.js?v=<?php echo HONTRIO_PLUGIN_VERSION; ?>" defer></script>
    <?php
}
add_action( 'wp_footer', 'hontrio_agent_inject' );

// ── AUTO-UPDATE din Hontrio (punct 7) ─────────────────────────────────────
function hontrio_check_update( \$transient ) {
    if ( empty( \$transient->checked ) ) return \$transient;

    \$response = wp_remote_get( HONTRIO_API_BASE . '/api/agent/plugin-update?v=' . HONTRIO_PLUGIN_VERSION, array(
        'timeout' => 10,
        'headers' => array( 'Accept' => 'application/json' ),
    ) );

    if ( is_wp_error( \$response ) ) return \$transient;

    \$data = json_decode( wp_remote_retrieve_body( \$response ), true );

    if ( ! empty( \$data['new_version'] ) && version_compare( \$data['new_version'], HONTRIO_PLUGIN_VERSION, '>' ) ) {
        \$plugin_slug = 'hontrio-agent/hontrio-agent.php';
        \$transient->response[ \$plugin_slug ] = (object) array(
            'slug'        => 'hontrio-agent',
            'plugin'      => \$plugin_slug,
            'new_version' => \$data['new_version'],
            'url'         => 'https://hontrio.com',
            'package'     => \$data['download_url'],
        );
    }

    return \$transient;
}
add_filter( 'pre_set_site_transient_update_plugins', 'hontrio_check_update' );

function hontrio_plugin_info( \$result, \$action, \$args ) {
    if ( \$action !== 'plugin_information' || \$args->slug !== 'hontrio-agent' ) return \$result;

    \$response = wp_remote_get( HONTRIO_API_BASE . '/api/agent/plugin-update?v=' . HONTRIO_PLUGIN_VERSION );
    if ( is_wp_error( \$response ) ) return \$result;

    \$data = json_decode( wp_remote_retrieve_body( \$response ), true );
    if ( empty( \$data ) ) return \$result;

    return (object) array(
        'name'          => 'Hontrio AI Agent',
        'slug'          => 'hontrio-agent',
        'version'       => \$data['new_version'] ?? HONTRIO_PLUGIN_VERSION,
        'download_link' => \$data['download_url'] ?? '',
        'sections'      => array( 'description' => 'Asistent AI pentru magazinul tău WooCommerce.' ),
    );
}
add_filter( 'plugins_api', 'hontrio_plugin_info', 20, 3 );

// Admin notice after activation
function hontrio_activation_notice() {
    if ( get_transient( 'hontrio_activated' ) ) {
        ?>
        <div class="notice notice-success is-dismissible">
            <p><strong>Hontrio AI Agent</strong> a fost activat! Agentul <strong><?php echo esc_html( '${agentName}' ); ?></strong> este activ. <a href="${apiBase}/agent" target="_blank">Configurează →</a></p>
        </div>
        <?php
        delete_transient( 'hontrio_activated' );
    }
}
add_action( 'admin_notices', 'hontrio_activation_notice' );

function hontrio_on_activate() { set_transient( 'hontrio_activated', true, 30 ); }
register_activation_hook( __FILE__, 'hontrio_on_activate' );
`

    // Create ZIP in memory using archiver
    const tmpDir = join(tmpdir(), `hontrio-plugin-${userId.substring(0, 8)}`)
    mkdirSync(tmpDir, { recursive: true })
    mkdirSync(join(tmpDir, pluginSlug), { recursive: true })
    writeFileSync(join(tmpDir, pluginSlug, `${pluginSlug}.php`), pluginPhp)

    // Create ZIP
    const zipPath = join(tmpDir, `${pluginSlug}.zip`)

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 6 } })

      output.on('close', resolve)
      archive.on('error', reject)

      archive.pipe(output)
      archive.file(join(tmpDir, pluginSlug, `${pluginSlug}.php`), {
        name: `${pluginSlug}/${pluginSlug}.php`
      })
      archive.finalize()
    })

    const zipBuffer = readFileSync(zipPath)

    // Cleanup
    try { rmSync(tmpDir, { recursive: true }) } catch {}

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${pluginSlug}.zip"`,
        'Content-Length': String(zipBuffer.length),
      }
    })
  } catch (err: any) {
    console.error('[Download Plugin]', err)
    return NextResponse.json({ error: 'Eroare la generarea pluginului: ' + err.message }, { status: 500 })
  }
}