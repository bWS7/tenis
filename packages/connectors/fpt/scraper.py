"""
Scraper FPT (Federação Paulista de Tênis)
Fonte: https://sisfpt.com.br/area-publica/torneios/abertos

Captura lista de torneios abertos e normaliza para o schema interno.
Envia para /api/admin/ingest via POST autenticado.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import httpx
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("scraper.fpt")

# ─── Config ─────────────────────────────────────────────────────────────────

FPT_BASE_URL    = "https://sisfpt.com.br"
FPT_TOURNAMENTS = f"{FPT_BASE_URL}/area-publica/torneios/abertos"
API_BASE_URL    = os.getenv("API_BASE_URL", "http://localhost:3000")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "dev-secret")
HEADLESS        = os.getenv("SCRAPER_HEADLESS", "true").lower() == "true"

# Mapeamento de texto de status FPT → status interno
STATUS_MAP = {
    "inscrições abertas": "open",
    "inscricoes abertas": "open",
    "aberto":             "open",
    "encerrado":          "closed",
    "cancelado":          "canceled",
    "aguardando":         "announced",
    "em andamento":       "in_progress",
    "finalizado":         "finished",
}

# Mapeamento de categorias FPT para estrutura interna
# Ex: "4M1" → class=4, gender=M, type=singles
CATEGORY_PATTERN = re.compile(
    r"^(?P<class>[1-5]|PR)?"
    r"(?P<gender>[MF])?"
    r"(?P<seq>[1-2])?"
    r"(?:\s*[-–]\s*(?P<desc>.+))?$",
    re.IGNORECASE,
)

SENIOR_PATTERN = re.compile(r"(\d{2})\s*\+?\s*([MF])", re.IGNORECASE)


def parse_category(text: str) -> dict:
    """Extrai campos estruturados de um texto de categoria."""
    result = {
        "sourceCategoryText": text.strip(),
        "normalizedCode": None,
        "genderScope": None,
        "classCode": None,
        "minAge": None,
        "maxAge": None,
        "ageType": None,
    }

    # Tentar padrão senior: "35M+", "40F+", "35+"
    senior_m = SENIOR_PATTERN.search(text)
    if senior_m or "sênior" in text.lower() or "senior" in text.lower() or "+" in text:
        age_match = re.search(r"(\d{2})", text)
        gender_match = re.search(r"\b([MF])\b", text, re.IGNORECASE)
        if age_match:
            age = int(age_match.group(1))
            gender = gender_match.group(1).upper() if gender_match else None
            result["minAge"] = age
            result["ageType"] = "minimum"
            result["genderScope"] = gender
            result["normalizedCode"] = f"{age}{gender or ''}+"
            return result

    # Tentar padrão de classe: "4M1", "3F2", etc.
    cat_m = CATEGORY_PATTERN.match(text.split("—")[0].split("-")[0].strip())
    if cat_m and cat_m.group("class"):
        result["classCode"] = cat_m.group("class")
        result["genderScope"] = cat_m.group("gender").upper() if cat_m.group("gender") else None
        result["ageType"] = "exact"
        code = f"{cat_m.group('class')}{cat_m.group('gender') or ''}"
        if cat_m.group("seq"):
            code += cat_m.group("seq")
        result["normalizedCode"] = code.upper()

    return result


def parse_price(text: str) -> tuple[Optional[float], str]:
    """Extrai valor numérico e texto original de preço."""
    raw = text.strip()
    match = re.search(r"R?\$\s*([\d.,]+)", raw)
    if match:
        value_str = match.group(1).replace(".", "").replace(",", ".")
        try:
            return float(value_str), raw
        except ValueError:
            pass
    return None, raw


def parse_date(text: str) -> Optional[str]:
    """Converte datas brasileiras para ISO 8601."""
    if not text:
        return None

    text = text.strip()

    # Formato DD/MM/YYYY HH:MM
    patterns = [
        (r"(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2})", "%d/%m/%Y %H:%M"),
        (r"(\d{2})/(\d{2})/(\d{4})",                     "%d/%m/%Y"),
        (r"(\d{4})-(\d{2})-(\d{2})",                     "%Y-%m-%d"),
    ]

    for pattern, fmt in patterns:
        if re.search(pattern, text):
            try:
                clean = re.search(pattern, text).group(0)
                dt = datetime.strptime(clean, fmt)
                return dt.isoformat()
            except ValueError:
                continue

    return None


def normalize_status(text: str) -> str:
    """Converte texto de status para enum interno."""
    lower = text.lower().strip()
    for key, value in STATUS_MAP.items():
        if key in lower:
            return value
    return "unknown"


async def scrape_tournament_detail(page: Page, url: str) -> dict:
    """Acessa a página de detalhe de um torneio e extrai informações completas."""
    detail = {
        "categories": [],
        "registrationUrl": None,
        "regulationUrl": None,
        "entryOpenAt": None,
        "entryCloseAt": None,
        "venueName": None,
    }

    try:
        await page.goto(url, wait_until="networkidle", timeout=15000)

        html = await page.content()

        # Tentar extrair prazo de inscrição
        deadline_selectors = [
            ".prazo-inscricao", ".data-limite", "[data-deadline]",
            "td:has-text('Prazo') + td", "td:has-text('Inscrição') + td",
        ]
        for sel in deadline_selectors:
            try:
                el = await page.query_selector(sel)
                if el:
                    text = await el.inner_text()
                    detail["entryCloseAt"] = parse_date(text)
                    if detail["entryCloseAt"]:
                        break
            except Exception:
                pass

        # Extrair categorias
        cat_selectors = [
            ".categoria-item", ".tournament-category", "tr.categoria",
            "td.categoria", ".categorias li",
        ]
        for sel in cat_selectors:
            elements = await page.query_selector_all(sel)
            if elements:
                for el in elements:
                    text = await el.inner_text()
                    if text.strip():
                        cat = parse_category(text)

                        # Tentar extrair preço do mesmo elemento ou próximo
                        try:
                            price_el = await el.query_selector(".preco, .valor, .price")
                            if price_el:
                                price_text = await price_el.inner_text()
                                cat["priceBrl"], cat["priceRaw"] = parse_price(price_text)
                        except Exception:
                            pass

                        detail["categories"].append(cat)
                break

        # Link de inscrição
        reg_selectors = ["a:has-text('Inscrever')", "a:has-text('Inscrição')", ".btn-inscricao"]
        for sel in reg_selectors:
            el = await page.query_selector(sel)
            if el:
                href = await el.get_attribute("href")
                if href:
                    detail["registrationUrl"] = urljoin(FPT_BASE_URL, href)
                    break

        # Link do regulamento
        reg_doc_selectors = ["a:has-text('Regulamento')", "a[href*='.pdf']"]
        for sel in reg_doc_selectors:
            el = await page.query_selector(sel)
            if el:
                href = await el.get_attribute("href")
                if href:
                    detail["regulationUrl"] = urljoin(FPT_BASE_URL, href)
                    break

    except PlaywrightTimeout:
        logger.warning(f"Timeout ao acessar detalhe: {url}")
    except Exception as e:
        logger.error(f"Erro ao scrape detalhe {url}: {e}")

    return detail


async def scrape_fpt_tournaments() -> dict:
    """
    Scraper principal FPT.
    Retorna payload no formato esperado pelo endpoint /api/admin/ingest.
    """
    tournaments = []
    html_snapshot = ""

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (compatible; TennisHubBot/1.0; +https://tennishub.com.br/bot)",
            locale="pt-BR",
            timezone_id="America/Sao_Paulo",
        )

        # Rate limiting gentil
        context.set_default_timeout(20000)

        page = await context.new_page()

        logger.info(f"Acessando {FPT_TOURNAMENTS}...")
        await page.goto(FPT_TOURNAMENTS, wait_until="networkidle")
        await page.wait_for_timeout(2000)  # aguarda renderização JS

        html_snapshot = await page.content()

        # Seletores da listagem (ajustar conforme layout real)
        card_selectors = [
            ".torneio-card",
            ".tournament-item",
            "tr.torneio",
            ".list-torneios > li",
            "[data-torneio-id]",
        ]

        cards = []
        for sel in card_selectors:
            cards = await page.query_selector_all(sel)
            if cards:
                logger.info(f"Encontrados {len(cards)} cards com seletor '{sel}'")
                break

        if not cards:
            logger.warning("Nenhum card encontrado — pode ser necessário ajustar seletores")
            # Fallback: capturar links de torneios
            cards = await page.query_selector_all("a[href*='/torneio/']")
            logger.info(f"Fallback: {len(cards)} links de torneio encontrados")

        detail_page = await context.new_page()

        for i, card in enumerate(cards[:50]):  # limite seguro por run
            try:
                # Extrair dados básicos do card
                name = None
                for name_sel in ["h3", "h4", ".nome-torneio", ".tournament-name", "strong"]:
                    el = await card.query_selector(name_sel)
                    if el:
                        name = (await el.inner_text()).strip()
                        if name:
                            break

                if not name:
                    name = (await card.inner_text()).strip().split("\n")[0]

                if not name or len(name) < 3:
                    continue

                # Local
                city = state = None
                for loc_sel in [".cidade", ".local", ".location", "td.local"]:
                    el = await card.query_selector(loc_sel)
                    if el:
                        loc_text = (await el.inner_text()).strip()
                        parts = loc_text.split(",")
                        if len(parts) >= 2:
                            city = parts[0].strip()
                            state = parts[-1].strip()[-2:]
                        else:
                            city = loc_text
                        break

                # Datas
                start_raw = end_raw = close_raw = None
                for date_sel in [".data-inicio", ".start-date", "td.data"]:
                    el = await card.query_selector(date_sel)
                    if el:
                        start_raw = (await el.inner_text()).strip()
                        break

                # Status
                status_text = "unknown"
                for status_sel in [".status", ".badge-status", ".situacao"]:
                    el = await card.query_selector(status_sel)
                    if el:
                        status_text = await el.inner_text()
                        break

                # Link do torneio
                detail_url = None
                link_el = await card.query_selector("a[href]")
                if not link_el and card.get_attribute:
                    href = await card.get_attribute("href")
                    if href:
                        detail_url = urljoin(FPT_BASE_URL, href)
                elif link_el:
                    href = await link_el.get_attribute("href")
                    if href:
                        detail_url = urljoin(FPT_BASE_URL, href)

                # Buscar detalhes se houver URL
                detail = {}
                if detail_url:
                    logger.info(f"  [{i+1}/{len(cards)}] Detalhe: {name[:40]}...")
                    detail = await scrape_tournament_detail(detail_page, detail_url)
                    await asyncio.sleep(1)  # rate limiting

                tournament = {
                    "name":             name,
                    "organizationName": "Federação Paulista de Tênis",
                    "venueCity":        city,
                    "venueState":       state or "SP",
                    "startAt":          parse_date(start_raw) if start_raw else None,
                    "endAt":            parse_date(end_raw) if end_raw else None,
                    "entryCloseAt":     detail.get("entryCloseAt") or parse_date(close_raw),
                    "status":           normalize_status(status_text),
                    "officialSourceUrl": detail_url or FPT_TOURNAMENTS,
                    "rawHtml":          None,  # não enviar HTML completo para economizar payload
                    "dataConfidence":   "med",
                    "categories":       detail.get("categories", []),
                    "registrationUrl":  detail.get("registrationUrl"),
                    "regulationUrl":    detail.get("regulationUrl"),
                }

                tournaments.append(tournament)
                logger.info(f"  ✓ {name[:50]} — {len(detail.get('categories', []))} categorias")

            except Exception as e:
                logger.error(f"Erro ao processar card {i}: {e}")
                continue

        await detail_page.close()
        await browser.close()

    logger.info(f"Scraping concluído: {len(tournaments)} torneios")

    return {
        "source":      "FPT",
        "tournaments": tournaments,
        "meta": {
            "fetchedAt":      datetime.utcnow().isoformat(),
            "sourceUrl":      FPT_TOURNAMENTS,
            "totalFound":     len(tournaments),
            "htmlHash":       hashlib.sha256(html_snapshot[:5000].encode()).hexdigest() if html_snapshot else None,
        },
    }


async def send_to_backend(payload: dict) -> dict:
    """Envia payload normalizado para a API Next.js."""
    url = f"{API_BASE_URL}/api/admin/ingest"
    headers = {
        "X-Internal-Token": INTERNAL_SECRET,
        "Content-Type":     "application/json",
    }

    # Remove meta antes de enviar (não faz parte do schema de ingestão)
    send_payload = {k: v for k, v in payload.items() if k != "meta"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=send_payload, headers=headers)
        response.raise_for_status()
        return response.json()


async def main():
    logger.info("=== FPT Scraper iniciando ===")

    try:
        payload = await scrape_fpt_tournaments()
        logger.info(f"Meta: {json.dumps(payload['meta'], indent=2)}")

        if payload["tournaments"]:
            logger.info("Enviando para backend...")
            result = await send_to_backend(payload)
            logger.info(f"Backend response: {json.dumps(result, indent=2)}")
        else:
            logger.warning("Nenhum torneio encontrado — verifique os seletores")

    except httpx.HTTPError as e:
        logger.error(f"Erro HTTP ao enviar para backend: {e}")
        raise
    except Exception as e:
        logger.error(f"Erro fatal: {e}")
        raise

    logger.info("=== FPT Scraper finalizado ===")


if __name__ == "__main__":
    asyncio.run(main())
