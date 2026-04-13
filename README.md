# Tennis Hub 🎾

Agregador de torneios de tênis centrado no jogador no Brasil.

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose
- Python 3.12+ (para scrapers)

---

## Setup completo em 5 passos

### 1. Variáveis de ambiente

```bash
cp .env.example apps/web/.env.local
```

Edite `apps/web/.env.local`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tennishub"
NEXTAUTH_SECRET="gere-com-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
INTERNAL_SECRET="token-secreto-para-scrapers"
RESEND_API_KEY=""
```

### 2. Subir o banco PostgreSQL

```bash
docker compose up postgres -d
# Aguardar ~5 segundos para o banco inicializar
```

### 3. Instalar dependências e aplicar schema

```bash
npm install

# Aplicar schema no banco
cd packages/db
npm install
npm run db:push

# Popular com dados de exemplo
npm run db:seed
```

### 4. Rodar o app

```bash
# Na raiz do projeto
cd ../..
npm run dev
```

Acesse: **http://localhost:3000**

### 5. Login

| Usuário | Senha | Perfil |
|---|---|---|
| `jogador@tennishub.com.br` | `tennis123` | Jogador (Carlos, 4ª classe SP) |
| `admin@tennishub.com.br` | `admin123` | Administrador |

---

## Rodar os scrapers Python

### Setup do ambiente Python

```bash
cd packages/connectors/fpt
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### Scraper FPT

```bash
# Com o app rodando em :3000
INTERNAL_SECRET=token-secreto-para-scrapers python scraper.py
```

### Scraper CBT

```bash
cd ../cbt
pip install -r requirements.txt
playwright install chromium
INTERNAL_SECRET=token-secreto-para-scrapers python scraper.py
```

### Extrator de regulamentos PDF

```bash
cd ../fpt
pip install -r requirements-pdf.txt

# FPT regulamento 2026
python pdf-rules.py \
  --source fpt \
  --url https://www.tenispaulista.com.br/wp-content/uploads/2026/02/FPT_-_Regulamento-Torneios-Abertos-2026.pdf

# CBT regulamento infantojuvenil
python pdf-rules.py \
  --source cbt \
  --url https://tenis-integrado-prod.s3.amazonaws.com/sync-prod/id22798/anexos/anexo_1773928563.pdf
```

---

## Rodar os jobs de alertas

```bash
cd packages/jobs
npm install

# Alertas de prazo (D-7, D-2, D-0) + alertas de mudança
npx tsx alert-dispatcher.ts

# Job de diff e change events
npx tsx diff-job.ts
```

Configurar no cron do servidor:
```cron
0 * * * * cd /app/packages/jobs && npx tsx alert-dispatcher.ts
0 */6 * * * cd /app/packages/connectors/fpt && python scraper.py
```

---

## Via Docker (tudo junto)

```bash
# App + banco
docker compose up postgres web -d

# Rodar scraper FPT isolado
docker compose --profile scraper up scraper-fpt
```

---

## Estrutura do projeto

```
tennis-hub/
├── apps/web/                   # Next.js 14 PWA (frontend + API)
│   └── src/
│       ├── app/
│       │   ├── (auth)/         # login, register, onboarding
│       │   ├── (player)/       # home, torneios, watchlist, alertas, perfil
│       │   ├── (admin)/        # painel administrativo
│       │   └── api/            # endpoints REST
│       ├── components/         # UI reutilizável
│       ├── hooks/              # hooks de dados
│       ├── lib/                # prisma, auth, utils
│       └── middleware.ts       # proteção de rotas
├── packages/
│   ├── core/                   # motor de elegibilidade TypeScript
│   ├── db/                     # schema Prisma + seed
│   ├── jobs/                   # alert-dispatcher, diff-job
│   └── connectors/
│       ├── fpt/                # scraper FPT + extrator PDF
│       └── cbt/                # scraper CBT
└── docker-compose.yml
```

---

## Endpoints principais

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/tournaments` | Lista com filtros |
| `GET` | `/api/tournaments/:slug` | Detalhe do torneio |
| `GET` | `/api/tournaments/:slug/eligibility` | Elegibilidade por perfil |
| `GET` | `/api/tournaments/compare?slugs=a,b,c` | Comparar até 3 torneios |
| `POST` | `/api/auth/register` | Criar conta |
| `GET/POST` | `/api/player-profiles` | Perfil do jogador |
| `GET` | `/api/player-profiles/export` | Exportar dados (LGPD) |
| `DELETE` | `/api/player-profiles/delete` | Excluir conta (LGPD) |
| `GET/POST/DELETE/PATCH` | `/api/watchlist` | Gerenciar watchlist |
| `GET/PATCH` | `/api/alerts` | Notificações |
| `POST` | `/api/admin/ingest` | Ingestão de scrapers |
| `POST` | `/api/admin/ingest-rules` | Ingestão de regras PDF |
| `GET/POST` | `/api/admin/sources` | Gerenciar fontes |
| `POST` | `/api/admin/sources/:id/toggle` | Ativar/pausar fonte |
| `POST` | `/api/admin/sources/:id/trigger` | Disparar job |
| `GET` | `/api/admin/tournaments/:id` | Detalhe admin |
| `POST` | `/api/admin/tournaments/:id/override` | Override com auditoria |

---

## Usuários de teste criados pelo seed

O `npm run db:seed` cria automaticamente:
- **Admin**: `admin@tennishub.com.br` / `admin123`
- **Jogador**: `jogador@tennishub.com.br` / `tennis123` (Carlos Silva, 4ª classe, SP)
- **3 torneios FPT** com categorias completas

---

## Regras de negócio implementadas

- Idade esportiva = ano atual − ano de nascimento (sem mês/dia)
- Classes FPT: jogador pode jogar sua classe ou 1 acima (ex: 4ª pode jogar 3ª)
- Seniors: podem jogar categorias de idade menor (ex: 45+ pode jogar 40+)
- CBT Infantojuvenil: exige registro federal + CPF
- Elegibilidade sempre explica o motivo (compatible / incompatible / unknown)
- Dados nunca sobrescritos quando `isManualOverride = true`
