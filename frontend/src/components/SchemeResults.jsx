import { useState, useMemo } from 'react'
import './SchemeResults.css'

const STATUS_OPTIONS = [
  { value: 'not_applied', label: 'Not Applied', color: '#868e96' },
  { value: 'saved', label: 'Saved', color: '#1971c2' },
  { value: 'applied', label: 'Applied', color: '#e67700' },
  { value: 'pending', label: 'Pending', color: '#9c36b5' },
  { value: 'received', label: 'Received ✓', color: '#2d9e5f' },
]

const BAR_COLORS = ['#FF6B35', '#2d9e5f', '#1971c2', '#9c36b5', '#e67700', '#c92a2a', '#0c8599', '#862e9c', '#f59e0b', '#06b6d4']

function BenefitBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value))
  return (
    <div className="benefit-bar-chart">
      {data
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((item, i) => {
          const pct = Math.round((item.value / max) * 100)
          const color = BAR_COLORS[i % BAR_COLORS.length]
          const label = item.name.replace('_', ' ')
          const total = item.value >= 100000
            ? `₹${(item.value / 100000).toFixed(1)}L`
            : item.value >= 1000
            ? `₹${(item.value / 1000).toFixed(0)}K`
            : `₹${item.value}`
          return (
            <div key={item.name} className="bar-row">
              <div className="bar-label" title={label}>{label}</div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <div className="bar-value">{total}</div>
            </div>
          )
        })}
    </div>
  )
}

