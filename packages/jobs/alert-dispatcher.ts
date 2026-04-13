/**
 * Job: Alert Dispatcher
 * Roda via cron (ex: a cada hora).
 * Verifica watchlist items com prazo chegando e dispara e-mails.
 *
 * Executar: npx tsx packages/jobs/alert-dispatcher.ts
 */

import { prisma } from './prisma'
import { addDays, isBefore, isAfter, differenceInDays } from 'date-fns'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL     = 'alertas@tennishub.com.br'

type AlertType = 'D-7' | 'D-2' | 'D-0'

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

function buildDeadlineEmailHtml(data: {
  playerName: string
  tournamentName: string
  venueCity: string
  entryCloseAt: Date
  officialUrl: string
  daysLeft: number
}) {
  const urgency = data.daysLeft === 0 ? '⚠️ HOJE' : `em ${data.daysLeft} dia${data.daysLeft > 1 ? 's' : ''}`
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#25976A;margin-bottom:4px">🎾 Tennis Hub</h2>
      <p style="color:#6b7280;font-size:14px;margin-top:0">Alerta de prazo de inscrição</p>

      <div style="background:#f0faf4;border:1px solid #b2e6c9;border-radius:12px;padding:20px;margin:20px 0">
        <p style="margin:0;font-size:16px;font-weight:600;color:#111827">
          ${data.tournamentName}
        </p>
        <p style="margin:6px 0 0;color:#6b7280;font-size:14px">
          📍 ${data.venueCity}
        </p>
      </div>

      <p style="font-size:15px;color:#111827">
        Olá, ${data.playerName}! O prazo de inscrição encerra <strong>${urgency}</strong>.
      </p>

      <a href="${data.officialUrl}" style="display:inline-block;background:#25976A;color:white;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;margin:8px 0">
        Abrir inscrição oficial →
      </a>

      <p style="font-size:12px;color:#9ca3af;margin-top:24px">
        Você recebe este e-mail porque salvou este torneio na sua watchlist no Tennis Hub.
        <a href="#" style="color:#25976A">Gerenciar preferências</a>
      </p>
    </div>
  `
}

async function dispatchDeadlineAlerts() {
  const now  = new Date()
  const windows: { days: number; type: AlertType; notifType: string }[] = [
    { days: 7, type: 'D-7', notifType: 'deadline_reminder' },
    { days: 2, type: 'D-2', notifType: 'deadline_reminder' },
    { days: 0, type: 'D-0', notifType: 'deadline_reminder' },
  ]

  let totalSent = 0

  for (const window of windows) {
    const targetStart = addDays(now, window.days)
    const targetEnd   = addDays(now, window.days + 1)

    // Watchlist items com prazo dentro da janela e alertas habilitados
    const items = await prisma.watchlistItem.findMany({
      where: {
        tournamentEdition: {
          entryCloseAt: { gte: targetStart, lt: targetEnd },
          status:       { in: ['open', 'closing_soon'] },
        },
        userStatus: { not: 'desisti' },
      },
      include: {
        tournamentEdition: {
          include: {
            tournament:  { include: { organization: true } },
            links:       { where: { linkType: 'registration', isOfficial: true }, take: 1 },
          },
        },
        playerProfile: {
          include: { user: { select: { email: true } } },
        },
      },
    })

    for (const item of items) {
      const prefs = (item.alertPrefsJson ?? {}) as any
      if (window.type === 'D-7' && !prefs.emailD7) continue
      if (window.type === 'D-2' && !prefs.emailD2) continue
      if (window.type === 'D-0' && !prefs.emailD0) continue

      // Checar se já enviamos este alerta para este item
      const alreadySent = await prisma.notification.findFirst({
        where: {
          watchlistItemId: item.id,
          type:            window.notifType,
          subject:         { contains: window.type },
          sentAt:          { not: null },
        },
      })
      if (alreadySent) continue

      const t          = item.tournamentEdition
      const email      = item.playerProfile.user.email
      const name       = item.playerProfile.displayName
      const daysLeft   = differenceInDays(t.entryCloseAt!, now)
      const regUrl     = t.links[0]?.url ?? t.officialSourceUrl ?? '#'
      const subject    = `[${window.type}] Inscrições fecham em breve — ${t.tournament.canonicalName}`

      const html = buildDeadlineEmailHtml({
        playerName:   name,
        tournamentName: t.tournament.canonicalName,
        venueCity:    t.venueCity ?? '',
        entryCloseAt: t.entryCloseAt!,
        officialUrl:  regUrl,
        daysLeft:     Math.max(0, daysLeft),
      })

      try {
        await sendEmail(email, subject, html)

        // Registra notificação enviada
        await prisma.notification.create({
          data: {
            watchlistItemId: item.id,
            channel:         'email',
            type:            window.notifType,
            subject,
            bodyJson:        { daysLeft, tournamentId: t.id, window: window.type },
            sentAt:          new Date(),
          },
        })

        totalSent++
        console.log(`  ✓ [${window.type}] ${email} — ${t.tournament.canonicalName}`)
      } catch (err) {
        console.error(`  ✗ Falha ao enviar para ${email}:`, err)
      }
    }
  }

  return totalSent
}

async function dispatchChangeAlerts() {
  // Eventos de mudança das últimas 2 horas não notificados
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000)

  const changeEvents = await prisma.tournamentChangeEvent.findMany({
    where: { detectedAt: { gte: since } },
    include: {
      tournamentEdition: {
        include: {
          tournament: true,
          links:      { where: { linkType: 'registration', isOfficial: true }, take: 1 },
          watchlistItems: {
            where:   { userStatus: { not: 'desisti' } },
            include: { playerProfile: { include: { user: { select: { email: true } } } } },
          },
        },
      },
    },
  })

  let totalSent = 0

  for (const event of changeEvents) {
    const t       = event.tournamentEdition
    const changes = event.fieldChangesJson as any

    for (const item of t.watchlistItems) {
      const prefs = (item.alertPrefsJson ?? {}) as any
      if (!prefs.onStatusChange) continue

      const alreadySent = await prisma.notification.findFirst({
        where: { watchlistItemId: item.id, type: 'status_change', bodyJson: { path: ['eventId'], equals: event.id } },
      })
      if (alreadySent) continue

      const email   = item.playerProfile.user.email
      const name    = item.playerProfile.displayName
      const subject = `[Atualização] ${t.tournament.canonicalName} — mudança detectada`
      const html    = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#25976A">🎾 Tennis Hub — Atualização</h2>
          <p>Olá, ${name}! Detectamos uma mudança no torneio <strong>${t.tournament.canonicalName}</strong>.</p>
          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:14px;color:#92400e">
              <strong>Campo alterado:</strong> ${changes.field}<br>
              <strong>De:</strong> ${changes.from ?? '—'}<br>
              <strong>Para:</strong> ${changes.to ?? '—'}
            </p>
          </div>
          <a href="${t.links[0]?.url ?? '#'}" style="display:inline-block;background:#25976A;color:white;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">
            Ver torneio oficial →
          </a>
        </div>
      `

      try {
        await sendEmail(email, subject, html)
        await prisma.notification.create({
          data: {
            watchlistItemId: item.id,
            channel: 'email', type: 'status_change', subject,
            bodyJson: { eventId: event.id, changes },
            sentAt: new Date(),
          },
        })
        totalSent++
      } catch (err) {
        console.error(`Falha ao notificar mudança para ${email}:`, err)
      }
    }
  }

  return totalSent
}

async function main() {
  console.log('=== Alert Dispatcher iniciando ===')
  const t0 = Date.now()

  const deadlineSent = await dispatchDeadlineAlerts()
  console.log(`Alertas de prazo enviados: ${deadlineSent}`)

  const changeSent = await dispatchChangeAlerts()
  console.log(`Alertas de mudança enviados: ${changeSent}`)

  console.log(`=== Concluído em ${Date.now() - t0}ms ===`)
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
