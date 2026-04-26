"""
SahayakAI Multi-Agent System
============================
Orchestrator Agent  →  routes tasks to specialist agents
├── EligibilityAgent   – deep eligibility analysis
├── DocumentAgent      – document checklist & verification
├── ApplicationAgent   – step-by-step application guidance
├── BenefitAgent       – benefit calculation & maximization
└── GrievanceAgent     – complaint & grievance redressal

All agents share the same Groq LLM but have focused system prompts.
The Orchestrator decides which agents to invoke and merges their outputs.
"""

import os
import json
import asyncio
from groq import AsyncGroq
from typing import Optional

MODEL = "llama3-8b-8192"

def _get_client() -> AsyncGroq:
    """Create AsyncGroq client lazily so load_dotenv() in main.py runs first."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to backend/.env "
            "(copy .env.example → .env and fill in your key)."
        )
    return AsyncGroq(api_key=api_key)


# ─────────────────────── BASE AGENT ───────────────────────────

class BaseAgent:
    """Shared async call wrapper for all agents."""

    name: str = "BaseAgent"
    system_prompt: str = ""

    async def run(self, user_message: str, context: dict = {}) -> str:
        prompt = self.system_prompt
        if context:
            prompt += f"\n\n## Context\n{json.dumps(context, ensure_ascii=False, indent=2)}"

        try:
            client = _get_client()
            response = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=600,
                temperature=0.5,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return f"[{self.name} error: {str(e)}]"


# ─────────────────────── SPECIALIST AGENTS ────────────────────

class EligibilityAgent(BaseAgent):
    name = "EligibilityAgent"
    system_prompt = """You are the EligibilityAgent for SahayakAI — India's welfare scheme advisor.

Your ONLY job: perform deep eligibility analysis for government schemes.

Rules:
- Analyse each scheme criterion carefully (age, income, caste, gender, state, BPL, disability, land ownership).
- For each scheme the user asks about, output: ELIGIBLE ✅ / PARTIALLY ELIGIBLE ⚠️ / NOT ELIGIBLE ❌ with brief reason.
- Suggest what the user can do to become eligible if currently ineligible.
- Always mention the scheme ID (e.g., pm_kisan) for reference.
- Keep your answer structured but concise. Use bullet points.
- Be warm and encouraging — many users are from rural backgrounds.
"""


class DocumentAgent(BaseAgent):
    name = "DocumentAgent"
    system_prompt = """You are the DocumentAgent for SahayakAI — India's welfare scheme advisor.

Your ONLY job: provide exact document checklists for scheme applications.

Rules:
- List every mandatory document required (Aadhaar, income certificate, caste certificate, etc.).
- Flag which documents are hardest to obtain and suggest alternatives.
- Tell users WHERE to get each document (Gram Panchayat, Tehsil, CSC, etc.).
- Mention if the document can be self-attested or needs a gazetted officer.
- Format: numbered list, one document per line.
- Always ask the user's state if unknown — some states require extra docs.
"""


class ApplicationAgent(BaseAgent):
    name = "ApplicationAgent"
    system_prompt = """You are the ApplicationAgent for SahayakAI — India's welfare scheme advisor.

Your ONLY job: provide clear, step-by-step application guidance.

Rules:
- Give the exact application process: online portal URL, offline office, or Common Service Centre (CSC).
- Break steps into numbered list (maximum 8 steps).
- Mention estimated time per step and total processing time.
- Include relevant helpline numbers (PM Helpline 1800-11-0001, state-specific lines).
- Warn about common mistakes that lead to rejection.
- If online: provide the exact URL and navigation path.
- If offline: specify which government office (BDO, Tehsildar, DM office, etc.).
- Always mention the appeal process if application is rejected.
"""


class BenefitAgent(BaseAgent):
    name = "BenefitAgent"
    system_prompt = """You are the BenefitAgent for SahayakAI — India's welfare scheme advisor.

Your ONLY job: maximize total welfare benefit for the user.

