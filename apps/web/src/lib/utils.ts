import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '—'
  return format(new Date(date), fmt, { locale: ptBR })
}

export function formatRelative(date: Date | string | null): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function isClosingSoon(deadline: Date | string | null, days = 7): boolean {
  if (!deadline) return false
  const d = new Date(deadline)
  return isAfter(d, new Date()) && isBefore(d, addDays(new Date(), days))
}

export function isOpen(openAt?: Date | null, closeAt?: Date | null): boolean {
  const now = new Date()
  if (openAt && isBefore(now, new Date(openAt))) return false
  if (closeAt && isAfter(now, new Date(closeAt))) return false
  return true
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    unknown:          'Aguardando',
    announced:        'Anunciado',
    open:             'Inscrições abertas',
    closing_soon:     'Encerra em breve',
    closed:           'Inscrições encerradas',
    draws_published:  'Chave publicada',
    in_progress:      'Em andamento',
    finished:         'Finalizado',
    canceled:         'Cancelado',
  }
  return labels[status] ?? status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open:             'bg-brand-500 text-white',
    closing_soon:     'bg-amber-500 text-white',
    closed:           'bg-gray-400 text-white',
    draws_published:  'bg-blue-500 text-white',
    in_progress:      'bg-blue-600 text-white',
    finished:         'bg-gray-300 text-gray-700',
    canceled:         'bg-red-500 text-white',
    announced:        'bg-purple-500 text-white',
    unknown:          'bg-gray-200 text-gray-600',
  }
  return colors[status] ?? 'bg-gray-200 text-gray-600'
}

export function getEligibilityColor(status: string): string {
  const colors: Record<string, string> = {
    compatible:   'text-brand-600 bg-brand-50 border-brand-200',
    incompatible: 'text-red-600 bg-red-50 border-red-200',
    unknown:      'text-gray-500 bg-gray-50 border-gray-200',
  }
  return colors[status] ?? colors.unknown
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Motor de elegibilidade - funções auxiliares locais
export function getSportAge(birthYear: number, refYear?: number): number {
  return (refYear ?? new Date().getFullYear()) - birthYear
}

export function calcCompatibleCount(
  categories: Array<{ genderScope?: string | null; classCode?: string | null; minAge?: number | null; maxAge?: number | null; ageType?: string | null }>,
  player: { birthYear: number; gender?: string | null; classCode?: string | null }
): number {
  const age = getSportAge(player.birthYear)
  return categories.filter(cat => {
    if (player.gender && cat.genderScope && cat.genderScope !== 'Mixed' && cat.genderScope !== player.gender) return false
    if (cat.classCode && player.classCode) {
      const pNum = parseInt(player.classCode), cNum = parseInt(cat.classCode)
      if (!isNaN(pNum) && !isNaN(cNum) && (pNum > cNum + 1 || pNum < cNum)) return false
    }
    if (cat.minAge && cat.ageType === 'exact'    && age < cat.minAge) return false
    if (cat.maxAge && cat.ageType === 'exact'    && age > cat.maxAge) return false
    if (cat.minAge && cat.ageType === 'minimum'  && age < cat.minAge) return false
    return true
  }).length
}
