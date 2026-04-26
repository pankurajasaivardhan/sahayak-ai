from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json
import os
from groq import Groq
from dotenv import load_dotenv
from datetime import datetime
from agents import orchestrator  # ← Multi-Agent System

load_dotenv()

app = FastAPI(title="SahayakAI v3 (Multi-Agent)", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load schemes database — unwrap the top-level "schemes" key
with open("schemes.json", "r", encoding="utf-8") as f:
    raw = json.load(f)
    SCHEMES_DB = raw["schemes"]  # list of scheme dicts

# In-memory application tracker (use a DB in production)
APPLICATION_TRACKER = {}

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ─────────────────────────── MODELS ───────────────────────────

class UserProfile(BaseModel):
    age: int
    state: str
    income: int
    occupation: str
    gender: str
    caste: Optional[str] = "general"
    disability: Optional[bool] = False
    bpl_card: Optional[bool] = False
    has_land: Optional[bool] = False
    family_size: Optional[int] = 4

class ChatMessage(BaseModel):
    message: str
    profile: Optional[UserProfile] = None
    conversation_history: Optional[list] = []
    language: Optional[str] = "en"

class ApplicationUpdate(BaseModel):
    user_id: str
    scheme_id: str
    status: str  # "saved" | "applied" | "pending" | "received"
    notes: Optional[str] = ""

class TranslateRequest(BaseModel):
    text: str
    target_language: str

class MultiAgentChatMessage(BaseModel):
    message: str
    profile: Optional[UserProfile] = None
    conversation_history: Optional[list] = []
    language: Optional[str] = "en"

# ─────────────────────────── LOGIC ───────────────────────────

# Categories match the lowercase values used in schemes.json
CATEGORY_PRIORITY = {
    "health": 10,
    "food": 9,
    "housing": 8,
    "employment": 7,
    "financial_inclusion": 6,
    "agriculture": 5,
    "education": 5,
    "disability": 5,
    "elderly": 4,
    "women": 4,
    "entrepreneurship": 3,
    "utilities": 2,
}


def match_schemes(profile: UserProfile):
    matched = []

    for scheme in SCHEMES_DB:
        score = 0
        reasons = []
        bonus = 0

        # ── Age filter (strict) ──────────────────────────────
        min_age = scheme.get("minAge", 0)
        max_age = scheme.get("maxAge")  # None means no upper limit
        if max_age is None:
            max_age = 150
        if not (min_age <= profile.age <= max_age):
            continue

        # ── Income ──────────────────────────────────────────
        if profile.income <= scheme.get("maxAnnualIncomeINR", 999_999_999):
            score += 2
            reasons.append("income eligible")

        # ── BPL bonus ───────────────────────────────────────
        if profile.bpl_card and scheme.get("maxAnnualIncomeINR", 999_999) <= 100_000:
            bonus += 2
            reasons.append("BPL priority")

        # ── Occupation ──────────────────────────────────────
        occ_list = scheme.get("applicableOccupations", ["any"])
        if "any" in occ_list or profile.occupation in occ_list:
            score += 2
            reasons.append("occupation match")

        # ── Gender ──────────────────────────────────────────
        gender = scheme.get("applicableGender", "all")
        if gender == "all" or profile.gender == gender:
            score += 1

        # ── Caste ───────────────────────────────────────────
        caste_list = scheme.get("applicableCastes", ["general", "obc", "sc", "st"])
        if profile.caste in caste_list:
            score += 1
            if profile.caste in ["sc", "st", "obc"]:
                bonus += 1

        # ── State (central schemes apply everywhere) ─────────
        state_list = scheme.get("applicableStates", ["central"])
        if "central" in state_list or profile.state.lower() in [s.lower() for s in state_list]:
            score += 1

        # ── Disability bonus ─────────────────────────────────
        if profile.disability and scheme.get("isDisabledRequired", False):
            bonus += 3

        # ── Land-based schemes ───────────────────────────────
        if profile.has_land and scheme.get("id") in [
            "pm_kisan", "fasal_bima", "soil_health_card",
            "karnataka_krishi_bhagya", "telangana_rythu_bandhu"
        ]:
            bonus += 1

        final_score = score + bonus

        if final_score >= 4:
            cat_priority = CATEGORY_PRIORITY.get(scheme.get("category", ""), 1)
            matched.append({
                **scheme,
                "match_score": final_score,
                "match_percent": min(100, int((final_score / 10) * 100)),
                "reasons": reasons,
                "category_priority": cat_priority,
                "application_status": "not_applied",
            })

    matched.sort(
        key=lambda x: (x["match_score"] + x["category_priority"]),
        reverse=True,
    )
    return matched


def calculate_stats(matched_schemes, profile: UserProfile):
    # Use the correct field name from schemes.json
    total = sum(s.get("annualBenefitINR", 0) for s in matched_schemes)

    by_category = {}
    for s in matched_schemes:
        cat = s.get("category", "Other")
        by_category[cat] = by_category.get(cat, 0) + s.get("annualBenefitINR", 0)

    # "Quick apply" = can be processed in 7 days or less
    quick_apply = [s for s in matched_schemes if s.get("estimatedProcessingDays", 99) <= 7]

    return {
        "total_benefit": total,
        "by_category": by_category,
        "quick_apply_count": len(quick_apply),
        "top_scheme": matched_schemes[0] if matched_schemes else None,
    }


def detect_language(text: str) -> str:
    hindi_chars = sum(1 for c in text if "\u0900" <= c <= "\u097F")
    if hindi_chars > 2:
        return "hi"
    return "en"


# ─────────────────────────── ROUTES ───────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "message": "SahayakAI v2 backend is running", "version": "2.0.0"}


@app.post("/api/match-schemes")
async def get_matched_schemes(profile: UserProfile):
    matched = match_schemes(profile)
    stats = calculate_stats(matched, profile)

    categorized = {}
    for s in matched:
        cat = s.get("category", "Other")
        if cat not in categorized:
            categorized[cat] = []
        categorized[cat].append(s)

    quick_apply = [s for s in matched if s.get("estimatedProcessingDays", 99) <= 7]

    return {
        "schemes": matched,
        "total_unclaimed_value": stats["total_benefit"],
        "count": len(matched),
        "stats": stats,
        "by_category": categorized,
        "quick_apply": quick_apply,
    }


@app.post("/api/chat")
async def chat(body: ChatMessage):
    lang = body.language or detect_language(body.message)

    lang_instruction = ""
    if lang == "hi":
        lang_instruction = (
            "\nUser is writing in Hindi. YOU MUST respond ONLY in Hindi "
            "(Devanagari script). Keep responses friendly and simple."
        )
    else:
        lang_instruction = "\nRespond in simple, clear English. Use short sentences."

    system_prompt = f"""You are SahayakAI v2, an expert welfare scheme advisor for Indian citizens.
Your mission: Help every Indian citizen access ALL government benefits they deserve.

You know about these scheme categories: Agriculture, Health, Housing, Employment,
Financial Inclusion, Education, Disability, Elderly, Women, Entrepreneurship, Food, Utilities.

Key behaviors:
- Always be warm, empathetic, and encouraging
- Give ACTIONABLE advice — exact steps, offices to visit, documents needed
- If someone mentions a problem (no money, sick family member, lost job), connect it to relevant schemes
- Mention helpline numbers when relevant
- For eligibility questions, always ask clarifying questions about income, age, state if not provided
- Never give up — if one scheme doesn't fit, suggest alternatives{lang_instruction}"""

    messages = (body.conversation_history or [])[-8:]
    messages.append({"role": "user", "content": body.message})

    if body.profile:
        matched = match_schemes(body.profile)
        scheme_names = [s["name"] for s in matched[:8]]
        total_benefit = sum(s.get("annualBenefitINR", 0) for s in matched)
        system_prompt += f"""

USER PROFILE:
  Age: {body.profile.age}
  State: {body.profile.state}
  Annual Income: ₹{body.profile.income:,}
  Occupation: {body.profile.occupation}
  Gender: {body.profile.gender}
  Category: {body.profile.caste.upper()}
  BPL Card: {"Yes" if body.profile.bpl_card else "No"}
  Disability: {"Yes" if body.profile.disability else "No"}
  Has Agricultural Land: {"Yes" if body.profile.has_land else "No"}

TOP MATCHED SCHEMES: {", ".join(scheme_names)}
TOTAL ESTIMATED BENEFIT: ₹{total_benefit:,}/year

Always refer to specific scheme details when answering questions about eligibility,
benefits, or application process."""

    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[{"role": "system", "content": system_prompt}] + messages,
            max_tokens=600,
            temperature=0.7,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        reply = "Sorry, I'm having trouble connecting. Please try again in a moment."

    return {
        "reply": reply,
        "detected_language": lang,
    }


@app.post("/api/track-application")
async def track_application(update: ApplicationUpdate):
    if update.user_id not in APPLICATION_TRACKER:
        APPLICATION_TRACKER[update.user_id] = {}

    APPLICATION_TRACKER[update.user_id][update.scheme_id] = {
        "status": update.status,
        "notes": update.notes,
        "updated_at": datetime.now().isoformat(),
    }
    return {"success": True, "tracked": APPLICATION_TRACKER[update.user_id]}


@app.get("/api/get-applications/{user_id}")
async def get_applications(user_id: str):
    return APPLICATION_TRACKER.get(user_id, {})


@app.get("/api/scheme/{scheme_id}")
async def get_scheme_details(scheme_id: str):
    for scheme in SCHEMES_DB:
        if scheme["id"] == scheme_id:
            return scheme
    raise HTTPException(status_code=404, detail="Scheme not found")


@app.get("/api/schemes/category/{category}")
async def get_by_category(category: str):
    return [s for s in SCHEMES_DB if s.get("category", "").lower() == category.lower()]


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "schemes_loaded": len(SCHEMES_DB),
    }


