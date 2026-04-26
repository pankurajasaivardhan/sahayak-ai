import { useState, useRef } from 'react'
import './ProfileForm.css'

const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi",
  "Jammu & Kashmir","Ladakh","Chandigarh","Puducherry"
]

const T = {
  en: {
    hero_badge: "🇮🇳 500M+ Indians miss benefits they deserve",
    hero_title: "Find your government schemes",
    hero_sub: "in 30 seconds",
    hero_desc: "Answer 6 questions. Our AI finds every scheme you qualify for — and shows exactly how to apply.",
    schemes: "schemes",
    free: "Free to use",
    seconds: "30 sec check",
    tell_us: "Tell us about yourself",
    privacy: "Your data is never stored or sold. Privacy guaranteed.",
    age: "Age *", age_ph: "e.g. 35",
    state: "State *", state_ph: "Select your state",
    income: "Annual Family Income (₹) *", income_ph: "e.g. 80000",
    occupation: "Occupation *", occ_ph: "Select occupation",
    gender: "Gender *",
    category: "Social Category",
    disability: "Do you have a disability certificate?",
    bpl: "Do you have a BPL / Ration Card?",
    family: "Family Size",
    submit: "Find My Schemes →",
    loading: "Finding your schemes...",
    required: "Please fill all required fields!",
    occs: [
      ["farmer", "👨‍🌾 Farmer / Agricultural Worker"],
      ["daily_wage", "👷 Daily Wage / Labour Worker"],
      ["student", "🎓 Student"],
      ["unemployed", "🔍 Unemployed / Job Seeker"],
      ["other", "💼 Self-employed / Business / Other"],
    ],
    genders: [["male","Male"],["female","Female"],["other","Other"]],
    castes: [["general","General"],["obc","OBC"],["sc","SC"],["st","ST"]],
  },
  hi: {
    hero_badge: "🇮🇳 50 करोड़ से ज़्यादा भारतीय अपने हक़ की योजनाओं से वंचित हैं",
    hero_title: "अपनी सरकारी योजनाएं खोजें",
    hero_sub: "30 सेकंड में",
    hero_desc: "6 सवालों के जवाब दें। हमारा AI हर वो योजना ढूंढेगा जिसके आप हक़दार हैं।",
    schemes: "योजनाएं",
    free: "मुफ़्त उपयोग",
    seconds: "30 सेकंड",
    tell_us: "अपने बारे में बताएं",
    privacy: "आपका डेटा कभी संग्रहीत या बेचा नहीं जाता। गोपनीयता की गारंटी।",
    age: "आयु *", age_ph: "जैसे 35",
    state: "राज्य *", state_ph: "अपना राज्य चुनें",
    income: "वार्षिक पारिवारिक आय (₹) *", income_ph: "जैसे 80000",
    occupation: "व्यवसाय *", occ_ph: "व्यवसाय चुनें",
    gender: "लिंग *",
    category: "सामाजिक वर्ग",
    disability: "क्या आपके पास दिव्यांगता प्रमाण पत्र है?",
    bpl: "क्या आपके पास BPL / राशन कार्ड है?",
    family: "परिवार का आकार",
    submit: "मेरी योजनाएं खोजें →",
    loading: "योजनाएं खोज रहे हैं...",
    required: "कृपया सभी ज़रूरी जानकारी भरें!",
    occs: [
      ["farmer", "👨‍🌾 किसान / कृषि मज़दूर"],
      ["daily_wage", "👷 दैनिक मज़दूर"],
      ["student", "🎓 छात्र / छात्रा"],
      ["unemployed", "🔍 बेरोज़गार"],
      ["other", "💼 स्व-रोजगार / व्यापार / अन्य"],
    ],
    genders: [["male","पुरुष"],["female","महिला"],["other","अन्य"]],
    castes: [["general","सामान्य"],["obc","ओबीसी"],["sc","अनुसूचित जाति"],["st","अनुसूचित जनजाति"]],
  }
}

