// ─── Motor de Elegibilidade ───────────────────────────────────────────────────
// Avalia compatibilidade do jogador com categorias de torneio.
// Regras: FPT classes (1ª-5ª), idades (seniors/juniors), CBT infantojuvenil.

export type EligibilityStatus = 'compatible' | 'incompatible' | 'unknown'

export interface EligibilityResult {
  status: EligibilityStatus
  reasons: string[]
  ruleSource?: string
  ruleVersion?: string
}

export interface PlayerContext {
  birthYear: number
  gender?: string        // "M" | "F"
  classCode?: string     // "1" | "2" | "3" | "4" | "5" | "PR" | "PRO"
  hasFederationId?: boolean
  hasCPF?: boolean
  stateCode?: string
}

export interface CategoryRule {
  // Identificação
  categoryCode?: string
  sourceCategoryText?: string

  // Restrições de idade
  minAge?: number
  maxAge?: number
  ageType?: 'exact' | 'minimum' // 'exact' = precisa ser exatamente essa faixa; 'minimum' = seniors (pode jogar abaixo)

  // Restrições de gênero
  genderScope?: string // "M" | "F" | "Mixed"

  // Restrições de classe técnica
  classCode?: string   // classe exigida pela categoria
  allowClassUp?: boolean // jogador pode subir 1 classe acima da sua

  // Restrições formais (CBT, etc.)
  requiresFederationId?: boolean
  requiresCPF?: boolean
  requiresSameState?: boolean

  // Metadata
  ruleSource?: string
  ruleVersion?: string
}

/**
 * Calcula a "idade esportiva" do jogador:
 * considera apenas o ano — sem mês ou dia.
 * Regra oficial CBT/FPT: idade = ano_vigente - ano_nascimento
 */
export function getSportAge(birthYear: number, referenceYear?: number): number {
  const year = referenceYear ?? new Date().getFullYear()
  return year - birthYear
}

/**
 * Converte código de classe para número comparável.
 * Menor número = classe mais alta/forte.
 * "1" = primeira classe (mais forte), "5" = quinta (iniciante)
 */
function classToNumber(code: string): number | null {
  const map: Record<string, number> = {
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
    'PR': 6, 'Principiante': 6, 'PRO': 0,
  }
  return map[code] ?? null
}

/**
 * Avalia a elegibilidade de um jogador para uma categoria específica.
 * Sempre retorna status + razões detalhadas.
 */
export function evaluateEligibility(
  player: PlayerContext,
  category: CategoryRule,
  currentYear?: number
): EligibilityResult {
  const year = currentYear ?? new Date().getFullYear()
  const reasons: string[] = []
  let hasAnyRule = false

  // ── Validação de gênero ──────────────────────────────────────────────────
  if (category.genderScope && category.genderScope !== 'Mixed') {
    hasAnyRule = true
    if (player.gender && player.gender !== category.genderScope) {
      const label = category.genderScope === 'M' ? 'masculino' : 'feminino'
      reasons.push(`Categoria restrita ao gênero ${label}`)
    }
  }

  // ── Validação de idade ───────────────────────────────────────────────────
  if (category.minAge !== undefined || category.maxAge !== undefined) {
    hasAnyRule = true
    const sportAge = getSportAge(player.birthYear, year)

    if (category.ageType === 'minimum') {
      // Seniors: jogador pode ter MAIS idade que o mínimo
      // Ex: 45+ pode jogar 40+ e 35+ (mas não 50+ se ele tiver 47)
      if (category.minAge !== undefined && sportAge < category.minAge) {
        reasons.push(
          `Idade esportiva (${sportAge} anos) abaixo do mínimo para esta categoria (${category.minAge}+)`
        )
      }
      // Sem maxAge em categorias seniors — jogadores mais velhos podem sempre descer
    } else {
      // Faixa exata (juvenil, kids, etc.)
      if (category.minAge !== undefined && sportAge < category.minAge) {
        reasons.push(
          `Idade esportiva (${sportAge} anos) abaixo do mínimo (${category.minAge} anos)`
        )
      }
      if (category.maxAge !== undefined && sportAge > category.maxAge) {
        reasons.push(
          `Idade esportiva (${sportAge} anos) acima do máximo (${category.maxAge} anos)`
        )
      }
    }
  }

  // ── Validação de classe técnica ──────────────────────────────────────────
  // Regra FPT: jogador pode jogar sua classe ou 1 classe ACIMA (mais forte)
  // Não pode descer para classe abaixo da sua.
  // Ex: 4ª classe pode jogar 4M1 ou 3M1 (1 acima), mas NÃO 5M1.
  if (category.classCode && player.classCode) {
    hasAnyRule = true
    const playerNum = classToNumber(player.classCode)
    const catNum = classToNumber(category.classCode)

    if (playerNum !== null && catNum !== null) {
      // Jogador mais fraco que a categoria exige (número maior = mais fraco)
      if (playerNum > catNum + 1) {
        reasons.push(
          `Nível técnico insuficiente: você está na ${player.classCode}ª classe, ` +
          `esta categoria exige ${category.classCode}ª classe ou superior`
        )
      }
      // Jogador mais forte tentando descer (número menor = mais forte)
      // Só bloqueia se allowClassUp não estiver ativo
      if (!category.allowClassUp && playerNum < catNum) {
        reasons.push(
          `Não é permitido jogar em categoria inferior à sua: ` +
          `você é ${player.classCode}ª classe e esta é ${category.classCode}ª`
        )
      }
    }
  }

  // ── Validações formais (CBT, etc.) ───────────────────────────────────────
  if (category.requiresFederationId) {
    hasAnyRule = true
    if (!player.hasFederationId) {
      reasons.push('Exige registro/cadastro na confederação (CBT)')
    }
  }

  if (category.requiresCPF) {
    hasAnyRule = true
    if (!player.hasCPF) {
      reasons.push('Exige CPF válido cadastrado')
    }
  }

  // ── Sem regra oficial definida ───────────────────────────────────────────
  if (!hasAnyRule) {
    return {
      status: 'unknown',
      reasons: ['Regra oficial não encontrada para esta categoria — consulte o regulamento'],
      ruleSource: category.ruleSource,
    }
  }

  // ── Resultado final ──────────────────────────────────────────────────────
  if (reasons.length > 0) {
    return {
      status: 'incompatible',
      reasons,
      ruleSource: category.ruleSource,
      ruleVersion: category.ruleVersion,
    }
  }

  return {
    status: 'compatible',
    reasons: [],
    ruleSource: category.ruleSource,
    ruleVersion: category.ruleVersion,
  }
}

