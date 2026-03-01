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
 * Version: 1.0.0
 * Author: Hontrio
 * Author URI: https://hontrio.com
 * License: GPL2
 * Text Domain: hontrio-agent
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'HONTRIO_USER_ID', '${userId}' );
define( 'HONTRIO_COLOR', '${color}' );
define( 'HONTRIO_POSITION', '${position}' );
define( 'HONTRIO_SIZE', '${size}' );
define( 'HONTRIO_API_BASE', '${apiBase}' );

function hontrio_agent_inject() {
    ?>
    <script>
    window.HontrioAgent = {
        userId: "<?php echo esc_js( HONTRIO_USER_ID ); ?>",
        color: "<?php echo esc_js( HONTRIO_COLOR ); ?>",
        position: "<?php echo esc_js( HONTRIO_POSITION ); ?>",
        size: "<?php echo esc_js( HONTRIO_SIZE ); ?>",
        apiBase: "<?php echo esc_js( HONTRIO_API_BASE ); ?>"
    };
    </script>
    <script src="<?php echo esc_url( HONTRIO_API_BASE ); ?>/agent-widget.js?v=<?php echo time(); ?>" defer></script>
    <?php
}
add_action( 'wp_footer', 'hontrio_agent_inject' );

// Admin notice after activation
function hontrio_activation_notice() {
    if ( get_transient( 'hontrio_activated' ) ) {
        ?>
        <div class="notice notice-success is-dismissible">
            <p><strong>Hontrio AI Agent</strong> a fost activat cu succes! Agentul <strong><?php echo esc_html( '${agentName}' ); ?></strong> este acum activ pe site-ul tău. <a href="https://hontrio.com/agent" target="_blank">Gestionează agentul →</a></p>
        </div>
        <?php
        delete_transient( 'hontrio_activated' );
    }
}
add_action( 'admin_notices', 'hontrio_activation_notice' );

function hontrio_on_activate() {
    set_transient( 'hontrio_activated', true, 30 );
}
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