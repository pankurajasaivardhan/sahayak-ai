# SahayakAI v3 🇮🇳 — Multi-Agent Welfare Advisor

**Find every Indian government welfare scheme you qualify for — powered by a Multi-Agent AI system.**

---

## What's New in v3: Multi-Agent System

SahayakAI v3 introduces a full **multi-agent orchestration layer** built on Groq fast LLMs.

### Agent Architecture

```
User Query
    ↓
OrchestratorAgent  ← decides which agents to call
    ├── EligibilityAgent   → Am I eligible?
    ├── DocumentAgent      → What documents do I need?
    ├── ApplicationAgent   → How do I apply?
    ├── BenefitAgent       → How much money can I get?
    └── GrievanceAgent     → My application was rejected. Help!
```

| Agent | Trigger keywords | Job |
|---|---|---|
| 🧠 OrchestratorAgent | (all queries) | Routes to the right specialist(s) |
| ✅ EligibilityAgent | "eligible", "qualify", "who can get" | Deep eligibility analysis |
| 📄 DocumentAgent | "documents", "papers", "certificate" | Exact document checklists |
| 📝 ApplicationAgent | "how to apply", "steps", "form", "portal" | Step-by-step application guide |
| 💰 BenefitAgent | "how much", "benefit", "maximize", "total" | Benefit calculation & stacking |
| 📢 GrievanceAgent | "complaint", "rejected", "delayed", "RTI" | Complaint & grievance redressal |

**Key feature:** Multiple agents run **in parallel** when a query needs more than one specialist.

---

## Project Structure

```
sahayak-ai/
├── backend/
│   ├── main.py           # FastAPI server (v3)
│   ├── agents.py         # NEW: Multi-Agent System
│   ├── schemes.json      # Government schemes database
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    └── src/
        ├── App.jsx
        └── components/
            ├── MultiAgentChat.jsx   NEW
            ├── MultiAgentChat.css   NEW
            ├── Header.jsx           Updated
            ├── SchemeResults.jsx    Updated
            └── ... (existing files)
```

---

## Setup

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env → GROQ_API_KEY=your_key_here
uvicorn main:app --reload
# Runs at http://localhost:8000
```

Get a FREE Groq API key: https://console.groq.com

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs at http://localhost:5173
```

---

## New API Endpoints

| Endpoint | Description |
|---|---|
| POST `/api/agent-chat` | Multi-agent chat — orchestrator routes to specialist(s) |
| GET `/api/agents/info` | List all agents and their triggers |

---

## How to Use Multi-Agent Chat

1. Fill profile → click Find My Schemes
2. Click **🧠 Multi-Agent Advisor** button
3. Ask anything — it routes automatically
4. Watch the **Agent Status Bar** show which agents are working

Example multi-agent queries:
- "Am I eligible for PM-KISAN and what documents do I need?" → EligibilityAgent + DocumentAgent
- "How to apply for Ayushman Bharat and what's the benefit?" → ApplicationAgent + BenefitAgent
