import { getAuditLogs } from './src/lib/actions/audit-log'

async function main() {
  const res = await getAuditLogs({
    search: '',
    category: 'all',
    action: 'all',
    role: 'all',
    page: 1,
  })
  
  console.log('Total Logs:', res.total)
  console.log('Logs array length:', res.data.length)
  const usersFound = new Set(res.data.map(l => l.user?.username))
  console.log('Users found in logs:', Array.from(usersFound))
}

main().catch(console.error)
