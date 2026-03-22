import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import './App.css'

// ── Components: Optimized & Memoized ──────────────────────────────────────────

const Clock = ({ hideDate = false }) => {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="live-clock-wrapper">
      <div className="clock-time">{formatTime(time)}</div>
      {!hideDate && <div className="clock-date">{formatDate(time)}</div>}
    </div>
  )
}

const SplashScreen = ({ isVisible, onDismiss }) => {
  const [isMounted, setIsMounted] = useState(isVisible)
  const [ready, setReady] = useState(false)
  const divRef = useRef(null)

  useEffect(() => {
    if (isVisible) {
      setIsMounted(true)
      const t = setTimeout(() => {
        setReady(true)
        // 포커스를 줘야 onKeyDown이 작동합니다
        divRef.current?.focus()
      }, 1000)
      return () => clearTimeout(t)
    } else {
      setReady(false)
      const exitTimer = setTimeout(() => setIsMounted(false), 1500)
      return () => clearTimeout(exitTimer)
    }
  }, [isVisible])

  if (!isMounted) return null

  const handleClick = () => { if (ready) onDismiss() }
  const handleKeyDown = () => { if (ready) onDismiss() }

  return (
    <div
      ref={divRef}
      className={`splash-screen ${!isVisible ? 'exit' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <div className="splash-content">
        <h1 className="greeting-text">환영합니다, 평행 님.</h1>
        <div className="greeting-glow"></div>
        <p className="greeting-hint">아무 키나 눌러서 시작</p>
      </div>
    </div>
  )
}

const HeatmapCell = memo(({ i, ds, rawData, isToday, quests, todos, archivedTodos, onMouseEnter, onMouseLeave }) => {
  const targetFocusSeconds = 14400
  let data = { q: 0, a: 0, t: 0, total: 0 }
  if (typeof rawData === 'number') {
    data = { q: rawData, a: rawData, t: rawData, total: rawData }
  } else if (rawData) {
    data = rawData
  }

  const dateObj = new Date(ds)
  const label = isNaN(dateObj.getTime()) ? ds : dateObj.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
  const pctTotal = Math.round(data.total * 100)
  const pctQ = Math.round(data.q * 100)
  const pctA = Math.round(data.a * 100)
  const currentTSeconds = data.s !== undefined ? data.s : ((data.t || 0) * 14400)
  const displayFocusRatio = Math.min((currentTSeconds || 0) / targetFocusSeconds, 1)
  const pctT = Math.round((displayFocusRatio || 0) * 100)

  // Recovery logic for tooltip data (Absolute Integrity: Scan archived items for past dates)
  const getLegacyCounts = () => {
    const q_done = quests.filter(q => q.completed && q.completedAt === ds).length
    const q_total = data.q > 0 ? (q_done > 0 ? Math.round(q_done / data.q) : Math.round(1 / data.q)) : 0
    let a_main = 0, a_sub = 0

    // Scan both active and archived todos for the target date
    const allRelevantTodos = [...todos, ...(archivedTodos || [])]
    allRelevantTodos.forEach(t => {
      if (t.status === 'done' && t.completedAt === ds) a_main += 1
      if (t.subtasks) a_sub += t.subtasks.filter(s => s.completed && s.completedAt === ds).length
    })
    const a_done_total = a_main + a_sub
    const a_total = data.a > 0 ? (a_done_total > 0 ? Math.round(a_done_total / data.a) : Math.round(1 / data.a)) : 0
    return { q_done: q_done || (data.q > 0 ? Math.round(q_total * data.q) : 0), q_total, a_main, a_sub, a_total }
  }

  const needsRecovery = rawData && (
    rawData.qa_main === undefined ||
    (data.q > 0 && (data.qq_done === 0 || data.qq_total === 0)) ||
    (data.a > 0 && (data.qa_main === 0 && data.qa_sub === 0))
  )
  const legacyCounts = needsRecovery ? getLegacyCounts() : null

  const tooltipData = {
    label, pct: pctTotal,
    q_done: legacyCounts ? legacyCounts.q_done : (data.qq_done || 0),
    q_total: legacyCounts ? legacyCounts.q_total : (data.qq_total || 0),
    a_main: legacyCounts ? legacyCounts.a_main : (data.qa_main || 0),
    a_sub: legacyCounts ? legacyCounts.a_sub : (data.qa_sub || 0),
    a_total: legacyCounts ? legacyCounts.a_total : (data.qa_total || 0),
    focusSeconds: currentTSeconds
  }

  const priority = { a: 1, q: 2, t: 3 }
  const stats = [{ key: 'q', val: pctQ }, { key: 'a', val: pctA }, { key: 't', val: pctT }].sort((a, b) => (b.val - a.val) || (priority[a.key] - priority[b.key]))
  const layerProps = {}
  const waveHByRank = ['8px', '6px', '4px']
  stats.forEach((stat, idx) => { layerProps[stat.key] = { zIndex: idx + 1, waveHeight: waveHByRank[idx] } })
  const minPct = Math.min(pctQ, pctA, pctT)

  return (
    <div
      className={`heatmap-cell layered ${isToday ? 'today' : ''}`}
      style={{
        '--pct-q': (isNaN(pctQ) ? 0 : pctQ),
        '--pct-a': (isNaN(pctA) ? 0 : pctA),
        '--pct-t': (isNaN(pctT) ? 0 : pctT),
        '--pct-w': (isNaN(minPct) ? 0 : minPct),
        '--pct-total': (isNaN(pctTotal) ? 0 : pctTotal)
      }}
      onMouseEnter={() => onMouseEnter(tooltipData)}
      onMouseLeave={onMouseLeave}
    >
      <div className="layer-y" title="Action Items" style={{ zIndex: layerProps.a.zIndex, '--wave-h': layerProps.a.waveHeight }} />
      <div className="layer-m" title="Daily Quests" style={{ zIndex: layerProps.q.zIndex, '--wave-h': layerProps.q.waveHeight }} />
      <div className="layer-c" title="Focus Timer" style={{ zIndex: layerProps.t.zIndex, '--wave-h': layerProps.t.waveHeight }} />
      {minPct > 0 && <div className="layer-w" style={{ zIndex: 10, '--wave-h': '4px' }} />}
    </div>
  )
})

function createWhiteNoise(ctx) {
  const bufferSize = 2 * ctx.sampleRate
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const output = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 800

  const gainNode = ctx.createGain()
  gainNode.gain.value = 0.12

  source.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)
  return { source, gainNode }
}

// ── Ultra-Robust Helpers (First-Principles) ──────────────────────────────────
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function formatFocus(s) {
  if (isNaN(s) || s < 0) return "00:00:00"
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatTime(d) {
  try { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch (e) { return "00:00" }
}

function formatDate(d) {
  try { return d.toLocaleDateString('ko-KR', { weekday: 'long', month: 'short', day: 'numeric' }) }
  catch (e) { return "" }
}

function migrateTodos(parsed) {
  if (!Array.isArray(parsed)) return []
  const yesterday = new Date('2026-03-13').toDateString()
  const migrated = parsed.map(t => {
    if (!t) return null
    let item = { ...t }
    if (t.completed !== undefined) {
      const status = t.completed ? 'done' : 'todo'
      const { completed: _c, ...rest } = t
      item = { ...rest, status }
    }
    if (item.status === 'done' && !item.completedAt) {
      item.completedAt = yesterday
    }
    if (item.subquests || item.subtasks) {
      const rawSubtasks = item.subtasks || item.subquests || []
      item.subtasks = rawSubtasks.map(s => {
        if (s && s.completed && !s.completedAt) return { ...s, completedAt: yesterday }
        return s
      }).filter(Boolean)
      delete item.subquests
    }
    return item
  }).filter(Boolean)
  const seen = new Set()
  return migrated.filter(t => {
    if (!t.id || seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
}

function migrateQuests(parsed) {
  if (!Array.isArray(parsed)) return []
  const yesterday = new Date('2026-03-13').toDateString()
  const migrated = parsed.map(q => {
    if (!q) return null
    if (q.completed && !q.completedAt) return { ...q, completedAt: yesterday }
    return q
  }).filter(Boolean)
  const seen = new Set()
  return migrated.filter(q => {
    if (!q.id || seen.has(q.id)) return false
    seen.add(q.id)
    return true
  })
}

function migrateHeatmap(data) {
  if (!data || typeof data !== 'object') return {}
  let repaired = { ...data }

  try {
    const migrationFlag = 'hub-goal-migrated-v4h'
    if (!localStorage.getItem(migrationFlag)) {
      const migrated = {}
      Object.keys(repaired).forEach(date => {
        const entry = repaired[date]
        if (entry && typeof entry === 'object') {
          const newT = (entry.t || 0) * 0.75
          const newTotal = ((entry.q || 0) + (entry.a || 0) + newT) / 3
          migrated[date] = { ...entry, t: newT, total: newTotal }
        } else if (typeof entry === 'number') {
          migrated[date] = entry * 0.75
        }
      })
      repaired = migrated
      localStorage.setItem(migrationFlag, 'true')
    }
  } catch (e) { console.error(e) }

  try {
    const repairFlag = 'hub-heatmap-repair-v1'
    if (!localStorage.getItem(repairFlag)) {
      const tsaved = localStorage.getItem('hub-todos')
      const allTodos = tsaved ? JSON.parse(tsaved) : []
      Object.keys(repaired).forEach(dateStr => {
        const entry = repaired[dateStr]
        if (!entry || typeof entry !== 'object') return
        const targetDate = new Date(dateStr)
        if (isNaN(targetDate.getTime())) return
        const maxTs = new Date(targetDate).setHours(23, 59, 59, 999)
        const minTs = new Date(targetDate).setHours(0, 0, 0, 0)
        let score = 0, activeCount = 0
        allTodos.forEach(t => {
          if (!t || !t.id) return
          const cid = t.id
          const ts = (typeof cid === 'string' && cid.includes('-')) ? parseInt(cid.split('-')[0]) : cid
          if (ts > maxTs) return
          const comTs = t.completedAt ? new Date(t.completedAt).getTime() : Infinity
          if (comTs < minTs) return
          activeCount++
          if (t.status === 'done' && t.completedAt === dateStr) score += 1
          else if (t.subtasks?.length > 0) {
            const sdToday = t.subtasks.filter(s => s && s.completed && s.completedAt === dateStr).length
            score += (sdToday / t.subtasks.length) * 0.8
          }
        })
        if (activeCount > 0) {
          const newA = score / activeCount
          const newT = entry.t !== undefined ? entry.t : (entry.s ? entry.s / 14400 : 0)
          const newTotal = ((entry.q || 0) + newA + newT) / 3
          repaired[dateStr] = { ...entry, a: newA, total: newTotal, qa_total: activeCount }
        }
      })
      localStorage.setItem(repairFlag, 'true')
    }
  } catch (e) { console.error(e) }
  return repaired
}

function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [todos, setTodos] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-todos')
      if (saved) return migrateTodos(JSON.parse(saved))
    } catch (e) {
      console.error('[System] Error loading todos:', e)
    }
    return []
  })
  const [archivedTodos, setArchivedTodos] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-archived-todos')
      if (saved) return migrateTodos(JSON.parse(saved))
    } catch (e) {
      console.error('[System] Error loading archived todos:', e)
    }
    return []
  })
  const [isArchiveOpen, _unused_setIsArchiveOpen] = useState(false) // Deprecated, but keeping state for safety if needed later or just removing
  const [activeActionTab, setActiveActionTab] = useState('active') // 'active' or 'archive'
  const [expandedTodoIds, setExpandedTodoIds] = useState(new Set()) // For archive subtask toggle
  const [expandedArchiveDates, setExpandedArchiveDates] = useState(new Set()) // For archive date toggle
  const [editingArchiveId, setEditingArchiveId] = useState(null)
  const [editingArchiveText, setEditingArchiveText] = useState('')
  const [editingArchiveSubId, setEditingArchiveSubId] = useState(null)
  const [editingArchiveSubText, setEditingArchiveSubText] = useState('')

  // Edit states
  const [editingTodoId, setEditingTodoId] = useState(null)
  const [editingTodoText, setEditingTodoText] = useState('')
  const [editingSubtaskId, setEditingSubtaskId] = useState(null)
  const [editingSubtaskText, setEditingSubtaskText] = useState('')

  const [quests, setQuests] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-quests')
      if (saved) return migrateQuests(JSON.parse(saved))
    } catch (e) {
      console.error('[System] Error loading quests:', e)
    }
    return [
      { id: 'initial-1', text: '물 2L 마시기', completed: false },
      { id: 'initial-2', text: '30분 집중하기', completed: false }
    ]
  })

  // Edit states for quests
  const [editingQuestId, setEditingQuestId] = useState(null)
  const [editingQuestText, setEditingQuestText] = useState('')

  const [input, setInput] = useState('')
  const [questInputValue, setQuestInputValue] = useState('')
  const [lastResetDate, setLastResetDate] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-lastResetDate')
      return saved ? JSON.parse(saved) : new Date().toDateString()
    } catch (e) {
      return new Date().toDateString()
    }
  })

  // Heatmap: { dateString: ratio (0~1) }
  const [heatmap, setHeatmap] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-heatmap-v2')
      if (saved) return migrateHeatmap(JSON.parse(saved))
    } catch (e) {
      console.error('[System] Error loading heatmap:', e)
    }
    return {}
  })
  const [heatmapTooltip, setHeatmapTooltip] = useState(null)

  const [isPageVisible, setIsPageVisible] = useState(true)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setIsPageVisible(true)
        // 브라우저 포커스 복원 엔진과 드래그 라이브러리(rbd)의 이전 포커스 캐시를 완벽히 속이기 위해
        // 화면 밖의 보이지 않는 더미 버튼으로 강제로 포커스를 빼돌립니다.
        setTimeout(() => {
          if (dummyFocusRef.current) dummyFocusRef.current.focus()
        }, 50)
      } else {
        setIsPageVisible(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // WebView2 런처로부터 가시성 메시지 수신
    const handleMessage = (e) => {
      if (e.data === 'visibility:hidden') setIsPageVisible(false)
      if (e.data === 'visibility:visible') {
        setIsPageVisible(true)
        setTimeout(() => {
          if (dummyFocusRef.current) dummyFocusRef.current.focus()
        }, 50)
      }
    }

    if (window.chrome?.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (window.chrome?.webview) {
        window.chrome.webview.removeEventListener('message', handleMessage);
      }
    }
  }, [])

  const [currentTime, setCurrentTime] = useState(new Date())
  const [focusTimeSeconds, setFocusTimeSeconds] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-focusTime')
      return saved ? JSON.parse(saved) : 0
    } catch (e) { return 0 }
  })
  const [isFocusTimerRunning, setIsFocusTimerRunning] = useState(false)

  const [brainDump, setBrainDump] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-braindump')
      return saved ? JSON.parse(saved) : ''
    } catch (e) { return '' }
  })

  const [oneThing, setOneThing] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-oneThing')
      return saved ? JSON.parse(saved) : ''
    } catch (e) { return '' }
  })

  const [isZenMode, setIsZenMode] = useState(false)
  // eslint-disable-next-line no-unused-vars
  const [zenFocus, setZenFocus] = useState(() => {
    try {
      const saved = localStorage.getItem('hub-zenFocus')
      return saved ? JSON.parse(saved) : ''
    } catch (e) { return '' }
  })

  // Splash Screen State
  // sessionStorage는 WebView2에서 앱을 껐다 켜도 유지되어 신뢰할 수 없습니다.
  // performance.navigation.type으로 판별:
  //   'navigate' = 앱이 새로 켜진 것 → 환영 화면 표시
  //   'reload'   = F5 새로고침        → 환영 화면 스킵
  const [isSplashShowing, setIsSplashShowing] = useState(() => {
    try {
      const navEntry = performance.getEntriesByType('navigation')[0]
      return navEntry?.type === 'navigate'
    } catch {
      return false
    }
  })


  // Textarea auto-resize (zen + hero) with high precision
  const adjustHeight = useCallback(() => {
    // requestAnimationFrame을 사용하여 브라우저가 레이아웃을 확정한 직후의scrollHeight를 정확히 측정
    requestAnimationFrame(() => {
      if (zenFrogRef.current) {
        zenFrogRef.current.style.height = 'auto'
        zenFrogRef.current.style.height = `${zenFrogRef.current.scrollHeight}px`
      }
      if (heroRef.current) {
        heroRef.current.style.height = 'auto'
        heroRef.current.style.height = `${heroRef.current.scrollHeight}px`
      }
    })
  }, [])

  useEffect(() => {
    adjustHeight()
    // 애니메이션이나 전환 도중 발생할 수 있는 오차를 위해 다중 프레임 재계산
    const timeouts = [0, 100, 300].map(ms => setTimeout(adjustHeight, ms))
    return () => timeouts.forEach(clearTimeout)
  }, [oneThing, isZenMode, adjustHeight])

  // ResizeObserver를 제거하고 창 크기 조절 이벤트로 대체하여 불필요한 레이아웃 시프트를 방지
  useEffect(() => {
    window.addEventListener('resize', adjustHeight)
    return () => window.removeEventListener('resize', adjustHeight)
  }, [adjustHeight])

  const audioCtxRef = useRef(null)
  const noiseRef = useRef(null)
  const wasDwtRunning = useRef(false) // DWT 실행 상태를 젠 모드 진입 전에 저장
  const [isNoiseOn, setIsNoiseOn] = useState(false)
  const zenFrogRef = useRef(null)
  const heroRef = useRef(null)
  const dummyFocusRef = useRef(null)

  // ── Timer Precision & Catch-up ──────────────────────────────────────────────
  const lastTickRef = useRef(null) // Tracks the last timestamp the timer was ticked

  // Zen timer state
  const [zenFocusTimeSeconds, setZenFocusTimeSeconds] = useState(0)
  const [isZenTimerRunning, setIsZenTimerRunning] = useState(false)

  // Toast notification state
  const [toast, setToast] = useState({ message: '', visible: false })
  const toastTimerRef = useRef(null)

  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message: msg, visible: true })
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }))
    }, 1500) // 3s -> 1.5s (띠용 하고 들어가게)
  }, [])

  // Custom Confirm Dialogue state
  const [confirmConfig, setConfirmConfig] = useState({ visible: false, title: '', message: '', onConfirm: null })

  const askConfirm = useCallback((title, message, onConfirm) => {
    setConfirmConfig({ visible: true, title, message, onConfirm })
  }, [])

  const closeConfirm = () => setConfirmConfig(prev => ({ ...prev, visible: false }))

  const handleConfirmAction = () => {
    if (confirmConfig.onConfirm) confirmConfig.onConfirm()
    closeConfirm()
  }

  // ── Real-time heatmap for today (Multi-layered CMYK) ───────────────────────
  const todayString = currentTime.toDateString()
  const todayData = (heatmap && heatmap[todayString]) ? heatmap[todayString] : { qq_done: 0, qq_total: (quests ? quests.length : 0), qa_main: 0, qa_sub: 0, s: 0 }

  const todayRatio = useMemo(() => {
    try {
      const realToday = new Date().toDateString()
      const quDone = quests.filter(q => q.completed && q.completedAt === realToday).length
      const qR = quests.length > 0 ? quDone / quests.length : 0

      let score = 0
      todos.forEach(t => {
        if (t.status === 'done' && t.completedAt === realToday) score += 1
        else if (t.status === 'doing' && t.subtasks?.length > 0) {
          const sD = t.subtasks.filter(s => s.completed && s.completedAt === realToday).length
          score += (sD / t.subtasks.length) * 0.8
        }
      })
      const activeT = todos.filter(t => t.status !== 'done' || t.completedAt === realToday)
      const aR = activeT.length > 0 ? score / activeT.length : 0

      const tSec = 14400
      const totalS = (focusTimeSeconds || 0) + (zenFocusTimeSeconds || 0)
      const tR = Math.min(totalS / tSec, 1)

      return (qR + aR + tR) / 3
    } catch (e) { return 0 }
  }, [quests, todos, focusTimeSeconds, zenFocusTimeSeconds])

  // Atomic Update (Delayed to effect to avoid render-loop)
  useEffect(() => {
    const realToday = new Date().toDateString()
    const quDone = quests.filter(q => q.completed && q.completedAt === realToday).length
    let mC = 0, sC = 0, score = 0
    todos.forEach(t => {
      if (t.status === 'done' && t.completedAt === realToday) { mC++; score++ }
      else if (t.status === 'doing' && t.subtasks?.length > 0) {
        const sd = t.subtasks.filter(s => s.completed && s.completedAt === realToday).length
        score += (sd / t.subtasks.length) * 0.8
        sC += sd
      }
    })
    const activeT = todos.filter(t => t.status !== 'done' || t.completedAt === realToday)
    const qR = quests.length > 0 ? quDone / quests.length : 0
    const aR = activeT.length > 0 ? score / activeT.length : 0
    const totalS = (focusTimeSeconds || 0) + (zenFocusTimeSeconds || 0)
    const tR = Math.min(totalS / 14400, 1)

    setHeatmap(prev => ({
      ...prev,
      [realToday]: {
        s: totalS,
        qq_done: quDone,
        qq_total: quests.length,
        qa_main: mC,
        qa_sub: sC,
        qa_total: activeT.length,
        q: qR,
        a: aR,
        t: tR,
        total: (qR + aR + tR) / 3
      }
    }))
  }, [quests, todos, focusTimeSeconds, zenFocusTimeSeconds])

  // Persistence: Heatmap (Debounced for performance)
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem('hub-heatmap-v2', JSON.stringify(heatmap))
    }, 1000)
    return () => clearTimeout(id)
  }, [heatmap])

  // ── Daily reset (Real-time Guard) ──────────────────────────────────────────
  useEffect(() => {
    const today = currentTime.toDateString()
    if (today !== lastResetDate) {
      // 0. Guard: If timer is running, let the timer handle the reset to avoid race conditions
      if (isFocusTimerRunning) return

      // 1. Daily Quests 리셋
      setQuests(q => q.map(quest => ({ ...quest, completed: false, completedAt: null })))
      setFocusTimeSeconds(0)
      setZenFocusTimeSeconds(0)
      setLastResetDate(today)
      console.log(`[System] Idle daily reset completed for ${today}`)
    }
  }, [currentTime, lastResetDate, isFocusTimerRunning])

  // ── Auto-Archive Action Items (Lock -> Archive) ───────────────────────────
  useEffect(() => {
    const toArchive = todos.filter(t => t.status === 'done' && t.completedAt && t.completedAt !== todayString)

    if (toArchive.length > 0) {
      setArchivedTodos(prev => {
        // 이미 보관소에 있는 ID는 제외하고 추가 (중복 방지)
        const existingIds = new Set(prev.map(t => t.id))
        const newToArchive = toArchive.filter(t => !existingIds.has(t.id))
        return [...newToArchive, ...prev]
      })
      setTodos(prev => prev.filter(t => !(t.status === 'done' && t.completedAt && t.completedAt !== todayString)))
      console.log(`[System] Archived ${toArchive.length} past items. (Date: ${todayString})`)
    }
  }, [todos, todayString]) // todayString 의존성 추가로 자정 변경 시 즉시 실행

  useEffect(() => { localStorage.setItem('hub-archived-todos', JSON.stringify(archivedTodos)) }, [archivedTodos])

  // ── Live Clock (Precise for date/midnight checks) ───────────────────────────
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000) // 1s precision
    return () => clearInterval(id)
  }, [])

  // ── Focus & Zen Timers (Timestamp-based Catch-up) ──────────────────────────
  const performTick = useCallback(() => {
    if (!lastTickRef.current) return
    const nowMs = Date.now()
    const lastMs = lastTickRef.current
    const deltaMs = nowMs - lastMs

    // [Ultimate Guard] Time Travel Detection (System clock moved backwards)
    if (deltaMs < 0) {
      console.warn('[System] Time travel detected. Resetting tick reference.')
      lastTickRef.current = nowMs
      return
    }

    if (deltaMs >= 1000) {
      const totalDeltaSec = Math.floor(deltaMs / 1000)

      // Midnight split logic
      const lastDate = new Date(lastMs).toDateString()
      const nowDate = new Date(nowMs).toDateString()

      if (lastDate !== nowDate) {
        // Crossed midnight! Split the duration and Atomic Reset.
        const midnight = new Date(new Date(nowMs).setHours(0, 0, 0, 0)).getTime()
        const secToYesterday = Math.max(0, Math.floor((midnight - lastMs) / 1000))
        const secToToday = Math.max(0, totalDeltaSec - secToYesterday)

        // 1. Update yesterday's data explicitly
        if (secToYesterday > 0) {
          setHeatmap(prev => {
            const yesterdayData = prev[lastDate] || {}
            const currentSeconds = yesterdayData.s || 0
            const newSeconds = currentSeconds + secToYesterday
            const targetSec = 14400
            const newT = Math.min(newSeconds / targetSec, 1)
            const newTotal = ((yesterdayData.q || 0) + (yesterdayData.a || 0) + newT) / 3
            return {
              ...prev,
              [lastDate]: { ...yesterdayData, s: newSeconds, t: newT, total: newTotal }
            }
          })
        }

        // 2. Atomic Daily Reset (Merged)
        setQuests(q => q.map(quest => ({ ...quest, completed: false, completedAt: null })))
        setLastResetDate(nowDate)

        // 3. Set today's initial time
        if (isFocusTimerRunning) setFocusTimeSeconds(secToToday)
        if (isZenTimerRunning) setZenFocusTimeSeconds(secToToday)

        setCurrentTime(new Date())
        console.log(`[System] Atomic midnight transition for ${nowDate}`)
      } else {
        // Normal operation
        if (isFocusTimerRunning) setFocusTimeSeconds(s => s + totalDeltaSec)
        if (isZenTimerRunning) setZenFocusTimeSeconds(s => s + totalDeltaSec)
      }

      // Advance lastTick by the integer seconds we just added
      lastTickRef.current = lastMs + (totalDeltaSec * 1000)
      return totalDeltaSec
    }
    return 0
  }, [isFocusTimerRunning, isZenTimerRunning])

  useEffect(() => {
    let interval = null
    const isActive = isFocusTimerRunning || isZenTimerRunning

    if (isActive) {
      if (!lastTickRef.current) lastTickRef.current = Date.now()
      interval = setInterval(performTick, 1000)
    } else {
      lastTickRef.current = null
    }

    return () => { if (interval) clearInterval(interval) }
  }, [isFocusTimerRunning, isZenTimerRunning, performTick])

  // ── Persist ─────────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('hub-todos', JSON.stringify(todos)) }, [todos])
  useEffect(() => { localStorage.setItem('hub-quests', JSON.stringify(quests)) }, [quests])
  useEffect(() => { localStorage.setItem('hub-lastResetDate', JSON.stringify(lastResetDate)) }, [lastResetDate])
  useEffect(() => { localStorage.setItem('hub-focusTime', JSON.stringify(focusTimeSeconds)) }, [focusTimeSeconds])
  useEffect(() => { localStorage.setItem('hub-braindump', JSON.stringify(brainDump)) }, [brainDump])
  useEffect(() => { localStorage.setItem('hub-oneThing', JSON.stringify(oneThing)) }, [oneThing])
  useEffect(() => { localStorage.setItem('hub-zenFocus', JSON.stringify(zenFocus)) }, [zenFocus])

  // ── White Noise Toggle ──────────────────────────────────────────────────────
  const toggleNoise = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    if (isNoiseOn) {
      noiseRef.current?.source.stop()
      noiseRef.current = null
      setIsNoiseOn(false)
      // Cleanup AudioContext when not in use
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
    } else {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      noiseRef.current = createWhiteNoise(ctx)
      noiseRef.current.source.start()
      setIsNoiseOn(true)
    }
  }, [isNoiseOn])

  // Sync isZenMode (Simplified for always-fullscreen mode)
  useEffect(() => {
    if (!isZenMode) {
      window.chrome?.webview?.postMessage("zen:off")
      if (isNoiseOn) {
        noiseRef.current?.source.stop()
        noiseRef.current = null
        setIsNoiseOn(false)
      }
      if (zenFocusTimeSeconds > 0 || isZenTimerRunning) {
        const flushed = performTick() // Flush Zen timer before exiting
        setFocusTimeSeconds(s => s + zenFocusTimeSeconds + flushed)
        setZenFocusTimeSeconds(0)
      }
      setIsZenTimerRunning(false)
      if (wasDwtRunning.current) {
        setIsFocusTimerRunning(true)
        wasDwtRunning.current = false
      }
    } else {
      window.chrome?.webview?.postMessage("zen:on")
      if (isFocusTimerRunning) {
        const flushed = performTick() // Flush Focus timer before pausing for Zen
        wasDwtRunning.current = true
        setIsFocusTimerRunning(false)
        setFocusTimeSeconds(s => s + flushed) // Ensure flushed seconds are added to main counter immediately
      }
      if (!isNoiseOn && !noiseRef.current) {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        const ctx = audioCtxRef.current
        if (ctx.state === 'suspended') ctx.resume()
        noiseRef.current = createWhiteNoise(ctx)
        noiseRef.current.source.start()
        setIsNoiseOn(true)
      }
      setZenFocusTimeSeconds(0)
      setIsZenTimerRunning(true)
      lastTickRef.current = Date.now() // Ensure Zen timer starts from exactly now
    }
  }, [isZenMode, performTick])

  // (Moved helpers to Top Scope)

  // Pre-calculate 30 days of dates to avoid re-calculating inside render
  const heatmapDates = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return { ds: date.toDateString(), isToday: i === 29 }
    })
  }, [currentTime.toDateString()])


  // ── Backup / Restore ─────────────────────────────────────────────────────────
  const exportData = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      todos,
      archivedTodos, // 보관 데이터 포함
      quests,
      brainDump,
      heatmap,
      focusTimeSeconds,
      oneThing,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `00hub-backup-${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        askConfirm('데이터 복원', '백업 데이터를 복원할까요?\n현재 데이터는 덮어씌워집니다.', () => {
          // 중복 방지를 위해 ID 기반으로 병합하거나 덮어씌움
          // 여기서는 '덮어씌우기' 정책이므로 그대로 적용하되, 보관 데이터까지 포함
          if (data.todos) setTodos(migrateTodos(data.todos))
          if (data.archivedTodos) setArchivedTodos(migrateTodos(data.archivedTodos))
          if (data.quests) setQuests(migrateQuests(data.quests))
          if (data.brainDump !== undefined) setBrainDump(data.brainDump)
          if (data.heatmap) setHeatmap(migrateHeatmap(data.heatmap))
          if (data.focusTimeSeconds !== undefined) setFocusTimeSeconds(data.focusTimeSeconds)
          if (data.oneThing !== undefined) setOneThing(data.oneThing)
          showToast('복원 완료')
        })
      } catch {
        showToast('파일을 읽을 수 없습니다.\n올바른 파일인지 확인해주세요')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // reset input
  }

  // ── Todo handlers ────────────────────────────────────────────────────────────
  const addTodo = e => {
    e.preventDefault()
    if (!input.trim()) return
    setTodos([{ id: generateId(), text: input, status: 'todo' }, ...todos])
    setInput('')
  }
  const cycleStatus = id => {
    setTodos(todos.map(t => {
      if (t.id !== id) return t

      // [Guard] 오늘 이전에 완료된 항목은 상태 변경 방지
      if (t.status === 'done' && t.completedAt && t.completedAt !== todayString) {
        showToast('과거의 기록은 상태 변경이 불가능합니다')
        return t
      }

      const nextMap = { todo: 'doing', doing: 'done', done: 'todo' }
      const nextStatus = nextMap[t.status]

      return {
        ...t,
        status: nextStatus,
        completedAt: nextStatus === 'done' ? new Date().toDateString() : null
      }
    }))
  }
  const deleteTodo = id => {
    askConfirm('항목 삭제', '정말 이 항목을 영구히 삭제할까요?', () => {
      setTodos(todos.filter(t => t.id !== id))
    })
  }

  const addSubtask = (todoId, text) => {
    if (!text.trim()) return
    setTodos(todos.map(t => t.id === todoId ? {
      ...t,
      subtasks: [...(t.subtasks || []), { id: generateId(), text, completed: false }]
    } : t))
  }

  const toggleSubtask = (todoId, subId) => {
    setTodos(todos.map(t => t.id === todoId ? {
      ...t,
      subtasks: (t.subtasks || []).map(s => {
        if (s.id === subId) {
          // [Guard] 오늘 이전에 완료된 서브태스크는 상태 변경 방지
          if (s.completed && s.completedAt && s.completedAt !== todayString) {
            showToast('과거의 기록은 상태 변경이 불가능합니다')
            return s
          }

          const nextCompleted = !s.completed
          return {
            ...s,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toDateString() : null
          }
        }
        return s
      })
    } : t))
  }

  const deleteSubtask = (todoId, subId) => {
    askConfirm('세부 할 일 삭제', '정말 이 세부 할 일을 영구히 삭제할까요?', () => {
      setTodos(todos.map(t => t.id === todoId ? {
        ...t,
        subtasks: (t.subtasks || []).filter(s => s.id !== subId)
      } : t))
    })
  }

  const startEditTodo = (id, text) => {
    setEditingTodoId(id)
    setEditingTodoText(text)
  }
  const saveEditTodo = (id) => {
    if (!editingTodoText.trim()) return
    setTodos(todos.map(t => t.id === id ? { ...t, text: editingTodoText } : t))
    setEditingTodoId(null)
  }

  const startEditSubtask = (id, text) => {
    setEditingSubtaskId(id)
    setEditingSubtaskText(text)
  }
  const saveEditSubtask = (todoId, subId) => {
    if (!editingSubtaskText.trim()) return
    setTodos(todos.map(t => t.id === todoId ? {
      ...t,
      subtasks: (t.subtasks || []).map(s => s.id === subId ? { ...s, text: editingSubtaskText } : s)
    } : t))
    setEditingSubtaskId(null)
  }

  const handleTodoClick = (id) => cycleStatus(id)

  const toggleFocusTimer = () => {
    const nextRunning = !isFocusTimerRunning
    if (isFocusTimerRunning) {
      performTick() // Stop 시 즉시 Flush
    } else {
      lastTickRef.current = Date.now() // Start 시 기준점 초기화
    }
    setIsFocusTimerRunning(nextRunning)
  }

  const toggleExpand = (id, e) => {
    if (e) e.stopPropagation()
    setExpandedTodoIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleArchiveDate = (date) => {
    setExpandedArchiveDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  // ── Archive Editing ──────────────────────────────────────────────────────────
  const startEditArchive = (id, text) => {
    setEditingArchiveId(id)
    setEditingArchiveText(text)
  }

  const saveEditArchive = (id) => {
    if (!editingArchiveText.trim()) return
    setArchivedTodos(prev => prev.map(t => t.id === id ? { ...t, text: editingArchiveText } : t))
    setEditingArchiveId(null)
  }

  const deleteArchiveTodo = (id) => {
    askConfirm('보관 항목 삭제', '이 기록을 영구히 삭제할까요?', () => {
      setArchivedTodos(prev => prev.filter(t => t.id !== id))
    })
  }

  const startEditArchiveSub = (todoId, subId, text) => {
    setEditingArchiveSubId(subId)
    setEditingArchiveSubText(text)
  }

  const saveEditArchiveSub = (todoId, subId) => {
    if (!editingArchiveSubText.trim()) return
    setArchivedTodos(prev => prev.map(t => {
      if (t.id === todoId) {
        return {
          ...t,
          subtasks: (t.subtasks || []).map(s => s.id === subId ? { ...s, text: editingArchiveSubText } : s)
        }
      }
      return t
    }))
    setEditingArchiveSubId(null)
  }

  const deleteArchiveSubtask = (todoId, subId) => {
    askConfirm('보관 세부 할 일 삭제', '정말 이 항목을 보관함에서 지울까요?', () => {
      setArchivedTodos(prev => prev.map(t => {
        if (t.id === todoId) {
          return { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== subId) }
        }
        return t
      }))
    })
  }

  // ── Status meta ──────────────────────────────────────────────────────────────
  const statusMeta = {
    todo: { label: 'TODO', color: '#adb5bd' },
    doing: { label: 'DOING', color: 'var(--cmyk-yellow)' },
    done: { label: 'DONE', color: 'var(--cmyk-yellow)' },
  }

  // ── Quest handlers ───────────────────────────────────────────────────────────
  const addQuest = e => {
    e.preventDefault()
    if (!questInputValue.trim()) return
    setQuests([{ id: generateId(), text: questInputValue, completed: false }, ...quests])
    setQuestInputValue('')
  }
  const toggleQuest = id => setQuests(quests.map(q => {
    if (q.id === id) {
      const nextCompleted = !q.completed
      return {
        ...q,
        completed: nextCompleted,
        completedAt: nextCompleted ? new Date().toDateString() : null
      }
    }
    return q
  }))
  const deleteQuest = id => {
    askConfirm('목표 삭제', '정말 이 데일리 목표를 영구히 삭제할까요?', () => {
      setQuests(quests.filter(q => q.id !== id))
    })
  }

  const startEditQuest = (id, text) => {
    setEditingQuestId(id)
    setEditingQuestText(text)
  }
  const saveEditQuest = (id) => {
    if (!editingQuestText.trim()) return
    setQuests(quests.map(q => q.id === id ? { ...q, text: editingQuestText } : q))
    setEditingQuestId(null)
  }

  const handleQuestClick = (id) => toggleQuest(id)

  // ── Heatmap ──────────────────────────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  const getHeatmapLevel = ratio => {
    if (ratio === 0) return 0
    if (ratio < 0.5) return 1
    if (ratio < 0.75) return 2
    if (ratio < 1) return 3
    return 4
  }

  // ── Drag and Drop handlers ──────────────────────────────────────────────────
  const onDragStart = () => {
    // onDragStart의 blur는 visibility 핸들러로 이관했습니다. 
    // 필요 시 추가적인 드래그 전처리 로직이 들어갈 곳입니다.
  }

  const onDragEnd = (result) => {
    if (!result.destination) return

    const { source, destination, type } = result

    if (type === 'todos') {
      const items = Array.from(todos)
      const [reorderedItem] = items.splice(source.index, 1)
      items.splice(destination.index, 0, reorderedItem)
      setTodos(items)
    } else if (type === 'quests') {
      const items = Array.from(quests)
      const [reorderedItem] = items.splice(source.index, 1)
      items.splice(destination.index, 0, reorderedItem)
      setQuests(items)
    } else if (type.startsWith('archive-')) {
      if (source.droppableId !== destination.droppableId) return // 이중 안전장치
      const date = source.droppableId.replace('archive-', '')
      setArchivedTodos(prev => {
        // 기존 배열 프레임을 완전히 유지하며 해당 날짜의 항목만 인덱스 위치별로 교체(Patching)합니다.
        // 이를 통해 드래그 엔진이 인덱스를 잃어버리는 현상(애니메이션 끊김 현상)을 원천 차단합니다.
        const dateItems = prev.filter(t => (t.completedAt || 'Unknown Date') === date)
        const baseIndices = prev.map((t, i) => (t.completedAt || 'Unknown Date') === date ? i : -1).filter(i => i !== -1)

        const [reordered] = dateItems.splice(source.index, 1)
        dateItems.splice(destination.index, 0, reordered)

        const next = Array.from(prev)
        baseIndices.forEach((macroIndex, i) => {
          next[macroIndex] = dateItems[i]
        })
        return next
      })
    } else if (type.startsWith('subtasks-')) {
      const parentId = type.replace('subtasks-', '')
      setTodos(prevTodos => prevTodos.map(t => {
        if (t.id.toString() === parentId) {
          const newSub = Array.from(t.subtasks || [])
          const [reordered] = newSub.splice(source.index, 1)
          newSub.splice(destination.index, 0, reordered)
          return { ...t, subtasks: newSub }
        }
        return t
      }))
    }
  }

  return (
    <div className={`app-container ${isZenMode ? 'zen-mode' : ''} ${!isPageVisible ? 'app-paused' : ''}`}>
      <SplashScreen 
        isVisible={isSplashShowing} 
        onDismiss={() => {
          setIsSplashShowing(false)
          sessionStorage.setItem('hub-splash-shown', 'true')
        }} 
      />

      {isZenMode ? (
        <>
          <div className="live-clock zen-clock">
            <Clock hideDate={true} />
          </div>
          <div className="zen-content">

            <div className="zen-focus-task">
              <p className="zen-label">zen mode</p>
              <textarea
                ref={zenFrogRef}
                rows={1}
                className="zen-frog-input"
                value={oneThing || ''}
                onChange={e => setOneThing(e.target.value)}
                placeholder="오늘 제일 중요한 일은?"
                spellCheck="false"
              />
            </div>

            <div className="timer-display zen-timer">{formatFocus(zenFocusTimeSeconds || 0)}</div>

            {/* White noise control */}
            <button className={`btn-noise ${isNoiseOn ? 'noise-on' : ''}`} onClick={toggleNoise}>
              {isNoiseOn ? '백색소음 끄기' : '백색소음 켜기'}
            </button>
          </div>
          <button className="btn-exit-zen" onClick={() => setIsZenMode(false)}>✕</button>
        </>
      ) : (
        <>
          {/* 화면 활성화 시 포커스 스틸 버그 방어용 더미 요소 (WebView2 & RBD 캐시 무효화) */}
          <button
            ref={dummyFocusRef}
            style={{ position: 'fixed', top: '-1000px', left: '-1000px', opacity: 0 }}
            aria-hidden="true"
            tabIndex="-1"
          />
          <header className="header">
            <div>
              <h1>00Hub<span className="title-dot">.</span></h1>
            </div>
            <div className="header-actions">
              <div className="live-clock" onClick={() => setIsZenMode(true)} title="젠 모드 시작">
                <Clock />
              </div>
            </div>
          </header>

          {/* Chrome-style Overlay Control Bar */}
          <div className="fullscreen-overlay-trigger">
            <div
              className="fullscreen-overlay-bar"
              onClick={() => window.chrome?.webview?.postMessage("close")}
            >
              <span className="overlay-close-icon">×</span>
            </div>
          </div>

          {/* THE ONE THING — Hero Typography */}
          <div className="one-thing-hero">
            <textarea
              ref={heroRef}
              rows={1}
              className="one-thing-hero-input"
              value={oneThing}
              onChange={e => setOneThing(e.target.value)}
              placeholder="오늘 제일 중요한 일은?"
              spellCheck="false"
            />
          </div>

          {/* HEATMAP — full width at top */}
          <section className="card heatmap-card heatmap-top">
            <h2 className="card-title">Discipline Map</h2>
            <div className="heatmap-grid">
              {heatmapDates.map(({ ds, isToday }, i) => (
                <HeatmapCell
                  key={ds}
                  i={i}
                  ds={ds}
                  rawData={heatmap[ds]}
                  isToday={isToday}
                  quests={quests}
                  todos={todos}
                  archivedTodos={archivedTodos}
                  onMouseEnter={setHeatmapTooltip}
                  onMouseLeave={() => setHeatmapTooltip(null)}
                />
              ))}
            </div>

            <div className="heatmap-info-bar">
              <strong>{heatmapTooltip ? (heatmapTooltip.label || '') : `오늘 (${new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })})`}</strong>
              <div className="heatmap-info-stats" style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--cmyk-yellow)' }}>
                  Acts {heatmapTooltip ? `(메인 ${heatmapTooltip.a_main || 0}, 서브 ${heatmapTooltip.a_sub || 0})` : `(메인 ${todayData?.qa_main || 0}, 서브 ${todayData?.qa_sub || 0})`}
                </span>
                <span style={{ color: 'var(--cmyk-magenta)' }}>
                  Quests {heatmapTooltip ? (
                    `(${heatmapTooltip.q_done || 0}/${heatmapTooltip.q_total || 0})`
                  ) : `(${todayData?.qq_done || 0}/${quests?.length || 0})`}
                </span>
                <span style={{ color: 'var(--cmyk-cyan)' }}>
                  Focus {heatmapTooltip ? `(${formatFocus(heatmapTooltip.focusSeconds || 0)})` : `(${formatFocus((focusTimeSeconds || 0) + (zenFocusTimeSeconds || 0))})`}
                </span>
              </div>
            </div>

          </section>

          <main className="dashboard-grid">
            {/* 메인 2단 컬럼 시작 */}
            <div className="main-content-stack">
              {/* ACTION ITEMS — list style */}
              <section className="card action-items">
                <div className="card-header-group">
                  <h2 className="card-title">Action Items</h2>
                  <div className="card-header-tabs">
                    <button
                      className={`tab-item ${activeActionTab === 'active' ? 'active' : ''}`}
                      onClick={() => setActiveActionTab('active')}
                    >
                      Active
                    </button>
                    <button
                      className={`tab-item ${activeActionTab === 'archive' ? 'active' : ''}`}
                      onClick={() => setActiveActionTab('archive')}
                    >
                      Archive
                    </button>
                  </div>
                </div>

                {activeActionTab === 'active' ? (
                  <>
                    <form onSubmit={addTodo} className="todo-input-group">
                      <input
                        type="text"
                        className="todo-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="할 일 추가... Enter ↵"
                      />
                    </form>

                    <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                      <Droppable droppableId="todos-list" type="todos">
                        {(provided) => (
                          <div
                            className="todo-list"
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            {todos.length === 0 && (
                              <div className="empty-column">할 일을 추가해보세요!</div>
                            )}
                            {todos.map((todo, index) => (
                              <Draggable key={todo.id.toString()} draggableId={todo.id.toString()} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    className={`todo-item status-${todo.status} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{ ...provided.draggableProps.style }}
                                  >
                                    {/* Status badge — click to cycle */}
                                    <button
                                      className={`status-badge ${todo.status === 'done' && todo.completedAt && todo.completedAt !== todayString ? 'locked' : ''}`}
                                      style={{ borderColor: (statusMeta[todo.status]?.color || '#adb5bd'), color: (statusMeta[todo.status]?.color || '#adb5bd') }}
                                      onClick={() => cycleStatus(todo.id)}
                                      title={todo.status === 'done' && todo.completedAt && todo.completedAt !== todayString ? '과거 완료 항목 (잠김)' : '클릭해서 상태 변경'}
                                    >
                                      {(statusMeta[todo.status]?.label || 'TODO')}
                                    </button>

                                    <div className="todo-main-content">
                                      <div className="todo-body">
                                        {editingTodoId === todo.id ? (
                                          <input
                                            type="text"
                                            className="todo-edit-input"
                                            value={editingTodoText}
                                            onChange={e => setEditingTodoText(e.target.value)}
                                            onBlur={() => saveEditTodo(todo.id)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') saveEditTodo(todo.id)
                                              if (e.key === 'Escape') setEditingTodoId(null)
                                            }}
                                            autoFocus
                                          />
                                        ) : (
                                          <div
                                            className={`todo-text ${todo.status === 'done' ? 'done-text' : ''}`}
                                            onClick={() => handleTodoClick(todo.id)}
                                            style={{ cursor: 'pointer' }}
                                          >
                                            {todo.text} {todo.status === 'done' && todo.completedAt && todo.completedAt !== todayString && '🔒'}
                                          </div>
                                        )}

                                        {todo.status === 'doing' && (
                                          <div className="subtasks-container">
                                            <Droppable droppableId={`subtasks-${todo.id}`} type={`subtasks-${todo.id}`}>
                                              {(provided) => (
                                                <div
                                                  className="subtask-list"
                                                  {...provided.droppableProps}
                                                  ref={provided.innerRef}
                                                >
                                                  {(todo.subtasks || []).map((s, sIndex) => (
                                                    <Draggable key={s.id.toString()} draggableId={s.id.toString()} index={sIndex}>
                                                      {(provided, snapshot) => (
                                                        <div
                                                          className={`subtask-item ${s.completed && s.completedAt && s.completedAt !== todayString ? 'locked' : ''} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                                          ref={provided.innerRef}
                                                          {...provided.draggableProps}
                                                          {...provided.dragHandleProps}
                                                          style={{ ...provided.draggableProps.style }}
                                                        >
                                                          <input
                                                            type="checkbox"
                                                            checked={s.completed}
                                                            onChange={() => toggleSubtask(todo.id, s.id)}
                                                          />
                                                          {editingSubtaskId === s.id ? (
                                                            <input
                                                              type="text"
                                                              className="todo-edit-input subtask-edit-input"
                                                              value={editingSubtaskText}
                                                              onChange={e => setEditingSubtaskText(e.target.value)}
                                                              onBlur={() => saveEditSubtask(todo.id, s.id)}
                                                              onKeyDown={e => {
                                                                if (e.key === 'Enter') saveEditSubtask(todo.id, s.id)
                                                                if (e.key === 'Escape') setEditingSubtaskId(null)
                                                              }}
                                                              autoFocus
                                                            />
                                                          ) : (
                                                            <span
                                                              className={s.completed ? 'completed' : ''}
                                                              onClick={() => toggleSubtask(todo.id, s.id)}
                                                              style={{ cursor: 'pointer', flex: 1 }}
                                                            >
                                                              {s.text} {s.completed && s.completedAt && s.completedAt !== todayString && '🔒'}
                                                            </span>
                                                          )}
                                                          <div className="subtask-actions">
                                                            {editingSubtaskId !== s.id && (
                                                              <>
                                                                <button className="btn-edit-subtask" title="세부 할일 수정" onClick={() => startEditSubtask(s.id, s.text)}>✎</button>
                                                                <button className="btn-delete-subtask" title="세부 할일 삭제" onClick={() => deleteSubtask(todo.id, s.id)}>✕</button>
                                                              </>
                                                            )}
                                                          </div>
                                                        </div>
                                                      )}
                                                    </Draggable>
                                                  ))}
                                                  {provided.placeholder}
                                                </div>
                                              )}
                                            </Droppable>
                                            <input
                                              type="text"
                                              className="subtask-input"
                                              placeholder="+ 세부 할일 추가..."
                                              onKeyDown={e => {
                                                if (e.nativeEvent.isComposing) return
                                                if (e.key === 'Enter' && e.target.value.trim()) {
                                                  addSubtask(todo.id, e.target.value)
                                                  e.target.value = ''
                                                }
                                              }}
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {editingTodoId !== todo.id && (
                                        <div className="todo-actions">
                                          <button className="btn-action edit" title="수정" onClick={() => startEditTodo(todo.id, todo.text)}>✎</button>
                                          <button className="btn-action delete" title="삭제" onClick={() => deleteTodo(todo.id)}>✕</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </>
                ) : (
                  <div className="inline-archive-container">
                    {archivedTodos.length === 0 ? (
                      <div className="empty-archive">보관된 항목이 없습니다.</div>
                    ) : (
                      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
                        {Object.keys(archivedTodos.reduce((acc, todo) => {
                          const date = todo.completedAt || 'Unknown Date'
                          if (!acc[date]) acc[date] = []
                          acc[date].push(todo)
                          return acc
                        }, {})).sort((a, b) => new Date(b) - new Date(a)).map(date => {
                          const isExpanded = expandedArchiveDates.has(date) // Default collapsed
                          const group = archivedTodos.filter(t => (t.completedAt || 'Unknown Date') === date)

                          return (
                            <div key={date} className={`archive-group ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
                              <h4 className="archive-date" onClick={() => toggleArchiveDate(date)}>
                                <span className="date-toggle-icon">▾</span>
                                {date === 'Unknown Date' ? date : new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                <span className="group-count">{group.length} items</span>
                              </h4>

                              {isExpanded && (
                                <Droppable droppableId={`archive-${date}`} type={`archive-${date}`}>
                                  {(provided) => (
                                    <div
                                      className="archive-list"
                                      {...provided.droppableProps}
                                      ref={provided.innerRef}
                                    >
                                      {group.map((todo, idx) => (
                                        <Draggable key={todo.id.toString()} draggableId={todo.id.toString()} index={idx}>
                                          {(provided, snapshot) => (
                                            <div
                                              className={`archive-item ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              {...provided.dragHandleProps}
                                              style={{
                                                ...provided.draggableProps.style,
                                                // CSS의 transition: all 이 react-beautiful-dnd의 위치 계산을 방해하여
                                                // '휙 날아오는' 이중 애니메이션이 발생하는 것을 막기 위한 인라인 덮어쓰기
                                                transition: provided.draggableProps.style?.transition || 'background 0.2s, box-shadow 0.2s, border-color 0.2s'
                                              }}
                                            >
                                              <div className="archive-item-main">
                                                <div className="archive-item-content">
                                                  {editingArchiveId === todo.id ? (
                                                    <input
                                                      type="text"
                                                      className="archive-edit-input"
                                                      value={editingArchiveText}
                                                      onChange={e => setEditingArchiveText(e.target.value)}
                                                      onBlur={() => saveEditArchive(todo.id)}
                                                      onKeyDown={e => {
                                                        if (e.key === 'Enter') saveEditArchive(todo.id)
                                                        if (e.key === 'Escape') setEditingArchiveId(null)
                                                      }}
                                                      autoFocus
                                                    />
                                                  ) : (
                                                    <span className="archive-item-text">{todo.text}</span>
                                                  )}

                                                  {(todo.subtasks || []).length > 0 && (
                                                    <button
                                                      className={`btn-toggle-subtasks small ${expandedTodoIds.has(todo.id) ? 'expanded' : ''}`}
                                                      onClick={(e) => toggleExpand(todo.id, e)}
                                                    >
                                                      <span className="toggle-icon">▾</span>
                                                      <span className="subtasks-count">{(todo.subtasks || []).length}</span>
                                                    </button>
                                                  )}
                                                </div>

                                                <div className="archive-item-actions">
                                                  <button className="btn-action edit" title="수정" onClick={() => startEditArchive(todo.id, todo.text)}>✎</button>
                                                  <button className="btn-action delete" title="삭제" onClick={() => deleteArchiveTodo(todo.id)}>✕</button>
                                                </div>
                                              </div>

                                              {expandedTodoIds.has(todo.id) && todo.subtasks?.length > 0 && (
                                                <div className="archive-subtasks">
                                                  {todo.subtasks.map(s => (
                                                    <div key={s.id} className="archive-subtask">
                                                      <div className="archive-subtask-body">
                                                        {editingArchiveSubId === s.id ? (
                                                          <input
                                                            type="text"
                                                            className="archive-edit-input sub"
                                                            value={editingArchiveSubText}
                                                            onChange={e => setEditingArchiveSubText(e.target.value)}
                                                            onBlur={() => saveEditArchiveSub(todo.id, s.id)}
                                                            onKeyDown={e => {
                                                              if (e.key === 'Enter') saveEditArchiveSub(todo.id, s.id)
                                                              if (e.key === 'Escape') setEditingArchiveSubId(null)
                                                            }}
                                                            autoFocus
                                                          />
                                                        ) : (
                                                          <span className={s.completed ? 'completed' : ''}>
                                                            {s.completed ? '✓' : '○'} {s.text}
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div className="archive-subtask-actions">
                                                        <button className="btn-edit-subtask" title="세부 할일 수정" onClick={() => startEditArchiveSub(todo.id, s.id, s.text)}>✎</button>
                                                        <button className="btn-delete-subtask" title="세부 할일 삭제" onClick={() => deleteArchiveSubtask(todo.id, s.id)}>✕</button>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              )}
                            </div>
                          )
                        })}
                      </DragDropContext>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* SIDEBAR */}
            <div className="sidebar-stack">
              {/* FOCUS TIMER */}
              <section className="card timer-card">
                <div className="card-header-group">
                  <h2 className="card-title">Focus Timer</h2>
                  {isFocusTimerRunning && <span className="timer-status-dot" />}
                </div>
                <div className="timer-display">{formatFocus(focusTimeSeconds)}</div>
                <div className="timer-controls">
                  <button
                    className={`btn-timer ${isFocusTimerRunning ? 'pause' : 'start'}`}
                    onClick={toggleFocusTimer}
                  >
                    {isFocusTimerRunning ? <><span className="timer-icon pause-icon">⏸</span> Pause</> : <><span className="timer-icon play-icon">▶</span> Focus</>}
                  </button>
                  <button
                    className="btn-timer reset"
                    onClick={() => {
                      performTick()
                      setIsFocusTimerRunning(false)
                      askConfirm('집중 시간 리셋', '오늘 집중 시간을 리셋할까요?', () => setFocusTimeSeconds(0))
                    }}
                  >↺ Reset</button>
                </div>
              </section>

              {/* DAILY QUESTS */}
              <section className="card quest-card">
                <div className="card-header-group">
                  <h2 className="card-title">Daily Quests</h2>
                  <span className="quest-progress"><span className="current">{todayData?.qq_done || quests.filter(q => q.completed && q.completedAt === todayString).length}</span>/{quests.length}</span>
                </div>

                <form onSubmit={addQuest} className="quest-input-group">
                  <input
                    type="text"
                    className="quest-input"
                    placeholder="새 습관 추가... Enter ↵"
                    value={questInputValue}
                    onChange={e => setQuestInputValue(e.target.value)}
                  />
                </form>

                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="quests-list" type="quests">
                    {(provided) => (
                      <ul
                        className="quest-list"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {quests.length === 0 && (
                          <div className="empty-column">새 습관을 추가해보세요!</div>
                        )}
                        {quests.map((quest, index) => (
                          <Draggable key={quest.id.toString()} draggableId={quest.id.toString()} index={index}>
                            {(provided, snapshot) => (
                              <li
                                className={`quest-item ${quest.completed ? 'quest-completed' : ''} ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{ ...provided.draggableProps.style }}
                              >
                                <div className="quest-content">
                                  <div className="quest-icon" onClick={() => toggleQuest(quest.id)}>{quest.completed ? '✦' : '✧'}</div>
                                  {editingQuestId === quest.id ? (
                                    <input
                                      type="text"
                                      className="quest-edit-input"
                                      value={editingQuestText}
                                      onChange={e => setEditingQuestText(e.target.value)}
                                      onBlur={() => saveEditQuest(quest.id)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') saveEditQuest(quest.id)
                                        if (e.key === 'Escape') setEditingQuestId(null)
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span
                                      className="quest-text"
                                      onClick={() => handleQuestClick(quest.id)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      {quest.text}
                                    </span>
                                  )}
                                </div>
                                {editingQuestId !== quest.id && (
                                  <div className="quest-actions">
                                    <button className="btn-action edit" title="수정" onClick={e => { e.stopPropagation(); startEditQuest(quest.id, quest.text) }}>✎</button>
                                    <button className="btn-action delete" onClick={e => { e.stopPropagation(); deleteQuest(quest.id) }}>✕</button>
                                  </div>
                                )}
                              </li>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </ul>
                    )}
                  </Droppable>
                </DragDropContext>
              </section>

              {/* BRAIN DUMP */}
              <section className="card feature-card">
                <div className="brain-dump-header">
                  <h2 className="card-title">Brain Dump</h2>
                  {brainDump && (
                    <button
                      className="btn-clear-dump"
                      onClick={() => { askConfirm('브레인 덤프 삭제', '모든 내용을 비울까요?', () => setBrainDump('')) }}
                    >🗑 지우기</button>
                  )}
                </div>
                <textarea
                  className="brain-dump-input"
                  placeholder="머릿속을 비워두세요. 아이디어, 잡생각, 뭐든..."
                  value={brainDump}
                  onChange={e => setBrainDump(e.target.value)}
                  spellCheck="false"
                />
              </section>
            </div>
            {/* SETTINGS / DATA REMOVED FROM SIDEBAR */}
          </main>

          <footer className="footer">
            <div className="footer-actions">
              <button className="btn-footer-minimal" onClick={exportData} title="데이터 내보내기">📤 Export Data</button>
              <label className="btn-footer-minimal" title="데이터 가져오기">
                📥 Import Data
                <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
              </label>
            </div>
            <p className="footer-v">00Hub</p>
          </footer>
        </>
      )}

      {/* Global Toast Notification (Unified Placement outside view branches) */}
      <div className={`toast-container ${toast.visible ? 'visible' : ''}`}>
        <div className="toast-content">
          <span className="toast-icon">✦</span>
          <span className="toast-message">{toast.message}</span>
        </div>
      </div>

      {/* Premium Confirm Modal */}
      {confirmConfig.visible && (
        <div className="modal-overlay" onClick={closeConfirm}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{confirmConfig.title}</h3>
            <p className="modal-message">{confirmConfig.message}</p>
            <div className="modal-actions">
              <button className="btn-modal btn-cancel" onClick={closeConfirm}>취소</button>
              <button className="btn-modal btn-confirm" onClick={handleConfirmAction}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