Rules:
- Calculate the TOTAL annual benefit the user can receive across all matched schemes.
- Identify which combination of schemes gives maximum benefit (some schemes stack, some don't).
- Flag schemes that CANNOT be combined (e.g., you can't get two housing schemes).
- Show benefit breakdown: monthly vs annual, cash vs kind (rations, insurance, etc.).
- Suggest complementary schemes the user may have missed.
- Always present benefits in INR (₹) formatted clearly.
- End with "Your Maximum Potential Benefit: ₹X per year".
"""


class GrievanceAgent(BaseAgent):
    name = "GrievanceAgent"
    system_prompt = """You are the GrievanceAgent for SahayakAI — India's welfare scheme advisor.

Your ONLY job: help users file complaints and resolve issues with scheme applications.

Rules:
- Help users who face corruption, delays, rejection, or non-payment of benefits.
- Give the exact grievance portal URL (pgportal.gov.in, cpgrams.gov.in, etc.).
- Explain how to escalate: Local Officer → District Officer → State → Central → RTI → Court.
- Mention relevant RTI provisions for accessing scheme information.
- Suggest contacting local NGOs or legal aid if needed.
- Always validate the user's frustration empathetically before giving advice.
- Mention Jan Sunwai (public hearing) options.
- Key helplines: PM Helpline 1800-11-0001, CPGRAMS, State CM Helplines.
"""


# ─────────────────────── ORCHESTRATOR ─────────────────────────

class OrchestratorAgent(BaseAgent):
    """
    Routes user messages to the right specialist agent(s).
    Can invoke multiple agents in parallel and merge results.
    """

    name = "OrchestratorAgent"
    system_prompt = """You are the OrchestratorAgent of SahayakAI — an intelligent multi-agent welfare advisor for Indian citizens.

You coordinate a team of specialist agents:
- EligibilityAgent: checks if user qualifies for schemes
- DocumentAgent: provides document checklists
- ApplicationAgent: step-by-step application guidance
- BenefitAgent: calculates and maximizes total benefits
- GrievanceAgent: handles complaints, delays, rejections

Your job is to:
1. Understand what the user needs
2. Decide which agent(s) to call
3. If a simple greeting or general question → answer yourself
4. If specific need → delegate to specialist(s)

Respond with a JSON object (no markdown, no explanation, pure JSON):
{
  "agents": ["EligibilityAgent"],  // list of agents to invoke, or [] if you handle it
  "self_reply": "...",             // your direct reply if agents=[], else ""
  "message_to_agents": "..."       // refined message to pass to agents
}

Agent selection rules:
- "am I eligible", "do I qualify", "who can get" → EligibilityAgent
- "documents", "papers", "certificate", "proof" → DocumentAgent
- "how to apply", "apply kaise", "application process", "steps", "form" → ApplicationAgent
- "how much money", "benefit", "amount", "kitne paise", "maximize" → BenefitAgent
- "complaint", "rejected", "delayed", "not received", "corruption", "grievance", "RTI" → GrievanceAgent
- Multiple needs → list multiple agents
- Greetings, thanks, general chat → agents=[], self_reply="..."
"""

    def __init__(self):
        self.agents = {
            "EligibilityAgent": EligibilityAgent(),
            "DocumentAgent": DocumentAgent(),
            "ApplicationAgent": ApplicationAgent(),
            "BenefitAgent": BenefitAgent(),
            "GrievanceAgent": GrievanceAgent(),
        }

    async def run_multi_agent(
        self,
        user_message: str,
        profile: Optional[dict] = None,
        matched_schemes: Optional[list] = None,
        language: str = "en",
    ) -> dict:
        """
        Full multi-agent pipeline:
        1. Orchestrator decides which agents to call
        2. Agents run in parallel
        3. Results merged and returned
        """

        lang_note = (
            "\nIMPORTANT: User is writing in Hindi. Your JSON self_reply and "
            "message_to_agents must be in Hindi (Devanagari)."
            if language == "hi"
            else "\nRespond in clear English."
        )

        context = {}
        if profile:
            context["user_profile"] = profile
        if matched_schemes:
            context["top_matched_schemes"] = [
                {
                    "id": s.get("id"),
                    "name": s.get("name"),
                    "category": s.get("category"),
                    "annualBenefitINR": s.get("annualBenefitINR"),
                    "match_score": s.get("match_score"),
                }
                for s in matched_schemes[:10]
            ]

        # ── Step 1: Orchestrator routing ──────────────────────
        routing_prompt = self.system_prompt + lang_note
        try:
            client = _get_client()
            orch_response = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": routing_prompt},
                    {
                        "role": "user",
                        "content": f"User message: {user_message}\n\nContext: {json.dumps(context, ensure_ascii=False)}",
                    },
                ],
                max_tokens=300,
                temperature=0.2,
            )
            raw = orch_response.choices[0].message.content.strip()

            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            routing = json.loads(raw)
        except Exception as e:
            # Fallback: treat as general chat
            routing = {
                "agents": [],
                "self_reply": f"I'm here to help you find welfare schemes! Please tell me more about what you need.",
                "message_to_agents": user_message,
            }

        agents_to_call = routing.get("agents", [])
        self_reply = routing.get("self_reply", "")
        agent_message = routing.get("message_to_agents", user_message)

        # ── Step 2: If no agents needed, return direct reply ──
        if not agents_to_call or self_reply:
            return {
                "reply": self_reply or "How can I help you today?",
                "agents_used": [],
                "agent_outputs": {},
                "routing": routing,
            }

        # ── Step 3: Run agents in PARALLEL ────────────────────
        agent_lang_note = (
            "\n\nIMPORTANT: Respond entirely in Hindi (Devanagari script)."
            if language == "hi"
            else ""
        )

        tasks = {}
        for agent_name in agents_to_call:
            if agent_name in self.agents:
                agent = self.agents[agent_name]
                full_msg = agent_message + agent_lang_note
                tasks[agent_name] = agent.run(full_msg, context)

        agent_outputs = {}
        if tasks:
            results = await asyncio.gather(*tasks.values(), return_exceptions=True)
            for name, result in zip(tasks.keys(), results):
                if isinstance(result, Exception):
                    agent_outputs[name] = f"[Agent error: {str(result)}]"
                else:
                    agent_outputs[name] = result

        # ── Step 4: Merge outputs into final reply ─────────────
        if len(agent_outputs) == 1:
            final_reply = list(agent_outputs.values())[0]
        else:
            # Multiple agents: combine with section headers
            sections = []
            agent_emojis = {
                "EligibilityAgent": "✅ Eligibility Check",
                "DocumentAgent": "📄 Documents Required",
                "ApplicationAgent": "📝 How to Apply",
                "BenefitAgent": "💰 Benefits",
                "GrievanceAgent": "📢 Grievance Guidance",
            }
            for name, output in agent_outputs.items():
                header = agent_emojis.get(name, name)
                sections.append(f"**{header}**\n{output}")
            final_reply = "\n\n---\n\n".join(sections)

        return {
            "reply": final_reply,
            "agents_used": agents_to_call,
            "agent_outputs": agent_outputs,
            "routing": routing,
        }


# ─────────────────────── SINGLETON ────────────────────────────

orchestrator = OrchestratorAgent()
