"""
Extrator de Regras de Regulamentos PDF
Processa PDFs oficiais da FPT e CBT e popula RuleVersion + RuleClause no banco.

Uso:
  python pdf-rules.py --source fpt --url https://tenispaulista.com.br/.../FPT_-_Regulamento-Torneios-Abertos-2026.pdf
  python pdf-rules.py --source cbt --url https://tenis-integrado-prod.s3.amazonaws.com/.../regulamento.pdf
"""

import argparse
import asyncio
import json
import logging
import os
import re
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
import pdfplumber

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pdf-rules")

API_BASE_URL    = os.getenv("API_BASE_URL", "http://localhost:3000")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET", "dev-secret")


@dataclass
class RuleClause:
    clauseType:   str
    logicJson:    dict
    humanText:    str
    categoryCode: Optional[str] = None


@dataclass
class ExtractedRules:
    source:      str
    version:     str
    sourceUrl:   str
    effectiveFrom: str
    clauses:     list[RuleClause] = field(default_factory=list)


# ─── Extratores por fonte ─────────────────────────────────────────────────────

def extract_fpt_rules(text: str, source_url: str) -> ExtractedRules:
    """
    Extrai regras do Regulamento FPT 2026.
    Foco em: tabela de classes, idades, regra de "pode subir uma classe".
    """
    result = ExtractedRules(
        source="FPT",
        version="2026.1",
        sourceUrl=source_url,
        effectiveFrom="2026-01-01",
    )

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # ── Regra de classes ────────────────────────────────────────────────────
    # Padrão: "O jogador de Xª classe pode se inscrever em torneios da Xª e X-1ª classes"
    class_patterns = [
        r"(\d)[ªa°]\s*classe[^.]*inscrever[^.]*(\d)[ªa°]\s*classe",
        r"categoria\s+(\w+)\s+pode[^.]*(\w+)\s+classe",
        r"classe[s]?\s+(\w+)[^.]*superior[^.]*(\w+)",
    ]

    for pattern in class_patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            clause = RuleClause(
                clauseType="class",
                logicJson={"allowClassUp": True, "maxClassJump": 1},
                humanText="Jogador pode se inscrever em sua classe ou 1 classe imediatamente superior",
            )
            result.clauses.append(clause)
            break

    # ── Regra de idade esportiva ─────────────────────────────────────────────
    age_patterns = [
        r"idade[^.]*considerad[ao][^.]*ano[^.]*nascimento",
        r"1[°ºo]\s+de\s+janeiro[^.]*ano\s+civil",
        r"ano\s+de\s+nascimento[^.]*independente[^.]*mês",
    ]
    for pattern in age_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            result.clauses.append(RuleClause(
                clauseType="age",
                logicJson={"ageCalculation": "birth_year_only", "referenceDate": "calendar_year"},
                humanText="Idade esportiva calculada com base apenas no ano de nascimento (sem mês/dia)",
            ))
            break

    # ── Regra seniors ────────────────────────────────────────────────────────
    senior_patterns = [
        r"sênio[r]?[^.]*(\d{2})\+[^.]*pode[^.]*(\d{2})\+",
        r"categoria[s]?\s+sênio[r]?[^.]*faixa[s]?\s+menore[s]?",
        r"jogador\s+de\s+(\d{2})\+[^.]*jogar[^.]*(\d{2})\+",
    ]
    for pattern in senior_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            result.clauses.append(RuleClause(
                clauseType="age",
                logicJson={"ageType": "minimum", "allowAgeDown": True},
                humanText="Jogadores seniors podem se inscrever em categorias de faixa etária menor (ex: 45+ pode jogar 40+)",
            ))
            break

    # ── Categorias explícitas de classe ──────────────────────────────────────
    # Detectar menção explícita de classes 1ª a 5ª
    for cls in range(1, 6):
        pattern = rf"{cls}[ªa°]\s*classe"
        if re.search(pattern, text, re.IGNORECASE):
            for gender in ['M', 'F']:
                result.clauses.append(RuleClause(
                    clauseType="class",
                    logicJson={"classCode": str(cls), "gender": gender, "allowClassUp": True},
                    humanText=f"{cls}ª Classe {('Masculino' if gender == 'M' else 'Feminino')}: pode jogar nesta ou 1 classe acima",
                    categoryCode=f"{cls}{gender}",
                ))

    # ── Valores de inscrição ──────────────────────────────────────────────────
    price_matches = re.findall(r"R\$\s*([\d.,]+)", text)
    if price_matches:
        result.clauses.append(RuleClause(
            clauseType="price",
            logicJson={"pricesFound": price_matches[:10]},
            humanText=f"Valores encontrados no regulamento: {', '.join(f'R$ {p}' for p in price_matches[:5])}",
        ))

    logger.info(f"FPT: {len(result.clauses)} cláusulas extraídas")
    return result


