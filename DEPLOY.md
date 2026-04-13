# Guia de Deploy — Tennis Hub

## Railway (recomendado para MVP)

### 1. Criar conta e instalar CLI

```bash
npm install -g @railway/cli
railway login
```

### 2. Criar projeto no Railway

```bash
railway init
# Escolha: "Empty project"
# Nome: tennis-hub
```

### 3. Adicionar banco PostgreSQL

No painel Railway:
- Clique em **+ Add Service → Database → PostgreSQL**
- O Railway cria automaticamente e injeta `DATABASE_URL`

### 4. Configurar variáveis de ambiente

No painel Railway → seu serviço → **Variables**, adicione:

```
NEXTAUTH_SECRET    → openssl rand -base64 32
NEXTAUTH_URL       → https://<seu-projeto>.up.railway.app
INTERNAL_SECRET    → qualquer string secreta longa
RESEND_API_KEY     → sua chave do resend.com (opcional no início)
NODE_ENV           → production
NEXT_TELEMETRY_DISABLED → 1
```

### 5. Deploy

```bash
# Na raiz do projeto
railway up
```

O Railway detecta o `Dockerfile` na raiz e faz o build automaticamente.

### 6. Popular banco após o deploy

```bash
railway run npm run db:seed
```

### 7. Acessar

```bash
railway open
```

---

## Render

### 1. Criar conta em render.com

### 2. Deploy via Blueprint (automático)

O arquivo `render.yaml` na raiz configura todos os serviços automaticamente.

- No Render: **New → Blueprint**
- Conecte seu repositório GitHub
- O Render lê o `render.yaml` e cria: web app + banco + cron jobs

### 3. Configurar variáveis obrigatórias

Após o blueprint criar os serviços, vá em cada serviço → **Environment**:

```
NEXTAUTH_URL    → https://<seu-app>.onrender.com
NEXTAUTH_SECRET → openssl rand -base64 32
RESEND_API_KEY  → sua chave (opcional no início)
```

As demais variáveis (`DATABASE_URL`, `INTERNAL_SECRET`) são geradas automaticamente pelo blueprint.

### 4. Popular banco

No painel Render → seu web service → **Shell**:

```bash
npm run db:seed
```

---

## Deploy manual via Docker (qualquer VPS)

```bash
# Build
docker build -t tennis-hub .

# Rodar (com banco externo)
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  -e NEXTAUTH_URL="https://seu-dominio.com" \
  -e INTERNAL_SECRET="..." \
  --name tennis-hub \
  tennis-hub
```

---

## Pós-deploy: Checklist

- [ ] App acessível em https://
- [ ] Login com `jogador@tennishub.com.br` / `tennis123` funcionando
- [ ] Admin em `/admin` com `admin@tennishub.com.br` / `admin123`
- [ ] `/api/health` retorna `{ "status": "ok" }`
- [ ] Banco populado: `npm run db:seed`
- [ ] Variável `NEXTAUTH_URL` aponta para o domínio correto

---

## Variáveis de ambiente — resumo

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | URL PostgreSQL (gerada pelo provider) |
| `NEXTAUTH_SECRET` | ✅ | Gerar com `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | URL pública do app (ex: https://x.up.railway.app) |
| `INTERNAL_SECRET` | ✅ | Token para scrapers chamarem a API |
| `RESEND_API_KEY` | ⬜ | Alertas por e-mail (pode deixar vazio no início) |
| `NODE_ENV` | ✅ | `production` |
| `NEXT_TELEMETRY_DISABLED` | ⬜ | `1` (recomendado) |

---

## Scrapers — configuração pós-deploy

Após o app estar no ar, configure os scrapers para apontarem para a URL de produção:

```bash
# .env dos scrapers
API_BASE_URL=https://seu-app.up.railway.app
INTERNAL_SECRET=mesmo-valor-do-INTERNAL_SECRET-da-api
```

No Railway, adicione os scrapers como **Cron Jobs**:
- FPT: `cd packages/connectors/fpt && python scraper.py` — a cada 6h
- CBT: `cd packages/connectors/cbt && python scraper.py` — a cada 6h
- Alertas: `cd packages/jobs && npx tsx alert-dispatcher.ts` — a cada hora
