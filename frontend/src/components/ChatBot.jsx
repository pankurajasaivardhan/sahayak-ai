import { useState, useRef, useEffect } from 'react'
import './ChatBot.css'

const API = 'http://localhost:8000'

const QUICK_EN = [
  "Which scheme gives the most money?",
  "How do I apply for Ayushman Bharat?",
  "What documents do I need?",
  "Which scheme is easiest to apply?",
  "Am I eligible for MGNREGA?",
]
const QUICK_HI = [
  "मुझे सबसे ज़्यादा पैसे कौन सी योजना देगी?",
  "आयुष्मान भारत के लिए कैसे आवेदन करें?",
  "मुझे कौन-से दस्तावेज़ चाहिए?",
  "सबसे आसान कौन सी योजना है?",
  "क्या मैं MGNREGA के लिए योग्य हूं?",
]

function Message({ msg, onSpeak }) {
  return (
    <div className={`message ${msg.role}`}>
      {msg.role === 'assistant' && <div className="bot-avatar">🤖</div>}
      <div className="message-bubble">
        {msg.content.split('\n').map((line, i) => (
          line ? <p key={i}>{line}</p> : <br key={i} />
        ))}
        {msg.role === 'assistant' && (
          <button className="speak-btn" onClick={() => onSpeak(msg.content)} title="Read aloud">🔊</button>
        )}
      </div>
      {msg.role === 'user' && <div className="user-avatar">👤</div>}
    </div>
  )
}

export default function ChatBot({ profile, results, language, setLanguage }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: language === 'hi'
      ? `नमस्ते! 🙏 मैं आपका SahayakAI सलाहकार हूं।\n\nआप ${results?.count || 0} योजनाओं के लिए योग्य हैं जिनकी कुल कीमत ₹${(results?.total_unclaimed_value || 0).toLocaleString('en-IN')} प्रति वर्ष है!\n\nकोई भी सवाल पूछें — हिंदी या English में।`
      : `Namaste! 🙏 I'm your SahayakAI advisor.\n\nYou qualify for ${results?.count || 0} schemes worth up to ₹${(results?.total_unclaimed_value || 0).toLocaleString('en-IN')}/year!\n\nAsk me anything in English or Hindi. I'll help you apply for every scheme you deserve.`
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setLoading(true)

    const history = newMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          profile,
          conversation_history: history.slice(0, -1),
          language
        })
      })
      const data = await res.json()
      if (data.detected_language && data.detected_language !== language) {
        setLanguage(data.detected_language)
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'hi'
          ? 'माफ़ करें, सर्वर से कनेक्ट नहीं हो पा रहा। कृपया बाद में प्रयास करें।'
          : 'Sorry, could not connect to the server. Make sure the backend is running!'
      }])
    }
    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice not supported. Use Chrome browser.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
    rec.continuous = false
    rec.interimResults = true
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
      setInput(transcript)
      if (e.results[e.results.length - 1].isFinal) {
        sendMessage(transcript)
        setInput('')
      }
    }
    recognitionRef.current = rec
    rec.start()
  }

  const speak = (text) => {
    if (synthRef.current.speaking) {
      synthRef.current.cancel()
      setSpeaking(false)
      return
    }
    const clean = text.replace(/[#*_~`]/g, '').replace(/\n/g, ' ')
    const utt = new SpeechSynthesisUtterance(clean)
    utt.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
    utt.rate = 0.9
    utt.onstart = () => setSpeaking(true)
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    synthRef.current.speak(utt)
  }

  const quickQuestions = language === 'hi' ? QUICK_HI : QUICK_EN

  return (
    <div className="chatbot-page fade-up">
      <div className="chat-header card">
        <div className="chat-title">
          <div className="chat-avatar">🤖</div>
          <div>
            <div className="chat-name">SahayakAI Advisor</div>
            <div className="chat-status">● Online · English & Hindi</div>
          </div>
        </div>
        <div className="chat-meta">
          {results && <span className="badge badge-green">{results.count} schemes matched</span>}
          {speaking && <span className="badge badge-blue">🔊 Speaking...</span>}
        </div>
      </div>

      <div className="chat-window card">
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} onSpeak={speak} />
        ))}
        {loading && (
          <div className="message assistant">
            <div className="bot-avatar">🤖</div>
            <div className="message-bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="quick-chips">
        {quickQuestions.map((q, i) => (
          <button key={i} className="chip" onClick={() => sendMessage(q)} disabled={loading}>{q}</button>
        ))}
      </div>

      <div className="chat-input-bar card">
        <button
          className={`voice-input-btn ${listening ? 'active' : ''}`}
          onClick={startVoice}
          title={listening ? 'Stop listening' : 'Voice input'}
        >
          {listening ? '🔴' : '🎙️'}
        </button>
        <textarea
          className="chat-textarea"
          placeholder={language === 'hi' ? 'हिंदी या English में पूछें... (Enter = भेजें)' : 'Ask in English or Hindi... (Enter to send)'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
