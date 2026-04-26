import { useState, useRef, useEffect } from 'react'
import './MultiAgentChat.css'

const API = 'http://localhost:8000'

const AGENTS = [
  { name: 'EligibilityAgent', emoji: '✅', label: 'Eligibility' },
  { name: 'DocumentAgent',    emoji: '📄', label: 'Documents' },
  { name: 'ApplicationAgent', emoji: '📝', label: 'Apply' },
  { name: 'BenefitAgent',     emoji: '💰', label: 'Benefits' },
  { name: 'GrievanceAgent',   emoji: '📢', label: 'Grievance' },
]

const QUICK_EN = [
  '✅ Am I eligible for PM-KISAN?',
  '📄 What documents do I need for Ayushman Bharat?',
  '📝 How do I apply for MGNREGA?',
  '💰 What is my maximum total benefit?',
  '📢 My application was rejected. What do I do?',
]

const QUICK_HI = [
  '✅ क्या मैं PM-KISAN के लिए पात्र हूं?',
  '📄 आयुष्मान भारत के लिए क्या दस्तावेज़ चाहिए?',
  '📝 MGNREGA के लिए कैसे आवेदन करें?',
  '💰 मुझे कुल कितना लाभ मिल सकता है?',
  '📢 मेरा आवेदन अस्वीकार हो गया, अब क्या करूं?',
]

function AgentStatusBar({ activeAgents, doneAgents }) {
  return (
    <div className="agent-bar">
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>🧠 Agents:</span>
      {AGENTS.map(a => {
        const isActive = activeAgents.includes(a.name)
        const isDone   = doneAgents.includes(a.name)
        return (
          <span
            key={a.name}
            className={`agent-pill ${isActive ? 'active' : isDone ? 'done' : 'idle'}`}
            title={a.name}
          >
            {a.emoji} {a.label}
          </span>
        )
      })}
    </div>
  )
}

function AgentMessage({ msg, onSpeak }) {
  return (
    <div className={`agent-message ${msg.role}`}>
      {msg.role === 'assistant' && <div className="agent-avatar">🧠</div>}
      <div>
        <div className="agent-bubble">
          {msg.content.split('\n').map((line, i) =>
            line ? <p key={i}>{line}</p> : <br key={i} />
          )}
          {msg.role === 'assistant' && msg.agentsUsed?.length > 0 && (
            <div className="agents-tag">
              {msg.agentsUsed.map(a => {
                const found = AGENTS.find(x => x.name === a)
                return (
                  <span key={a}>{found?.emoji} {found?.label || a}</span>
                )
              })}
            </div>
          )}
          {msg.role === 'assistant' && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.25rem' }}
              onClick={() => onSpeak(msg.content)}
              title="Read aloud"
            >🔊</button>
          )}
        </div>
      </div>
      {msg.role === 'user' && <div className="agent-avatar">👤</div>}
    </div>
  )
}

export default function MultiAgentChat({ profile, results, language, setLanguage }) {
  const initMsg = language === 'hi'
    ? `नमस्ते! 🙏 मैं SahayakAI का **Multi-Agent Advisor** हूं।\n\nमेरे पास 5 विशेषज्ञ Agent हैं:\n✅ पात्रता जांच  📄 दस्तावेज़  📝 आवेदन प्रक्रिया  💰 लाभ  📢 शिकायत\n\nआप ${results?.count || 0} योजनाओं के योग्य हैं। क्या जानना चाहते हैं?`
    : `Namaste! 🙏 I'm your **Multi-Agent Advisor**.\n\nI coordinate 5 specialist agents:\n✅ Eligibility  📄 Documents  📝 Application  💰 Benefits  📢 Grievance\n\nYou qualify for ${results?.count || 0} schemes worth ₹${(results?.total_unclaimed_value || 0).toLocaleString('en-IN')}/year. How can I help?`

  const [messages, setMessages] = useState([{ role: 'assistant', content: initMsg, agentsUsed: [] }])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [activeAgents, setActiveAgents] = useState([])
  const [doneAgents, setDoneAgents]     = useState([])
  const bottomRef = useRef(null)
  const synthRef  = useRef(window.speechSynthesis)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')
    setDoneAgents([])

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    // Simulate "thinking" with all agents active
    setActiveAgents(AGENTS.map(a => a.name))

    try {
      const res = await fetch(`${API}/api/agent-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          profile,
          language,
          conversation_history: newMessages.slice(-8).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await res.json()

      if (data.detected_language && data.detected_language !== language) {
        setLanguage(data.detected_language)
      }

      setActiveAgents([])
      setDoneAgents(data.agents_used || [])

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          agentsUsed: data.agents_used || [],
        },
      ])
    } catch {
      setActiveAgents([])
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: language === 'hi'
            ? 'माफ़ करें, सर्वर से कनेक्ट नहीं हो पाया। कृपया बाद में प्रयास करें।'
            : 'Sorry, could not reach the server. Make sure the backend is running!',
          agentsUsed: [],
        },
      ])
    }

    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const speak = (text) => {
    if (synthRef.current.speaking) { synthRef.current.cancel(); return }
    const clean = text.replace(/[#*_~`]/g, '').replace(/\n/g, ' ')
    const utt = new SpeechSynthesisUtterance(clean)
    utt.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
    utt.rate = 0.9
    synthRef.current.speak(utt)
  }

  const quickList = language === 'hi' ? QUICK_HI : QUICK_EN

  return (
    <div className="agent-chat-page fade-up">
      {/* Header */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>🧠 Multi-Agent Advisor</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Orchestrator routes your query to specialist agents automatically
            </div>
          </div>
          {results && (
            <span className="badge badge-green">{results.count} schemes matched</span>
          )}
        </div>
      </div>

      {/* Agent status bar */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <AgentStatusBar activeAgents={activeAgents} doneAgents={doneAgents} />
      </div>

      {/* Chat window */}
      <div className="agent-chat-window card">
        {messages.map((msg, i) => (
          <AgentMessage key={i} msg={msg} onSpeak={speak} />
        ))}
        {loading && (
          <div className="agent-message assistant">
            <div className="agent-avatar">🧠</div>
            <div className="agent-bubble typing">
              <span /><span /><span />
              <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Agents working…
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      <div className="agent-chips">
        {quickList.map((q, i) => (
          <button key={i} className="agent-chip" onClick={() => sendMessage(q)} disabled={loading}>
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="agent-input-bar card">
        <textarea
          className="agent-textarea"
          placeholder={language === 'hi'
            ? 'पात्रता, दस्तावेज़, आवेदन, लाभ या शिकायत के बारे में पूछें…'
            : 'Ask about eligibility, documents, application, benefits, or grievance…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          disabled={loading}
        />
        <button
          className="agent-send-btn"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >➤</button>
      </div>
    </div>
  )
}