@app.get("/api/stats")
async def global_stats():
    categories = {}
    for s in SCHEMES_DB:
        cat = s.get("category", "Other")
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "total_schemes": len(SCHEMES_DB),
        "categories": categories,
        "max_possible_benefit": sum(s.get("annualBenefitINR", 0) for s in SCHEMES_DB),
    }

# ─────────────────── MULTI-AGENT ENDPOINT ────────────────────

@app.post("/api/agent-chat")
async def agent_chat(body: MultiAgentChatMessage):
    """
    Multi-Agent chat endpoint.
    The OrchestratorAgent routes the query to specialist agents
    (Eligibility, Document, Application, Benefit, Grievance)
    and returns their merged response.
    """
    lang = body.language or detect_language(body.message)

    profile_dict = None
    matched_schemes = None

    if body.profile:
        profile_dict = body.profile.model_dump()
        matched_schemes = match_schemes(body.profile)

    result = await orchestrator.run_multi_agent(
        user_message=body.message,
        profile=profile_dict,
        matched_schemes=matched_schemes,
        language=lang,
    )

    return {
        "reply": result["reply"],
        "agents_used": result["agents_used"],
        "agent_outputs": result["agent_outputs"],
        "detected_language": lang,
        "mode": "multi_agent",
    }


@app.get("/api/agents/info")
async def agents_info():
    """Returns info about available agents."""
    return {
        "agents": [
            {
                "name": "OrchestratorAgent",
                "role": "Routes queries to specialist agents and merges results",
                "emoji": "🧠",
            },
            {
                "name": "EligibilityAgent",
                "role": "Deep eligibility analysis for government schemes",
                "emoji": "✅",
                "triggers": ["am I eligible", "do I qualify", "who can get"],
            },
            {
                "name": "DocumentAgent",
                "role": "Exact document checklists for applications",
                "emoji": "📄",
                "triggers": ["documents needed", "papers required", "certificate"],
            },
            {
                "name": "ApplicationAgent",
                "role": "Step-by-step application guidance with portals & offices",
                "emoji": "📝",
                "triggers": ["how to apply", "application process", "steps", "form"],
            },
            {
                "name": "BenefitAgent",
                "role": "Calculates and maximizes total welfare benefits",
                "emoji": "💰",
                "triggers": ["how much money", "benefit amount", "maximize"],
            },
            {
                "name": "GrievanceAgent",
                "role": "Complaint filing, delay resolution, RTI guidance",
                "emoji": "📢",
                "triggers": ["complaint", "rejected", "delayed", "not received", "RTI"],
            },
        ],
        "version": "3.0.0",
    }