/**
 * Avalia todas as categorias de um torneio para um jogador.
 * Retorna lista ordenada: compatíveis primeiro, depois incompatíveis, depois desconhecidos.
 */
export function evaluateTournamentEligibility(
  player: PlayerContext,
  categories: Array<CategoryRule & { id: string; sourceCategoryText: string }>,
  currentYear?: number
): Array<{ categoryId: string; categoryText: string } & EligibilityResult> {
  const results = categories.map((cat) => ({
    categoryId: cat.id,
    categoryText: cat.sourceCategoryText,
    ...evaluateEligibility(player, cat, currentYear),
  }))

  // Ordena: compatible → unknown → incompatible
  const order: Record<EligibilityStatus, number> = {
    compatible: 0,
    unknown: 1,
    incompatible: 2,
  }

  return results.sort((a, b) => order[a.status] - order[b.status])
}

// ─── Regras pré-definidas FPT 2026 ───────────────────────────────────────────
// Baseadas no regulamento oficial FPT 2026
export const FPT_CLASS_RULES: Record<string, Partial<CategoryRule>> = {
  '1M': { classCode: '1', genderScope: 'M', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '2M': { classCode: '2', genderScope: 'M', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '3M': { classCode: '3', genderScope: 'M', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '4M': { classCode: '4', genderScope: 'M', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '5M': { classCode: '5', genderScope: 'M', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '1F': { classCode: '1', genderScope: 'F', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '2F': { classCode: '2', genderScope: 'F', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '3F': { classCode: '3', genderScope: 'F', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '4F': { classCode: '4', genderScope: 'F', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
  '5F': { classCode: '5', genderScope: 'F', ruleSource: 'FPT Regulamento 2026', ageType: 'exact' },
}

export const FPT_SENIOR_RULES: Record<string, Partial<CategoryRule>> = {
  '35M': { minAge: 35, genderScope: 'M', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '40M': { minAge: 40, genderScope: 'M', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '45M': { minAge: 45, genderScope: 'M', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '50M': { minAge: 50, genderScope: 'M', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '55M': { minAge: 55, genderScope: 'M', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '60M': { minAge: 60, genderScope: 'M', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '35F': { minAge: 35, genderScope: 'F', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '40F': { minAge: 40, genderScope: 'F', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '45F': { minAge: 45, genderScope: 'F', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
  '50F': { minAge: 50, genderScope: 'F', ageType: 'minimum', ruleSource: 'FPT Regulamento 2026' },
}

export const CBT_YOUTH_RULES: Record<string, Partial<CategoryRule>> = {
  '12M': { minAge: 11, maxAge: 12, genderScope: 'M', ageType: 'exact', requiresFederationId: true, requiresCPF: true, ruleSource: 'CBT Infantojuvenil 2026' },
  '14M': { minAge: 13, maxAge: 14, genderScope: 'M', ageType: 'exact', requiresFederationId: true, requiresCPF: true, ruleSource: 'CBT Infantojuvenil 2026' },
  '16M': { minAge: 15, maxAge: 16, genderScope: 'M', ageType: 'exact', requiresFederationId: true, requiresCPF: true, ruleSource: 'CBT Infantojuvenil 2026' },
  '18M': { minAge: 17, maxAge: 18, genderScope: 'M', ageType: 'exact', requiresFederationId: true, requiresCPF: true, ruleSource: 'CBT Infantojuvenil 2026' },
  '12F': { minAge: 11, maxAge: 12, genderScope: 'F', ageType: 'exact', requiresFederationId: true, requiresCPF: true, ruleSource: 'CBT Infantojuvenil 2026' },
  '14F': { minAge: 13, maxAge: 14, genderScope: 'F', ageType: 'exact', requiresFederationId: true, requiresCPF: true, ruleSource: 'CBT Infantojuvenil 2026' },
  '16F': { minAge: 15, maxAge: 16, genderScope: 'F', ageType: 'exact', requiresFederationId: true, requiresCPF: true, ruleSource: 'CBT Infantojuvenil 2026' },
  '18F': { minAge: 17, maxAge: 18, genderScope: 'F', ageType: 'exact', requiresFederationId: true, requiresCPF: true, ruleSource: 'CBT Infantojuvenil 2026' },
}