function formatINR(n) {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n/1000).toFixed(0)}K`
  return `₹${n}`
}

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0]
  return (
    <span className="status-badge" style={{ background: opt.color + '22', color: opt.color, border: `1px solid ${opt.color}55` }}>
      {opt.label}
    </span>
  )
}

function SchemeCard({ scheme, index, appStatus, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  const currentStatus = appStatus?.status || 'not_applied'

  return (
    <div className={`scheme-card fade-up ${expanded ? 'expanded' : ''}`} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="scheme-card-main" onClick={() => setExpanded(!expanded)}>
        <div className="scheme-left">
          <span className="scheme-emoji">{scheme.emoji}</span>
          <div className="scheme-info">
            <div className="scheme-name">{scheme.name}</div>
            <div className="scheme-full">{scheme.full_name}</div>
            <div className="scheme-tags">
              <span className="tag tag-cat">{scheme.category}</span>
              <span className={`tag tag-match score-${Math.min(4, Math.floor(scheme.match_percent / 25))}`}>
                {scheme.match_percent}% match
              </span>
            </div>
          </div>
        </div>
        <div className="scheme-right">
          <div className="scheme-value">{formatINR(scheme.annual_benefit_value)}</div>
          <div className="scheme-per">/year</div>
          <div className="scheme-expand">{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      <div className="scheme-desc">{scheme.description}</div>

      <div className="scheme-footer">
        <div className="status-wrapper">
          <StatusBadge status={currentStatus} />
          <button className="status-change-btn" onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu) }}>
            Update ▾
          </button>
          {showStatusMenu && (
            <div className="status-menu">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className="status-option"
                  style={{ color: opt.color }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(scheme.id, opt.value)
                    setShowStatusMenu(false)
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {scheme.helpline && (
          <a href={`tel:${scheme.helpline}`} className="helpline-link" onClick={e => e.stopPropagation()}>
            📞 {scheme.helpline}
          </a>
        )}
      </div>

      {expanded && (
        <div className="scheme-details">
          <div className="detail-cols">
            <div className="detail-section">
              <h4>📄 Documents Needed</h4>
              <ul>
                {scheme.documents.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
            <div className="detail-section">
              <h4>📋 How to Apply</h4>
              <ol>
                {scheme.how_to_apply.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </div>
          </div>
          {scheme.portal && (
            <a href={scheme.portal} target="_blank" rel="noopener noreferrer" className="portal-link">
              🌐 Visit Official Portal →
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function SchemeResults({ results, profile, onChat, onAgentChat, onDashboard, applications, updateApplication }) {
  const { schemes, total_unclaimed_value, count, stats } = results
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortBy, setSortBy] = useState('match')

  const categories = useMemo(() => {
    const cats = ['All', ...new Set(schemes.map(s => s.category))]
    return cats
  }, [schemes])

  const filteredSchemes = useMemo(() => {
    let filtered = schemes.filter(s => {
      const matchCat = activeCategory === 'All' || s.category === activeCategory
      const matchSearch = !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchCat && matchSearch
    })

    if (sortBy === 'value') filtered.sort((a, b) => b.annual_benefit_value - a.annual_benefit_value)
    else if (sortBy === 'match') filtered.sort((a, b) => b.match_percent - a.match_percent)
    else if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name))

    return filtered
  }, [schemes, activeCategory, searchQuery, sortBy])

  const pieData = useMemo(() => {
    return Object.entries(stats?.by_category || {}).map(([name, value]) => ({ name, value }))
  }, [stats])

  const appliedCount = Object.values(applications).filter(a => a.status !== 'not_applied').length
  const receivedCount = Object.values(applications).filter(a => a.status === 'received').length

  return (
    <div className="results-page fade-up">
      {/* Hero summary */}
      <div className="results-hero card">
        <div className="congrats-badge">✅ Eligibility Check Complete</div>
        <h2 className="results-title">
          You qualify for <span className="highlight">{count} schemes!</span>
        </h2>
        <p className="results-location">Based on your profile in <strong>{profile.state}</strong></p>

        <div className="benefit-cards">
          <div className="benefit-card benefit-card-main">
            <div className="bc-label">💰 Total Unclaimed Value</div>
            <div className="bc-amount">
              {total_unclaimed_value >= 100000
                ? `₹${(total_unclaimed_value/100000).toFixed(1)} Lakh`
                : `₹${total_unclaimed_value.toLocaleString('en-IN')}`}
            </div>
            <div className="bc-note">per year combined</div>
          </div>

          <div className="benefit-card">
            <div className="bc-label">🎯 Best Match</div>
            <div className="bc-sub">{stats?.top_scheme?.name}</div>
            <div className="bc-note">{formatINR(stats?.top_scheme?.annual_benefit_value || 0)}/yr</div>
          </div>

          <div className="benefit-card">
            <div className="bc-label">⚡ Quick Apply</div>
            <div className="bc-sub" style={{color: 'var(--green)', fontSize: 28, fontWeight: 800}}>{stats?.quick_apply_count || 0}</div>
            <div className="bc-note">schemes (easy process)</div>
          </div>

          <div className="benefit-card">
            <div className="bc-label">📊 Your Progress</div>
            <div className="bc-sub" style={{color: 'var(--blue)', fontSize: 28, fontWeight: 800}}>{appliedCount}/{count}</div>
            <div className="bc-note">{receivedCount} received</div>
          </div>
        </div>

        <div className="hero-actions">
          <button className="btn-green" onClick={onChat}>💬 Ask AI Advisor →</button>
          <button className="btn-green" style={{background:'#7c3aed'}} onClick={onAgentChat}>🧠 Multi-Agent Advisor →</button>
          <button className="btn-secondary" onClick={onDashboard}>📊 Application Tracker</button>
        </div>
      </div>

      {/* Benefit breakdown chart */}
      {pieData.length > 1 && (
        <div className="card chart-card">
          <h3 className="section-title">💰 Benefit Breakdown by Category</h3>
          <BenefitBarChart data={pieData} />
        </div>
      )}

      {/* Search & Filter */}
      <div className="filter-bar card">
        <input
          className="search-input"
          type="text"
          placeholder="🔍 Search schemes by name, benefit, keyword..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="filter-row">
          <div className="category-filters">
            {categories.map(cat => (
              <button
                key={cat}
                className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="match">Sort: Best Match</option>
            <option value="value">Sort: Highest Value</option>
            <option value="name">Sort: A–Z</option>
          </select>
        </div>
      </div>

      {/* Schemes List */}
      <div className="schemes-list">
        <div className="list-header">
          <h3>{filteredSchemes.length} schemes shown</h3>
          <span className="list-hint">Click any scheme for documents & steps</span>
        </div>

        {filteredSchemes.length === 0 ? (
          <div className="no-results card">
            <div style={{fontSize: 40}}>🔍</div>
            <h3>No schemes match your search</h3>
            <p>Try different keywords or reset the filter</p>
            <button className="btn-secondary" onClick={() => { setSearchQuery(''); setActiveCategory('All') }}>Reset Filters</button>
          </div>
        ) : (
          filteredSchemes.map((scheme, i) => (
            <SchemeCard
              key={scheme.id}
              scheme={scheme}
              index={i}
              appStatus={applications[scheme.id]}
              onStatusChange={updateApplication}
            />
          ))
        )}
      </div>
    </div>
  )
}