export default function ProfileForm({ onSubmit, loading, language = 'en' }) {
  const t = T[language] || T.en
  const [form, setForm] = useState({
    age: '', state: '', income: '', occupation: '', gender: '',
    caste: 'general', disability: false, bpl_card: false, family_size: 4, has_land: false
  })
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    if (!form.age || !form.state || !form.income || !form.occupation || !form.gender) {
      alert(t.required)
      return
    }
    onSubmit({
      ...form,
      age: parseInt(form.age),
      income: parseInt(form.income),
      family_size: parseInt(form.family_size),
    })
  }

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Try Chrome.')
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SpeechRecognition()
    rec.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
    rec.continuous = false
    rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.toLowerCase()
      // Simple voice parsing
      const ageMatch = transcript.match(/(\d+)\s*(year|साल|वर्ष)/)
      if (ageMatch) set('age', ageMatch[1])
      if (transcript.includes('farmer') || transcript.includes('किसान')) set('occupation', 'farmer')
      if (transcript.includes('student') || transcript.includes('छात्र')) set('occupation', 'student')
      if (transcript.includes('male') || transcript.includes('पुरुष')) set('gender', 'male')
      if (transcript.includes('female') || transcript.includes('महिला')) set('gender', 'female')
    }
    recognitionRef.current = rec
    rec.start()
  }

  return (
    <div className="profile-page fade-up">
      <div className="hero-section">
        <div className="hero-badge">{t.hero_badge}</div>
        <h1 className="hero-title">
          {t.hero_title} <span className="highlight">{t.hero_sub}</span>
        </h1>
        <p className="hero-desc">{t.hero_desc}</p>

        <div className="hero-stats">
          <div className="stat">
            <span className="stat-num">30+</span>
            <span className="stat-label">{t.schemes}</span>
          </div>
          <div className="stat-div" />
          <div className="stat">
            <span className="stat-num">₹0</span>
            <span className="stat-label">{t.free}</span>
          </div>
          <div className="stat-div" />
          <div className="stat">
            <span className="stat-num">30s</span>
            <span className="stat-label">{t.seconds}</span>
          </div>
        </div>
      </div>

      <div className="card form-card">
        <div className="form-header">
          <div>
            <h2 className="form-title">{t.tell_us}</h2>
            <p className="form-subtitle">{t.privacy}</p>
          </div>
          <button
            className={`voice-btn ${listening ? 'listening' : ''}`}
            onClick={startVoice}
            title="Voice input"
          >
            {listening ? '🔴' : '🎙️'}
            <span>{listening ? 'Listening...' : 'Voice'}</span>
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">{t.age}</label>
            <input
              className="form-input"
              type="number"
              placeholder={t.age_ph}
              value={form.age}
              onChange={e => set('age', e.target.value)}
              min={1} max={120}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.state}</label>
            <select className="form-select" value={form.state} onChange={e => set('state', e.target.value)}>
              <option value="">{t.state_ph}</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t.income}</label>
            <input
              className="form-input"
              type="number"
              placeholder={t.income_ph}
              value={form.income}
              onChange={e => set('income', e.target.value)}
              min={0}
            />
            {form.income && (
              <span className="input-hint">
                ≈ ₹{Math.round(form.income/12).toLocaleString('en-IN')}/month
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t.occupation}</label>
            <select className="form-select" value={form.occupation} onChange={e => set('occupation', e.target.value)}>
              <option value="">{t.occ_ph}</option>
              {t.occs.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>

          <div className="form-group full-span">
            <label className="form-label">{t.gender}</label>
            <div className="radio-group">
              {t.genders.map(([val, label]) => (
                <label key={val} className={`radio-btn ${form.gender === val ? 'selected' : ''}`}>
                  <input type="radio" name="gender" value={val} checked={form.gender === val} onChange={() => set('gender', val)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group full-span">
            <label className="form-label">{t.category}</label>
            <div className="radio-group">
              {t.castes.map(([val, label]) => (
                <label key={val} className={`radio-btn ${form.caste === val ? 'selected' : ''}`}>
                  <input type="radio" name="caste" value={val} checked={form.caste === val} onChange={() => set('caste', val)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t.family}</label>
            <div className="stepper">
              <button type="button" className="step-btn" onClick={() => set('family_size', Math.max(1, form.family_size - 1))}>−</button>
              <span className="step-val">{form.family_size}</span>
              <button type="button" className="step-btn" onClick={() => set('family_size', Math.min(15, form.family_size + 1))}>+</button>
            </div>
          </div>

          <div className="form-group">
            <label className="toggle-label">
              <span>{t.bpl}</span>
              <label className="toggle">
                <input type="checkbox" checked={form.bpl_card} onChange={e => set('bpl_card', e.target.checked)} />
                <span className="slider" />
              </label>
            </label>
            <label className="toggle-label" style={{marginTop: 8}}>
              <span>{t.disability}</span>
              <label className="toggle">
                <input type="checkbox" checked={form.disability} onChange={e => set('disability', e.target.checked)} />
                <span className="slider" />
              </label>
            </label>
            {form.occupation === 'farmer' && (
              <label className="toggle-label" style={{marginTop: 8}}>
                <span>Do you own land?</span>
                <label className="toggle">
                  <input type="checkbox" checked={form.has_land} onChange={e => set('has_land', e.target.checked)} />
                  <span className="slider" />
                </label>
              </label>
            )}
          </div>
        </div>

        <button className="btn-primary full-width submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? <><span className="spinner" /> {t.loading}</> : t.submit}
        </button>
      </div>
    </div>
  )
}
