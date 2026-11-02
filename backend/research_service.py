from __future__ import annotations

import re
import logging
from typing import Literal

import httpx

from backend.config import settings
from backend.financial_extraction import extract_financial_data
from backend.risk_engine import analyze_financial_risk
from backend.schemas import (
    EvidenceCitation,
    FinancialMetric,
    ResearchQuestionResponse,
)

logger = logging.getLogger(__name__)

STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
    "by", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
    "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
    "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
    "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "s", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
    "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
    "why", "will", "with", "would", "you", "your", "yours", "yourself", "yourselves", "tell",
    "find", "show", "give", "much", "many"
}

METRIC_QUERY_MAP = {
    "revenue": ("revenue", "sales", "turnover", "top line"),
    "net_income": ("net income", "net profit", "bottom line", "profit after tax", "net loss"),
    "operating_profit": ("operating profit", "operating income", "ebit", "operating margin"),
    "total_assets": ("total assets", "assets"),
    "total_liabilities": ("total liabilities", "liabilities"),
    "total_debt": ("total debt", "debt", "borrowings", "leverage", "loans"),
    "cash_and_cash_equivalents": ("cash and cash equivalents", "cash balance", "liquidity", "cash"),
    "operating_cash_flow": ("operating cash flow", "cash flow from operations", "ocf"),
    "earnings_per_share": ("earnings per share", "eps"),
}


def _tokenize(text: str) -> list[str]:
    return [
        word for word in re.findall(r"\b[a-zA-Z0-9_\-]+\b", text.lower())
        if len(word) > 2 and word not in STOPWORDS
    ]


def _format_metric_value(metric: FinancialMetric) -> str:
    curr = f"{metric.currency} " if metric.currency else ""
    unit = f" {metric.unit}" if metric.unit else ""
    return f"{curr}{metric.value:,.2f}{unit}".strip()


