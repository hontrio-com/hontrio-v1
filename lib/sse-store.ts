// Store global pentru clienți SSE conectați
// Folosit de config-stream (înregistrare) și config (notificare)

// NOTE: This in-memory Map is per-process. On multi-instance deployments (e.g. Vercel),
// SSE clients connected to different instances won't receive broadcasts from other instances.
// For production multi-instance support, replace with Redis pub/sub or a similar shared bus.

// Module-level singleton — persistă între apeluri în același proces
const clientsMap = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>()

export const sseClients = clientsMap

export function notifyConfigChange(userId: string, config: unknown) {
  const userClients = sseClients.get(userId)
  if (!userClients || userClients.size === 0) return
  const data = `data: ${JSON.stringify(config)}\n\n`
  const encoder = new TextEncoder()
  for (const ctrl of Array.from(userClients)) {
    try {
      ctrl.enqueue(encoder.encode(data))
    } catch {
      userClients.delete(ctrl)
    }
  }
}