import { useState, useEffect } from 'react'
import Header from './components/Header.jsx'
import ProfileForm from './components/ProfileForm.jsx'
import SchemeResults from './components/SchemeResults.jsx'
import ChatBot from './components/ChatBot.jsx'
import Dashboard from './components/Dashboard.jsx'
import MultiAgentChat from './components/MultiAgentChat.jsx'

const API = 'http://localhost:8000'

function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9)
}

export default function App() {
  const [step, setStep] = useState('profile')
  const [profile, setProfile] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [userId] = useState(() => {
    const stored = localStorage.getItem('sahayak_user_id')
    if (stored) return stored
    const id = generateUserId()
    localStorage.setItem('sahayak_user_id', id)
    return id
  })
  const [applications, setApplications] = useState({})
  const [language, setLanguage] = useState('en')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    fetch(`${API}/api/get-applications/${userId}`)
      .then(r => r.json())
      .then(data => setApplications(data))
      .catch(() => {})
  }, [userId])

  const handleProfileSubmit = async (profileData) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/match-schemes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })
      const data = await res.json()
      setProfile(profileData)
      setResults(data)
      setStep('results')
      window.scrollTo(0, 0)
    } catch {
      alert('Cannot connect to backend! Run: cd backend && uvicorn main:app --reload')
    }
    setLoading(false)
  }

  const updateApplication = async (schemeId, status, notes = '') => {
    const updated = {
      ...applications,
      [schemeId]: { status, notes, updated_at: new Date().toISOString() }
    }
    setApplications(updated)
    try {
      await fetch(`${API}/api/track-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, scheme_id: schemeId, status, notes })
      })
    } catch {}
  }

  return (
    <div className="app">
      <Header
        step={step}
        setStep={setStep}
        profile={profile}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
        results={results}
      />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>
        {step === 'profile' && (
          <ProfileForm onSubmit={handleProfileSubmit} loading={loading} language={language} />
        )}
        {step === 'results' && results && (
          <SchemeResults
            results={results}
            profile={profile}
            onChat={() => setStep('chat')}
            onAgentChat={() => setStep('agent-chat')}
            onDashboard={() => setStep('dashboard')}
            applications={applications}
            updateApplication={updateApplication}
          />
        )}
        {step === 'chat' && (
          <ChatBot
            profile={profile}
            results={results}
            language={language}
            setLanguage={setLanguage}
          />
        )}
        {step === 'agent-chat' && (
          <MultiAgentChat
            profile={profile}
            results={results}
            language={language}
            setLanguage={setLanguage}
          />
        )}
        {step === 'dashboard' && (
          <Dashboard
            applications={applications}
            results={results}
            profile={profile}
            updateApplication={updateApplication}
            onBack={() => setStep('results')}
          />
        )}
      </main>
    </div>
  )
}
