"""
Scraper CBT (Confederação Brasileira de Tênis)
Fonte: https://cbt-tenis.com.br/tournaments-central
       https://www.tenisintegrado.com.br/new_torneio/index_tournament/2

Captura torneios nacionais e envia para /api/admin/ingest.
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("scraper.cbt")

CBT_BASE        = "https://cbt-tenis.com.br"
CBT_TOURNAMENTS = f"{CBT_BASE}/tournaments-central"
TI_BASE         = "https://www.tenisintegrado.com.br"
TI_TOURNAMENTS  = f"{TI_BASE}/new_torneio/index_tournament/2"

API_BASE_URL    = os.getenv("API_BASE_URL") or "http://localhost:3000"
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "dev-secret")
HEADLESS        = os.getenv("SCRAPER_HEADLESS", "true").lower() == "true"


def parse_date(text: str) -> Optional[str]:
    if not text:
        return None
    text = text.strip()
    patterns = [
        (r"(\d{2})/(\d{2})/(\d{4})", "%d/%m/%Y"),
        (r"(\d{4})-(\d{2})-(\d{2})", "%Y-%m-%d"),
        (r"(\d{2})\s+de\s+\w+\s+de\s+(\d{4})", None),
    ]
    for pattern, fmt in patterns:
        m = re.search(pattern, text)
        if m and fmt:
            try:
                return datetime.strptime(m.group(0), fmt).isoformat()
            except ValueError:
                continue
    return None


def parse_cbt_category(text: str) -> dict:
    """Detecta categorias CBT: 14M, 16F, 18M, Kids, Profissional etc."""
    result = {
        "sourceCategoryText": text.strip(),
        "normalizedCode": None,
        "genderScope": None,
        "classCode": None,
        "minAge": None,
        "maxAge": None,
        "ageType": None,
        "requiresFederationId": True,
        "requiresCPF": True,
    }

    lower = text.lower()

    # Infantojuvenil: 12, 14, 16, 18
    youth_m = re.search(r"(\d{2})\s*([MF])", text, re.IGNORECASE)
    if youth_m:
        age    = int(youth_m.group(1))
        gender = youth_m.group(2).upper()
        if age in (12, 14, 16, 18):
            result["minAge"]        = age - 1
            result["maxAge"]        = age
            result["ageType"]       = "exact"
            result["genderScope"]   = gender
            result["normalizedCode"] = f"{age}{gender}"
            return result

    # Kids
    if "kids" in lower or "10 anos" in lower or "12 anos" in lower:
        result["maxAge"]       = 12
        result["ageType"]      = "exact"
        result["normalizedCode"] = "Kids"
        result["requiresFederationId"] = False
        result["requiresCPF"] = False
        return result

    # Profissional
    if "profissional" in lower or "professional" in lower:
        result["normalizedCode"] = "PRO"
        result["classCode"]      = "PRO"
        return result

    # Cadeira de rodas
    if "cadeira" in lower or "wheelchair" in lower:
        result["normalizedCode"] = "CdR"
        return result

    return result


async def scrape_cbt_tournaments() -> list[dict]:
    """Scrapa página de torneios da CBT."""
    tournaments = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (compatible; TennisHubBot/1.0)",
            locale="pt-BR",
        )
        context.set_default_timeout(25000)
        page = await context.new_page()

        logger.info(f"Acessando {CBT_TOURNAMENTS}...")
        try:
            await page.goto(CBT_TOURNAMENTS, wait_until="networkidle")
            await page.wait_for_timeout(2000)
        except PlaywrightTimeout:
            logger.warning("Timeout na página CBT — tentando Tênis Integrado")
            await browser.close()
            return await scrape_tenis_integrado_cbt()

        # Seletores prováveis para torneios CBT
        card_selectors = [
            ".tournament-card", ".torneio-item", "tr.torneio",
            "[data-tournament]", ".event-card",
        ]

        cards = []
        for sel in card_selectors:
            cards = await page.query_selector_all(sel)
            if cards:
                logger.info(f"{len(cards)} cards com '{sel}'")
                break

        if not cards:
            logger.warning("Nenhum card CBT encontrado — fallback Tênis Integrado")
            await browser.close()
            return await scrape_tenis_integrado_cbt()

        for i, card in enumerate(cards[:30]):
            try:
                name = None
                for sel in ["h3", "h4", ".nome", ".tournament-name", "strong"]:
                    el = await card.query_selector(sel)
                    if el:
                        name = (await el.inner_text()).strip()
                        if name and len(name) > 3:
                            break

                if not name:
                    continue

                city = state = None
                loc_el = await card.query_selector(".cidade, .local, .location")
                if loc_el:
                    loc = (await loc_el.inner_text()).strip()
                    parts = loc.split(",")
                    city  = parts[0].strip() if parts else None
                    state = parts[-1].strip()[-2:] if len(parts) > 1 else None

                status_text = "announced"
                status_el = await card.query_selector(".status, .badge")
                if status_el:
                    status_text = (await status_el.inner_text()).strip().lower()
                    if "aberto" in status_text or "open" in status_text:
                        status_text = "open"
                    elif "encerrado" in status_text:
                        status_text = "closed"
                    else:
                        status_text = "announced"

                link_el = await card.query_selector("a[href*='/tournament/'], a[href*='/torneio/']")
                detail_url = None
                if link_el:
                    href = await link_el.get_attribute("href")
                    if href:
                        detail_url = urljoin(CBT_BASE, href)

                # Categorias padrão CBT quando não consegue extrair
                categories = []
                cat_els = await card.query_selector_all(".categoria, .category-tag")
                if cat_els:
                    for cat_el in cat_els:
                        cat_text = (await cat_el.inner_text()).strip()
                        if cat_text:
                            categories.append(parse_cbt_category(cat_text))
                else:
                    # Categorias inferidas para torneios infantojuvenis
                    if any(k in name.lower() for k in ["infantojuvenil", "junior", "juvenil", "kids"]):
                        for age_gender in ["14M","14F","16M","16F","18M","18F"]:
                            categories.append(parse_cbt_category(age_gender))

                tournaments.append({
                    "name":             name,
                    "organizationName": "Confederação Brasileira de Tênis",
                    "venueCity":        city,
                    "venueState":       state,
                    "status":           status_text,
                    "officialSourceUrl": detail_url or CBT_TOURNAMENTS,
                    "dataConfidence":   "med",
                    "categories":       categories,
                    "registrationUrl":  detail_url,
                })
                logger.info(f"  ✓ {name[:50]} — {len(categories)} cats")

            except Exception as e:
                logger.error(f"Erro card CBT {i}: {e}")

        await browser.close()

    return tournaments


async def scrape_tenis_integrado_cbt() -> list[dict]:
    """Fallback: scrapa torneios CBT via portal Tênis Integrado."""
    tournaments = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(locale="pt-BR")
        context.set_default_timeout(25000)
        page = await context.new_page()

        logger.info(f"Fallback: {TI_TOURNAMENTS}")
        try:
            await page.goto(TI_TOURNAMENTS, wait_until="networkidle")
            await page.wait_for_timeout(3000)
        except PlaywrightTimeout:
            logger.error("Timeout no Tênis Integrado")
            await browser.close()
            return []

        rows = await page.query_selector_all("tr, .torneio-row")
        logger.info(f"Encontradas {len(rows)} linhas")

        for row in rows[:50]:
            try:
                text = (await row.inner_text()).strip()
                if not text or len(text) < 5:
                    continue

                cells = text.split("\t")
                if len(cells) < 2:
                    cells = text.split("\n")

                name = cells[0].strip() if cells else text[:80]
                if not name or len(name) < 4:
                    continue

                tournaments.append({
                    "name":             name,
                    "organizationName": "Confederação Brasileira de Tênis",
                    "status":           "announced",
                    "officialSourceUrl": TI_TOURNAMENTS,
                    "dataConfidence":   "low",
                    "categories":       [],
                })

            except Exception:
                pass

        await browser.close()

    return tournaments


async def send_to_backend(tournaments: list[dict]) -> dict:
    url     = f"{API_BASE_URL}/api/admin/ingest"
    headers = {"X-Internal-Token": INTERNAL_SECRET, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(url, json={"source": "CBT", "tournaments": tournaments}, headers=headers)
        res.raise_for_status()
        return res.json()


async def main():
    logger.info("=== CBT Scraper iniciando ===")

    tournaments = await scrape_cbt_tournaments()
    logger.info(f"Total encontrado: {len(tournaments)}")

    if tournaments:
        result = await send_to_backend(tournaments)
        logger.info(f"Backend: {json.dumps(result)}")
    else:
        logger.warning("Nenhum torneio CBT encontrado")

    logger.info("=== CBT Scraper finalizado ===")


if __name__ == "__main__":
    asyncio.run(main())