def extract_cbt_rules(text: str, source_url: str) -> ExtractedRules:
    """
    Extrai regras do Regulamento CBT Infantojuvenil 2026.
    Foco em: registro, CPF, regularidade federação, critérios de classificação.
    """
    result = ExtractedRules(
        source="CBT",
        version="2026.1",
        sourceUrl=source_url,
        effectiveFrom="2026-01-01",
    )

    # ── Exigência de CPF ─────────────────────────────────────────────────────
    if re.search(r"CPF|cadastro\s+de\s+pessoa\s+física", text, re.IGNORECASE):
        result.clauses.append(RuleClause(
            clauseType="membership",
            logicJson={"requiresCPF": True},
            humanText="Exige CPF válido cadastrado na CBT para inscrição",
        ))

    # ── Exigência de registro na federação ───────────────────────────────────
    if re.search(r"regulari[sz]ad[ao]\s+com\s+(sua\s+)?federa[çc]ão|filiado|cadastrado\s+na\s+federa", text, re.IGNORECASE):
        result.clauses.append(RuleClause(
            clauseType="membership",
            logicJson={"requiresFederationId": True, "requiresSameState": True},
            humanText="Exige registro e regularidade com a federação estadual de origem",
        ))

    # ── Regra de idade por ano civil ─────────────────────────────────────────
    if re.search(r"1[°ºo]\s*de\s*janeiro|ano\s*civil|ano\s*de\s*nascimento", text, re.IGNORECASE):
        result.clauses.append(RuleClause(
            clauseType="age",
            logicJson={"ageCalculation": "birth_year_only", "referenceDate": "january_1st"},
            humanText="Idade apurada em 1º de janeiro do ano civil — considera apenas o ano de nascimento",
        ))

    # ── Categorias infantojuvenis ─────────────────────────────────────────────
    for age in [12, 14, 16, 18]:
        pattern = rf"{age}\s*[Aa]nos?|[Cc]ategoria\s+{age}"
        if re.search(pattern, text):
            for gender in ['M', 'F']:
                result.clauses.append(RuleClause(
                    clauseType="age",
                    logicJson={
                        "minAge": age - 1,
                        "maxAge": age,
                        "ageType": "exact",
                        "gender": gender,
                        "requiresFederationId": True,
                        "requiresCPF": True,
                    },
                    humanText=f"Categoria {age} Anos {('Masculino' if gender == 'M' else 'Feminino')}: jogador deve ter {age - 1} ou {age} anos no ano civil",
                    categoryCode=f"{age}{gender}",
                ))

    # ── Anuidade ──────────────────────────────────────────────────────────────
    if re.search(r"anuidade|anuais|taxa\s+anual", text, re.IGNORECASE):
        result.clauses.append(RuleClause(
            clauseType="membership",
            logicJson={"requiresAnnualFee": True},
            humanText="Exige pagamento de anuidade em dia junto à federação estadual",
        ))

    logger.info(f"CBT: {len(result.clauses)} cláusulas extraídas")
    return result


# ─── Download e parse do PDF ───────────────────────────────────────────────────

async def download_pdf(url: str) -> Path:
    logger.info(f"Baixando PDF: {url}")
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        res = await client.get(url, headers={"User-Agent": "TennisHubBot/1.0"})
        res.raise_for_status()

    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp.write(res.content)
    tmp.close()
    logger.info(f"PDF salvo em {tmp.name} ({len(res.content) / 1024:.0f} KB)")
    return Path(tmp.name)


def extract_text_from_pdf(path: Path) -> str:
    text_parts = []
    with pdfplumber.open(path) as pdf:
        logger.info(f"PDF: {len(pdf.pages)} páginas")
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if text.strip():
                text_parts.append(text)
            # Limitar a 30 páginas para regulamentos muito longos
            if i >= 29:
                break
    return "\n".join(text_parts)


async def send_rules_to_backend(rules: ExtractedRules):
    url     = f"{API_BASE_URL}/api/admin/ingest-rules"
    headers = {"X-Internal-Token": INTERNAL_SECRET, "Content-Type": "application/json"}

    payload = {
        "source":        rules.source,
        "version":       rules.version,
        "sourceUrl":     rules.sourceUrl,
        "effectiveFrom": rules.effectiveFrom,
        "clauses": [
            {
                "clauseType":   c.clauseType,
                "logicJson":    c.logicJson,
                "humanText":    c.humanText,
                "categoryCode": c.categoryCode,
            }
            for c in rules.clauses
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(url, json=payload, headers=headers)
        if res.status_code == 404:
            # Endpoint ainda não implementado — salva em arquivo local
            out = Path(f"extracted-rules-{rules.source.lower()}.json")
            out.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
            logger.info(f"Salvo localmente: {out}")
            return {"ok": True, "savedLocal": str(out)}
        res.raise_for_status()
        return res.json()


async def main():
    parser = argparse.ArgumentParser(description="Extrator de regras de PDFs de regulamentos")
    parser.add_argument("--source", required=True, choices=["fpt", "cbt"], help="Fonte do regulamento")
    parser.add_argument("--url",    required=True, help="URL do PDF do regulamento")
    parser.add_argument("--local",  help="Caminho local do PDF (alternativa à URL)")
    args = parser.parse_args()

    if args.local:
        pdf_path = Path(args.local)
    else:
        pdf_path = await download_pdf(args.url)

    text = extract_text_from_pdf(pdf_path)
    logger.info(f"Texto extraído: {len(text)} caracteres")

    if args.source == "fpt":
        rules = extract_fpt_rules(text, args.url)
    else:
        rules = extract_cbt_rules(text, args.url)

    logger.info(f"Cláusulas extraídas: {len(rules.clauses)}")
    for c in rules.clauses:
        logger.info(f"  [{c.clauseType}] {c.humanText[:80]}")

    result = await send_rules_to_backend(rules)
    logger.info(f"Resultado: {json.dumps(result, ensure_ascii=False)}")

    if not args.local:
        pdf_path.unlink(missing_ok=True)


if __name__ == "__main__":
    asyncio.run(main())
