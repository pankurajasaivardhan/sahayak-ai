import { useState, useMemo } from 'react'
import './Dashboard.css'

const STATUS_OPTIONS = [
  { value: 'not_applied', label: 'Not Applied', emoji: '⬜', color: '#868e96' },
  { value: 'saved', label: 'Saved', emoji: '🔖', color: '#1971c2' },
  { value: 'applied', label: 'Applied', emoji: '📤', color: '#e67700' },
  { value: 'pending', label: 'Pending', emoji: '⏳', color: '#9c36b5' },
  { value: 'received', label: 'Received', emoji: '✅', color: '#2d9e5f' },
]

function formatINR(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

export default function Dashboard({ applications, results, profile, updateApplication, onBack }) {
  const [filter, setFilter] = useState('all')
  const [notes, setNotes] = useState({})
  const [editingNotes, setEditingNotes] = useState(null)

  const schemes = results?.schemes || []

  // Merge application status into scheme list
  const schemesWithStatus = useMemo(() => {
    return schemes.map(s => ({
      ...s,
      appData: applications[s.id] || { status: 'not_applied', notes: '' }
    }))
  }, [schemes, applications])

  const filtered = useMemo(() => {
    if (filter === 'all') return schemesWithStatus
    return schemesWithStatus.filter(s => s.appData.status === filter)
  }, [schemesWithStatus, filter])

  // Progress stats
  const stats = useMemo(() => {
    const counts = {}
    STATUS_OPTIONS.forEach(o => { counts[o.value] = 0 })
    schemesWithStatus.forEach(s => {
      counts[s.appData.status] = (counts[s.appData.status] || 0) + 1
    })
    const receivedValue = schemesWithStatus
      .filter(s => s.appData.status === 'received')
      .reduce((sum, s) => sum + (s.annual_benefit_value || 0), 0)
    return { counts, receivedValue }
  }, [schemesWithStatus])

  const progressPct = schemes.length > 0
    ? Math.round(((stats.counts.applied || 0) + (stats.counts.pending || 0) + (stats.counts.received || 0)) / schemes.length * 100)
    : 0

  const saveNote = (schemeId) => {
    const currentStatus = applications[schemeId]?.status || 'not_applied'
    updateApplication(schemeId, currentStatus, notes[schemeId] || '')
    setEditingNotes(null)
  }

  return (
    <div className="dashboard-page fade-up">
      <div className="dashboard-header card">
        <button className="back-btn" onClick={onBack}>← Back to Schemes</button>
        <h2 className="dashboard-title">📊 Application Tracker</h2>
        {profile && (
          <p className="dashboard-sub">Tracking your welfare applications for <strong>{profile.state}</strong></p>
        )}
      </div>

      {/* Progress overview */}
      <div className="progress-section card">
        <div className="progress-top">
          <div>
            <div className="progress-label">Overall Progress</div>
            <div className="progress-pct">{progressPct}%</div>
          </div>
          <div className="progress-bar-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="progress-hint">
              {stats.counts.received} received · {stats.counts.applied} applied · {stats.counts.pending} pending
            </div>
          </div>
          {stats.receivedValue > 0 && (
            <div className="received-value">
              <div className="rv-label">Benefits Secured</div>
              <div className="rv-amount">{formatINR(stats.receivedValue)}/yr</div>
            </div>
          )}
        </div>

        <div className="status-counts">
          {STATUS_OPTIONS.map(opt => (
            <div key={opt.value} className="status-count-card" style={{ borderColor: opt.color + '44' }}>
              <div className="sc-emoji">{opt.emoji}</div>
              <div className="sc-num" style={{ color: opt.color }}>{stats.counts[opt.value] || 0}</div>
              <div className="sc-label">{opt.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({schemes.length})
        </button>
        {STATUS_OPTIONS.filter(o => o.value !== 'not_applied').map(opt => (
          <button
            key={opt.value}
            className={`filter-tab ${filter === opt.value ? 'active' : ''}`}
            onClick={() => setFilter(opt.value)}
            style={filter === opt.value ? { borderColor: opt.color, color: opt.color } : {}}
          >
            {opt.emoji} {opt.label} ({stats.counts[opt.value] || 0})
          </button>
        ))}
      </div>

      {/* Scheme tracker list */}
      <div className="tracker-list">
        {filtered.length === 0 ? (
          <div className="no-tracked card">
            <div style={{ fontSize: 40 }}>📭</div>
            <h3>No schemes in this category</h3>
            <p>Go back to schemes and start updating your application status</p>
          </div>
        ) : (
          filtered.map(scheme => {
            const opt = STATUS_OPTIONS.find(o => o.value === scheme.appData.status) || STATUS_OPTIONS[0]
            const isEditingThis = editingNotes === scheme.id
            return (
              <div key={scheme.id} className="tracker-card card">
                <div className="tracker-main">
                  <div className="tracker-left">
                    <span className="tracker-emoji">{scheme.emoji}</span>
                    <div className="tracker-info">
                      <div className="tracker-name">{scheme.name}</div>
                      <div className="tracker-value">{formatINR(scheme.annual_benefit_value)}/yr · {scheme.category}</div>
                    </div>
                  </div>
                  <div className="tracker-right">
                    <span
                      className="tracker-status"
                      style={{ background: opt.color + '22', color: opt.color, border: `1px solid ${opt.color}55` }}
                    >
                      {opt.emoji} {opt.label}
                    </span>
                  </div>
                </div>

                {/* Status buttons */}
                <div className="status-buttons">
                  {STATUS_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      className={`status-btn ${scheme.appData.status === o.value ? 'active' : ''}`}
                      style={scheme.appData.status === o.value ? { background: o.color, color: 'white', borderColor: o.color } : {}}
                      onClick={() => updateApplication(scheme.id, o.value, scheme.appData.notes || '')}
                    >
                      {o.emoji} {o.label}
                    </button>
                  ))}
                </div>

                {/* Notes */}
                <div className="notes-section">
                  {isEditingThis ? (
                    <div className="notes-edit">
                      <textarea
                        className="notes-textarea"
                        placeholder="Add notes... (e.g., applied on 15 Jan, reference no. 12345)"
                        value={notes[scheme.id] ?? scheme.appData.notes ?? ''}
                        onChange={e => setNotes(n => ({ ...n, [scheme.id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="notes-actions">
                        <button className="notes-save" onClick={() => saveNote(scheme.id)}>Save</button>
                        <button className="notes-cancel" onClick={() => setEditingNotes(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="notes-display" onClick={() => {
                      setNotes(n => ({ ...n, [scheme.id]: scheme.appData.notes || '' }))
                      setEditingNotes(scheme.id)
                    }}>
                      {scheme.appData.notes
                        ? <span className="notes-text">📝 {scheme.appData.notes}</span>
                        : <span className="notes-placeholder">+ Add notes</span>
                      }
                    </div>
                  )}
                </div>

                {/* Application link */}
                {scheme.portal && (
                  <a href={scheme.portal} target="_blank" rel="noopener noreferrer" className="apply-link">
                    🌐 Apply Online →
                  </a>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