def _call_gemini_api(
    question: str,
    context_text: str,
    metrics: list[FinancialMetric],
) -> str | None:
    api_key = settings.gemini_api_key
    if not api_key:
        return None

    model = settings.gemini_model or "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    metrics_summary = "\n".join(
        [
            f"- {m.metric_name}: {_format_metric_value(m)} ({m.reporting_period or 'N/A'}) [Context: {m.source_context}]"
            for m in metrics
        ]
    )

    system_prompt = (
        "You are FinSight AI, an evidence-based financial research assistant. "
        "Answer the user's question using ONLY the provided verified document disclosures and extracted metrics below.\n"
        "Strict rules:\n"
        "1. Never fabricate or speculate on numbers not in the text.\n"
        "2. If the document does not contain enough evidence, clearly state that there is insufficient disclosure.\n"
        "3. Provide clear, professional, evidence-backed answers referencing the exact figures.\n"
        "4. Keep the answer concise (2-4 paragraphs max)."
    )

    user_content = (
        f"DOCUMENT DISCLOSURES:\n{context_text[:6000]}\n\n"
        f"EXTRACTED METRICS:\n{metrics_summary or 'None extracted'}\n\n"
        f"USER QUESTION: {question}"
    )

    payload = {
        "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_content}"}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 800,
        },
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"].strip()
            else:
                logger.warning("Gemini API call returned status %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("Gemini API call failed (%s); falling back to offline analysis.", exc)
        return None

    return None


def answer_financial_question(
    document_id: str,
    extracted_text: str,
    question: str,
) -> ResearchQuestionResponse:
    cleaned_question = question.strip()
    if not cleaned_question:
        return ResearchQuestionResponse(
            document_id=document_id,
            question=question,
            answer="Please provide a valid financial question.",
            status="not_found",
            analysis_mode="deterministic_offline",
            relevant_metrics=[],
            citations=[],
            limitations=["Empty query submitted."],
        )

    question_lower = cleaned_question.lower()
    q_tokens = _tokenize(question_lower)

    # 1. Extract known metrics and risk indicators from the document
    financial_data = extract_financial_data(document_id, extracted_text)
    metrics_by_name = {m.metric_name: m for m in financial_data.metrics}

    # 2. Check for metric-specific inquiry
    matched_metrics: list[FinancialMetric] = []
    for metric_name, aliases in METRIC_QUERY_MAP.items():
        if any(alias in question_lower for alias in aliases):
            if metric_name in metrics_by_name:
                matched_metrics.append(metrics_by_name[metric_name])

    # 3. Check for risk / health inquiries
    risk_query = any(k in question_lower for k in ("risk", "red flag", "concern", "threat", "weakness", "warning"))
    risk_summary = ""
    if risk_query:
        risk_analysis = analyze_financial_risk(financial_data)
        if risk_analysis.observations:
            obs_lines = [f"- {obs.title}: {obs.explanation}" for obs in risk_analysis.observations]
            risk_summary = "\nPotential financial risks identified:\n" + "\n".join(obs_lines)
        else:
            risk_summary = "\nNo deterministic financial risk rules were triggered for this document."

    # 4. Search and score text paragraphs for grounded citations
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\n(?=[A-Z0-9\s]{3,}:)", extracted_text) if len(p.strip()) > 20]
    scored_paragraphs: list[tuple[float, str, str | None]] = []

    for para in paragraphs:
        para_lower = para.lower()
        score = 0.0
        matched_term: str | None = None

        # Check keyword matches
        matched_tokens = sum(1 for token in q_tokens if token in para_lower)
        if q_tokens:
            score += (matched_tokens / len(q_tokens)) * 0.6

        # Check phrase matches
        for metric_name, aliases in METRIC_QUERY_MAP.items():
            for alias in aliases:
                if alias in question_lower and alias in para_lower:
                    score += 0.4
                    matched_term = alias
                    break

        # Boost paragraphs with numbers/currency
        if re.search(r"(\$|€|£|USD|EUR|\d+[\.,]\d+)", para):
            score += 0.1

        if score > 0.2:
            scored_paragraphs.append((min(round(score, 2), 1.0), para, matched_term))

    scored_paragraphs.sort(key=lambda x: x[0], reverse=True)
    top_citations = [
        EvidenceCitation(excerpt=p[:300] + ("..." if len(p) > 300 else ""), relevance_score=s, matched_term=term)
        for s, p, term in scored_paragraphs[:3]
    ]

    # 5. Hybrid: Try Gemini AI if API key is configured
    relevant_context = "\n\n".join([p for _, p, _ in scored_paragraphs[:5]]) or extracted_text[:4000]
    gemini_answer = _call_gemini_api(cleaned_question, relevant_context, matched_metrics or list(metrics_by_name.values())[:5])
    if gemini_answer:
        return ResearchQuestionResponse(
            document_id=document_id,
            question=cleaned_question,
            answer=gemini_answer,
            status="answered",
            analysis_mode="gemini_ai",
            relevant_metrics=matched_metrics,
            citations=top_citations,
            limitations=[
                "Answer synthesized using Gemini AI grounded strictly in document disclosures.",
                "Review source citations to independently verify specific figures.",
            ],
        )

    # 6. Fallback: Deterministic Offline Analysis (Runs when no Gemini key is set or offline)
    if matched_metrics:
        metric_bullets = [
            f"- {m.metric_name.replace('_', ' ').title()}: {_format_metric_value(m)}"
            f"{f' ({m.reporting_period})' if m.reporting_period else ''} [Source: \"{m.source_context}\"]"
            for m in matched_metrics
        ]
        answer_text = (
            f"Based on the verified financial disclosures in the document, the following metrics were identified:\n"
            + "\n".join(metric_bullets)
        )
        if risk_summary:
            answer_text += "\n" + risk_summary

        return ResearchQuestionResponse(
            document_id=document_id,
            question=cleaned_question,
            answer=answer_text,
            status="answered",
            analysis_mode="deterministic_offline",
            relevant_metrics=matched_metrics,
            citations=top_citations,
            limitations=[
                "Offline mode: Analyzed using deterministic rules without external LLM.",
                "Figures are extracted deterministically from disclosed text context.",
            ],
        )

    if top_citations:
        best_excerpt = top_citations[0].excerpt
        answer_text = (
            f"Regarding \"{cleaned_question}\", the document states:\n\n"
            f"> \"{best_excerpt}\"\n"
        )
        if risk_summary:
            answer_text += "\n" + risk_summary

        return ResearchQuestionResponse(
            document_id=document_id,
            question=cleaned_question,
            answer=answer_text,
            status="answered",
            analysis_mode="deterministic_offline",
            relevant_metrics=[],
            citations=top_citations,
            limitations=[
                "Offline mode: Evidence retrieved based on lexical and contextual relevance without external LLM.",
            ],
        )

    # If no evidence found
    return ResearchQuestionResponse(
        document_id=document_id,
        question=cleaned_question,
        answer=(
            f"The uploaded document does not provide sufficient disclosures to answer your question regarding "
            f"\"{cleaned_question}\". No matching financial figures or relevant text excerpts were identified."
        ),
        status="insufficient_evidence",
        analysis_mode="deterministic_offline",
        relevant_metrics=[],
        citations=[],
        limitations=[
            "FinSight AI does not speculate or hallucinate undisclosed financial data.",
            "Verify whether the question pertains to a metric or section covered in this report.",
        ],
    )
