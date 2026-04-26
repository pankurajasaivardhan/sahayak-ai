import { useState } from 'react'
import './Header.css'

export default function Header({ step, setStep, profile, theme, setTheme, language, setLanguage, results }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const steps = [
    { id: 'profile', label: language === 'hi' ? 'प्रोफाइल' : 'Profile', num: 1 },
    { id: 'results', label: language === 'hi' ? 'योजनाएं' : 'Schemes', num: 2 },
    { id: 'dashboard', label: language === 'hi' ? 'ट्रैकर' : 'Tracker', num: 3 },
    { id: 'chat', label: language === 'hi' ? 'सलाहकार' : 'Advisor', num: 4 },
    { id: 'agent-chat', label: language === 'hi' ? 'AI एजेंट' : '🧠 Agents', num: 5 },
  ]

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo" onClick={() => setStep('profile')}>
          <div className="logo-flag">🇮🇳</div>
          <div>
            <div className="logo-title">SahayakAI</div>
            <div className="logo-sub">सहायक AI · Welfare Guide</div>
          </div>
        </div>

        {profile && (
          <nav className="nav-steps desktop-only">
            {steps.map((s, i) => {
              const accessible = s.id === 'profile' || (profile && ['results','dashboard','chat','agent-chat'].includes(s.id))
              const isActive = step === s.id
              return (
                <div key={s.id} className="nav-item">
                  {i > 0 && <div className="nav-arrow">›</div>}
                  <button
                    className={`nav-step ${isActive ? 'active' : ''} ${!accessible ? 'disabled' : ''}`}
                    onClick={() => accessible && setStep(s.id)}
                  >
                    <span className="step-num">{s.num}</span>
                    {s.label}
                    {s.id === 'results' && results && (
                      <span className="step-badge">{results.count}</span>
                    )}
                  </button>
                </div>
              )
            })}
          </nav>
        )}

        <div className="header-actions">
          <button
            className="lang-btn"
            onClick={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
            title="Toggle language"
          >
            {language === 'en' ? 'हिं' : 'EN'}
          </button>
          <button
            className="theme-btn"
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            title="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
      <div className="tricolor-bar">
        <div className="tc-orange" />
        <div className="tc-white" />
        <div className="tc-green" />
      </div>
    </header>
  )
}
