// Minimal in-memory pub/sub for Server-Sent Events — no new dependency,
// just long-lived Express responses kept open and written to on demand.
// Scoped the same way as reports.controller.js's _scopedCaseWhere: admin/
// top_management see everything, peneraju_sektor only their own sector.

const clients = new Set()

const addClient = (res, meta) => {
  const client = { res, ...meta }
  clients.add(client)
  return client
}

const removeClient = (client) => {
  clients.delete(client)
}

const canSee = (client, scope = {}) => {
  if (client.role === 'admin' || client.role === 'top_management') return true
  if (client.role === 'peneraju_sektor') return !scope.sector || client.sector === scope.sector
  return false
}

const broadcast = (event, payload, scope = {}) => {
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const client of clients) {
    if (!canSee(client, scope)) continue
    try {
      client.res.write(line)
    } catch {
      removeClient(client)
    }
  }
}

module.exports = { addClient, removeClient, broadcast }
