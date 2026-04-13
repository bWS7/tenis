import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding banco de dados...')

  // Usuário admin para acesso ao painel
  const adminPwd = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where:  { email: 'admin@tennishub.com.br' },
    update: {},
    create: {
      email:         'admin@tennishub.com.br',
      passwordHash:  adminPwd,
      role:          'admin',
      status:        'active',
      consentVersion: '1.0',
      consentedAt:   new Date(),
    },
  })
  console.log('  ✓ Admin: admin@tennishub.com.br / admin123')

  // Usuário jogador de teste
  const playerPwd = await bcrypt.hash('tennis123', 12)
  const testUser = await prisma.user.upsert({
    where:  { email: 'jogador@tennishub.com.br' },
    update: {},
    create: {
      email:          'jogador@tennishub.com.br',
      passwordHash:   playerPwd,
      role:           'player',
      status:         'active',
      consentVersion: '1.0',
      consentedAt:    new Date(),
    },
  })

  // Perfil do jogador de teste
  await prisma.playerProfile.upsert({
    where:  { id: 'profile_test_player' },
    update: {},
    create: {
      id:               'profile_test_player',
      userId:           testUser.id,
      displayName:      'Carlos Silva',
      birthYear:        1988,
      gender:           'M',
      homeState:        'SP',
      travelRadiusKm:   100,
      competitiveLevel: 'federated',
      isDefault:        true,
    },
  })

  await prisma.playerProfileCategory.upsert({
    where: { id: 'ppc_test_1' },
    update: {},
    create: {
      id:              'ppc_test_1',
      playerProfileId: 'profile_test_player',
      taxonomy:        'FPT_CLASS',
      code:            '4',
      isPrimary:       true,
    },
  })
  console.log('  ✓ Jogador teste: jogador@tennishub.com.br / tennis123')

  // Organizações
  const fpt = await prisma.organization.upsert({
    where: { id: 'org_fpt' },
    update: {},
    create: {
      id:        'org_fpt',
      name:      'Federação Paulista de Tênis',
      shortName: 'FPT',
      type:      'federation',
      state:     'SP',
      websiteUrl: 'https://tenispaulista.com.br',
    },
  })

  const cbt = await prisma.organization.upsert({
    where: { id: 'org_cbt' },
    update: {},
    create: {
      id:        'org_cbt',
      name:      'Confederação Brasileira de Tênis',
      shortName: 'CBT',
      type:      'confederation',
      websiteUrl: 'https://cbt-tenis.com.br',
    },
  })

  // DataSources
  await prisma.dataSource.upsert({
    where: { id: 'ds_fpt_html' },
    update: {},
    create: {
      id:               'ds_fpt_html',
      organizationId:   fpt.id,
      sourceName:       'FPT Área Pública',
      sourceType:       'html',
      baseUrl:          'https://sisfpt.com.br/area-publica/torneios/abertos',
      enabled:          true,
      fetchScheduleCron: '0 */6 * * *',
      priority:         1,
    },
  })

  await prisma.dataSource.upsert({
    where: { id: 'ds_fpt_pdf' },
    update: {},
    create: {
      id:             'ds_fpt_pdf',
      organizationId: fpt.id,
      sourceName:     'FPT Regulamento 2026 (PDF)',
      sourceType:     'pdf',
      baseUrl:        'https://www.tenispaulista.com.br/wp-content/uploads/2026/02/FPT_-_Regulamento-Torneios-Abertos-2026.pdf',
      enabled:        true,
      priority:       1,
    },
  })

  // RuleSet FPT
  const fptRuleSet = await prisma.ruleSet.upsert({
    where: { id: 'rs_fpt_2026' },
    update: {},
    create: { id: 'rs_fpt_2026', scope: 'FPT', name: 'FPT Regulamento 2026' },
  })

  const fptRuleVersion = await prisma.ruleVersion.upsert({
    where: { id: 'rv_fpt_2026_v1' },
    update: {},
    create: {
      id:            'rv_fpt_2026_v1',
      ruleSetId:     fptRuleSet.id,
      version:       '2026.1',
      effectiveFrom: new Date('2026-01-01'),
      sourceUrl:     'https://www.tenispaulista.com.br/wp-content/uploads/2026/02/FPT_-_Regulamento-Torneios-Abertos-2026.pdf',
      status:        'active',
    },
  })

  // RuleClauses FPT — classes
  const classRules = [
    { code: '1', label: 'Primeira classe' },
    { code: '2', label: 'Segunda classe' },
    { code: '3', label: 'Terceira classe' },
    { code: '4', label: 'Quarta classe' },
    { code: '5', label: 'Quinta classe' },
  ]

  for (const cls of classRules) {
    await prisma.ruleClause.upsert({
      where: { id: `rc_fpt_class_${cls.code}` },
      update: {},
      create: {
        id:            `rc_fpt_class_${cls.code}`,
        ruleVersionId: fptRuleVersion.id,
        clauseType:    'class',
        logicJson:     { classCode: cls.code, allowClassUp: true },
        humanText:     `${cls.label}: pode jogar sua classe ou 1 classe acima`,
        categoryCode:  cls.code,
      },
    })
  }

  // Torneios de exemplo
  const torneios = [
    {
      id: 't_abc_open_2026',
      slug: 'fpt-abc-open-2026',
      name: 'ABC Open de Tênis 2026',
      orgId: fpt.id,
      city: 'Santo André', state: 'SP', venue: 'Clube Atlético Indiano',
      start: '2026-05-10', end: '2026-05-12',
      entryOpen: '2026-04-01', entryClose: '2026-04-28T23:59:00',
      status: 'open',
      url: 'https://sisfpt.com.br/torneio/abc-open-2026',
      categories: [
        { code: '4M1', text: '4M1 — Masculino 4ª Classe Simples', gender: 'M', cls: '4', price: 120 },
        { code: '4M2', text: '4M2 — Masculino 4ª Classe Duplas',  gender: 'M', cls: '4', price: 90  },
        { code: '35M+', text: '35M+ — Sênior Masculino 35+',      gender: 'M', minAge: 35, ageType: 'minimum', price: 120 },
        { code: '3M1', text: '3M1 — Masculino 3ª Classe Simples',  gender: 'M', cls: '3', price: 130 },
        { code: '5M1', text: '5M1 — Masculino 5ª Classe Simples',  gender: 'M', cls: '5', price: 100 },
        { code: '1F1', text: '1F1 — Feminino 1ª Classe',           gender: 'F', cls: '1', price: 130 },
        { code: null,  text: 'Duplas Mistas — Aberto',             gender: 'Mixed', price: null },
      ],
    },
    {
      id: 't_paulistano_masters_2026',
      slug: 'clube-paulistano-masters-2026',
      name: 'Masters Clube Paulistano',
      orgId: fpt.id,
      city: 'São Paulo', state: 'SP', venue: 'Clube Paulistano',
      start: '2026-05-17', end: '2026-05-19',
      entryOpen: '2026-04-05', entryClose: '2026-04-30T23:59:00',
      status: 'open',
      url: 'https://sisfpt.com.br/torneio/paulistano-masters-2026',
      categories: [
        { code: '4M1', text: '4M1 — Masculino 4ª Classe',  gender: 'M', cls: '4', price: 110 },
        { code: '40M+', text: '40M+ — Sênior Masculino 40+', gender: 'M', minAge: 40, ageType: 'minimum', price: 110 },
        { code: '3M1', text: '3M1 — Masculino 3ª Classe',  gender: 'M', cls: '3', price: 120 },
        { code: '4F1', text: '4F1 — Feminino 4ª Classe',    gender: 'F', cls: '4', price: 110 },
        { code: '3F1', text: '3F1 — Feminino 3ª Classe',    gender: 'F', cls: '3', price: 120 },
      ],
    },
    {
      id: 't_campinas_gp_2026',
      slug: 'campinas-grand-prix-2026',
      name: 'Grand Prix Campinas de Tênis',
      orgId: fpt.id,
      city: 'Campinas', state: 'SP', venue: 'Clube Campineiro de Tênis',
      start: '2026-05-24', end: '2026-05-26',
      entryOpen: '2026-04-10', entryClose: '2026-05-05T23:59:00',
      status: 'announced',
      url: 'https://sisfpt.com.br/torneio/campinas-gp-2026',
      categories: [
        { code: '4M1', text: '4M1 — Masculino 4ª Classe',    gender: 'M', cls: '4', price: 115 },
        { code: '4M2', text: '4M2 — Duplas Masculino 4ª',    gender: 'M', cls: '4', price: 85  },
        { code: '35M+', text: '35M+ — Sênior 35+',           gender: 'M', minAge: 35, ageType: 'minimum', price: 115 },
        { code: '5M1', text: '5M1 — Masculino 5ª Classe',    gender: 'M', cls: '5', price: 95  },
        { code: '4F1', text: '4F1 — Feminino 4ª Classe',     gender: 'F', cls: '4', price: 115 },
        { code: '3M1', text: '3M1 — Masculino 3ª Classe',    gender: 'M', cls: '3', price: 125 },
      ],
    },
  ]

  for (const t of torneios) {
    const tournament = await prisma.tournament.upsert({
      where:  { canonicalSlug: t.slug },
      update: {},
      create: {
        id:             t.id,
        canonicalName:  t.name,
        canonicalSlug:  t.slug,
        organizationId: t.orgId,
        modalidade:     'tenis',
      },
    })

    const edition = await prisma.tournamentEdition.upsert({
      where: { tournamentId_seasonYear: { tournamentId: tournament.id, seasonYear: 2026 } },
      update: {},
      create: {
        tournamentId:      tournament.id,
        seasonYear:        2026,
        startAt:           new Date(t.start),
        endAt:             new Date(t.end),
        entryOpenAt:       new Date(t.entryOpen),
        entryCloseAt:      new Date(t.entryClose),
        status:            t.status,
        venueCity:         t.city,
        venueState:        t.state,
        venueName:         t.venue,
        officialSourceUrl: t.url,
        sourceName:        'FPT',
        fetchedAt:         new Date(),
        dataConfidence:    'high',
        dataOrigin:        'manual',
      },
    })

    // Categorias
    for (let i = 0; i < t.categories.length; i++) {
      const cat = t.categories[i]
      await prisma.tournamentCategory.create({
        data: {
          tournamentEditionId: edition.id,
          sourceCategoryText:  cat.text,
          normalizedCode:      cat.code,
          genderScope:         cat.gender,
          classCode:           cat.cls ?? null,
          minAge:              cat.minAge ?? null,
          ageType:             cat.ageType ?? (cat.cls ? 'exact' : null),
          priceBrl:            cat.price ? cat.price : null,
          priceRaw:            cat.price ? `R$ ${cat.price},00` : 'Consulte o regulamento',
          visibilityOrder:     i,
        },
      })
    }

    // Link de inscrição
    await prisma.tournamentLink.create({
      data: {
        tournamentEditionId: edition.id,
        linkType:            'registration',
        url:                 t.url,
        label:               'Inscrição oficial',
        isOfficial:          true,
        sourceName:          'FPT',
      },
    })

    // Rule binding
    await prisma.tournamentRuleBinding.create({
      data: {
        tournamentEditionId: edition.id,
        ruleVersionId:       fptRuleVersion.id,
        bindingReason:       'Torneio FPT 2026',
      },
    })

    console.log(`  ✓ ${t.name}`)
  }

  console.log('✅ Seed concluído!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => prisma.$disconnect())
