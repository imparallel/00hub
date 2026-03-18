import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import './App.css'

// ── Components: Optimized & Memoized ──────────────────────────────────────────

const Clock = () => {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const formatTime = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDate = d => d.toLocaleDateString('ko-KR', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div className="live-clock-wrapper">
      <div className="clock-time">{formatTime(time)}</div>
      <div className="clock-date">{formatDate(time)}</div>
    </div>
  )
}

const HeatmapCell = memo(({ i, ds, rawData, isToday, quests, todos, onMouseEnter, onMouseLeave }) => {
  const targetFocusSeconds = 14400
  let data = { q: 0, a: 0, t: 0, total: 0 }
  if (typeof rawData === 'number') {
    data = { q: rawData, a: rawData, t: rawData, total: rawData }
  } else if (rawData) {
    data = rawData
  }

  const label = new Date(ds).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
  const pctTotal = Math.round(data.total * 100)
  const pctQ = Math.round(data.q * 100)
  const pctA = Math.round(data.a * 100)
  const currentTSeconds = data.s !== undefined ? data.s : (data.t * 14400)
  const displayFocusRatio = Math.min(currentTSeconds / targetFocusSeconds, 1)
  const pctT = Math.round(displayFocusRatio * 100)

  // Recovery logic for tooltip data
  const getLegacyCounts = () => {
    const q_done = quests.filter(q => q.completed && q.completedAt === ds).length
    const q_total = data.q > 0 ? (q_done > 0 ? Math.round(q_done / data.q) : Math.round(1 / data.q)) : 0
    let a_main = 0, a_sub = 0
    todos.forEach(t => {
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
      style={{ '--pct-q': pctQ, '--pct-a': pctA, '--pct-t': pctT, '--pct-w': minPct, '--pct-total': pctTotal }}
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
function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('hub-todos')
    if (saved) {
      const parsed = JSON.parse(saved)
      const yesterday = new Date('2026-03-13').toDateString()
      const migrated = parsed.map(t => {
        let item = t
        if (t.completed !== undefined) {
          const status = t.completed ? 'done' : 'todo'
          const { completed: _c, ...rest } = t
          item = { ...rest, status }
        }
        if (item.status === 'done' && !item.completedAt) {
          item = { ...item, completedAt: yesterday }
        }
        if (item.subquests || item.subtasks) {
          const rawSubtasks = item.subtasks || item.subquests || []
          item.subtasks = rawSubtasks.map(s => {
            if (s.completed && !s.completedAt) return { ...s, completedAt: yesterday }
            return s
          })
          delete item.subquests
        }
        return item
      })
      const seen = new Set()
      return migrated.filter(t => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })
    }
    return []
  })
  const [archivedTodos, setArchivedTodos] = useState(() => {
    const saved = localStorage.getItem('hub-archived-todos')
    if (!saved) return []
    const parsed = JSON.parse(saved)
    const seen = new Set()
    return parsed.filter(t => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
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
    const saved = localStorage.getItem('hub-quests')
    if (saved) {
      const parsed = JSON.parse(saved)
      const yesterday = new Date('2026-03-13').toDateString()
      const migrated = parsed.map(q => {
        if (q.completed && !q.completedAt) return { ...q, completedAt: yesterday }
        return q
      })
      const seen = new Set()
      return migrated.filter(q => {
        if (seen.has(q.id)) return false
        seen.add(q.id)
        return true
      })
    }
    return [
      { id: 1, text: '물 2L 마시기', completed: false },
      { id: 2, text: '30분 집중하기', completed: false }
    ]
  })

  // Edit states for quests
  const [editingQuestId, setEditingQuestId] = useState(null)
  const [editingQuestText, setEditingQuestText] = useState('')

  const [input, setInput] = useState('')
  const [questInputValue, setQuestInputValue] = useState('')
  const [lastResetDate, setLastResetDate] = useState(() => {
    const saved = localStorage.getItem('hub-lastResetDate')
    return saved ? JSON.parse(saved) : new Date().toDateString()
  })

  // Heatmap: { dateString: ratio (0~1) }
  const [heatmap, setHeatmap] = useState(() => {
    const saved = localStorage.getItem('hub-heatmap-v2')
    let data = saved ? JSON.parse(saved) : {}

    // [Migration] 3h -> 4h Goal Scaling (One-time)
    const migrationFlag = 'hub-goal-migrated-v4h'
    if (!localStorage.getItem(migrationFlag)) {
      const migrated = {}
      Object.keys(data).forEach(date => {
        const entry = data[date]
        if (typeof entry === 'object') {
          const newT = entry.t * 0.75
          const newTotal = (entry.q + entry.a + newT) / 3
          migrated[date] = { ...entry, t: newT, total: newTotal }
        } else {
          migrated[date] = entry * 0.75
        }
      })
      data = migrated
      localStorage.setItem('hub-heatmap-v2', JSON.stringify(data))
      localStorage.setItem(migrationFlag, 'true')
      console.log('[System] Goal migration (3h->4h) completed: Past data scaled by 0.75.')
    }
    
    // [Migration] Action Items Denominator Fix (Past Data Repair)
    const repairFlag = 'hub-heatmap-repair-v1'
    if (!localStorage.getItem(repairFlag)) {
      const repaired = { ...data }
      const allTodos = JSON.parse(localStorage.getItem('hub-todos') || '[]')
      
      Object.keys(repaired).forEach(dateStr => {
        const entry = repaired[dateStr]
        if (typeof entry !== 'object') return
        
        const targetDate = new Date(dateStr)
        targetDate.setHours(23, 59, 59, 999)
        const targetMaxTs = targetDate.getTime()
        targetDate.setHours(0, 0, 0, 0)
        const targetMinTs = targetDate.getTime()
        
        let score = 0
        let activeCount = 0
        
        allTodos.forEach(t => {
          const createdAt = t.id
          if (createdAt > targetMaxTs) return // 이 날 이후 생성됨
          
          const completedTs = t.completedAt ? new Date(t.completedAt).setHours(0,0,0,0) : Infinity
          
          if (completedTs < targetMinTs) return // 이 날 이전에 이미 완료됨
          
          // 이 날 기준 활성/완료 항목임
          activeCount++
          if (completedTs === targetMinTs) {
            // 이 날 완료함 (메인 점수)
            score += 1
          } else if (t.subtasks?.length > 0) {
            // 이 날 완료한 서브태스크가 있는지 확인
            const subDoneToday = t.subtasks.filter(s => {
              if (!s.completed || !s.completedAt) return false
              return new Date(s.completedAt).setHours(0,0,0,0) === targetMinTs
            }).length
            score += (subDoneToday / t.subtasks.length) * 0.8
          }
        })
        
        if (activeCount > 0) {
          const newA = score / activeCount
          const newTotal = (entry.q + newA + entry.t) / 3
          repaired[dateStr] = { ...entry, a: newA, total: newTotal, qa_total: activeCount }
        }
      })
      data = repaired
      localStorage.setItem('hub-heatmap-v2', JSON.stringify(data))
      localStorage.setItem(repairFlag, 'true')
      console.log('[System] Heatmap repair completed: Past Action Items ratios recalculated.')
    }

    return data
  })
  const [heatmapTooltip, setHeatmapTooltip] = useState(null)

  const [isPageVisible, setIsPageVisible] = useState(true)
  useEffect(() => {
    const handleVisibility = () => setIsPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handleVisibility)
    
    // WebView2 런처로부터 가시성 메시지 수신
    const handleMessage = (e) => {
      if (e.data === 'visibility:hidden') setIsPageVisible(false)
      if (e.data === 'visibility:visible') setIsPageVisible(true)
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
    const saved = localStorage.getItem('hub-focusTime')
    return saved ? JSON.parse(saved) : 0
  })
  const [isFocusTimerRunning, setIsFocusTimerRunning] = useState(false)

  const [brainDump, setBrainDump] = useState(() => {
    const saved = localStorage.getItem('hub-braindump')
    return saved ? JSON.parse(saved) : ''
  })

  const [oneThing, setOneThing] = useState(() => {
    const saved = localStorage.getItem('hub-oneThing')
    return saved ? JSON.parse(saved) : ''
  })

  const [isZenMode, setIsZenMode] = useState(false)
  // eslint-disable-next-line no-unused-vars
  const [zenFocus, setZenFocus] = useState(() => {
    const saved = localStorage.getItem('hub-zenFocus')
    return saved ? JSON.parse(saved) : ''
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

  // ResizeObserver를 사용하여 어떤 이유로든 크기가 변할 때 즉시 대응
  useEffect(() => {
    if (!window.ResizeObserver) {
      window.addEventListener('resize', adjustHeight)
      return () => window.removeEventListener('resize', adjustHeight)
    }

    const observer = new ResizeObserver(() => {
      adjustHeight()
    })

    if (zenFrogRef.current) observer.observe(zenFrogRef.current)
    if (heroRef.current) observer.observe(heroRef.current)

    return () => observer.disconnect()
  }, [adjustHeight])

  const audioCtxRef = useRef(null)
  const noiseRef = useRef(null)
  const wasDwtRunning = useRef(false)  // DWT 실행 상태를 젠 모드 진입 전에 저장
  const [isNoiseOn, setIsNoiseOn] = useState(false)
  const zenFrogRef = useRef(null)
  const heroRef = useRef(null)

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
    }, 3000)
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

  // 1. Quests completion ratio (Magenta) - Only count those completed TODAY
  const completedQuests = quests.filter(q => q.completed && q.completedAt === todayString).length
  const questsRatio = quests.length > 0 ? completedQuests / quests.length : 0

  // 2. Action Items (Yellow) - Raw counts and weighted ratio
  let qa_main = 0
  let qa_sub = 0
  let totalActionScore = 0
  if (todos.length > 0) {
    todos.forEach(t => {
      if (t.status === 'done' && t.completedAt === todayString) {
        totalActionScore += 1
        qa_main += 1
      }
      else if (t.status === 'doing' && t.subtasks?.length > 0) {
        const subCompletedToday = t.subtasks.filter(s => s.completed && s.completedAt === todayString).length
        totalActionScore += (subCompletedToday / t.subtasks.length) * 0.8
        qa_sub += subCompletedToday
      }
    })
  }
  const activeTodosForToday = todos.filter(t => t.status !== 'done' || t.completedAt === todayString)
  const todosRatio = activeTodosForToday.length > 0 ? totalActionScore / activeTodosForToday.length : 0

  // 3. Focus Timer ratio (Cyan) - Target: 4 hours = 14400 seconds (Updated from 3h)
  const targetFocusSeconds = 14400
  const totalFocusSeconds = focusTimeSeconds + zenFocusTimeSeconds
  const focusRatio = Math.min(totalFocusSeconds / targetFocusSeconds, 1)

  // Combined score for the total (still used for info bar calculation)
  const todayRatio = (questsRatio + todosRatio + focusRatio) / 3

  // Update today's layered data in heatmap (Raw data first)
  useEffect(() => {
    setHeatmap(prev => {
      const updated = {
        ...prev,
        [todayString]: {
          s: totalFocusSeconds,      // Focus seconds (Raw)
          qq_done: completedQuests,  // Quest done count (Raw)
          qq_total: quests.length,   // Quest total count (Raw)
          qa_main: qa_main,          // Action main done count (Raw)
          qa_sub: qa_sub,            // Action sub done count (Raw)
          qa_total: activeTodosForToday.length, // Action total count (Denominator)
          q: questsRatio,   // Calculated Magenta ratio for visual
          a: todosRatio,    // Calculated Yellow ratio for visual
          t: focusRatio,    // Calculated Cyan ratio for visual
          total: todayRatio // Overall average
        }
      }
      localStorage.setItem('hub-heatmap-v2', JSON.stringify(updated))
      return updated
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests, todos, totalFocusSeconds])

  // ── Daily reset (Real-time) ────────────────────────────────────────────────
  useEffect(() => {
    const today = currentTime.toDateString()
    if (today !== lastResetDate) {
      // 1. Daily Quests 리셋
      setQuests(q => q.map(quest => ({ ...quest, completed: false, completedAt: null })))

      // 2. 집중 타이머 리셋 (0초부터 다시 시작)
      setFocusTimeSeconds(0)
      setZenFocusTimeSeconds(0)

      // 3. 리셋 날짜 업데이트
      setLastResetDate(today)

      console.log(`[System] Daily reset completed for ${today}`)
    }
  }, [currentTime, lastResetDate])

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

  // ── Live Clock (Only for date/midnight checks, not for display) ──────────────
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 10000) // Reduced frequency
    return () => clearInterval(id)
  }, [])

  // ── Focus Timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let interval = null
    if (isFocusTimerRunning) {
      interval = setInterval(() => setFocusTimeSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [isFocusTimerRunning])

  // ── Zen Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let interval = null
    if (isZenTimerRunning) {
      interval = setInterval(() => setZenFocusTimeSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [isZenTimerRunning])

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
      if (zenFocusTimeSeconds > 0) {
        setFocusTimeSeconds(s => s + zenFocusTimeSeconds)
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
        wasDwtRunning.current = true
        setIsFocusTimerRunning(false)
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
    }
  }, [isZenMode])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const formatTime = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDate = d => d.toLocaleDateString('ko-KR', { weekday: 'long', month: 'short', day: 'numeric' })
  const formatFocus = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

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
          if (data.todos) setTodos(data.todos)
          if (data.archivedTodos) setArchivedTodos(data.archivedTodos)
          if (data.quests) setQuests(data.quests)
          if (data.brainDump !== undefined) setBrainDump(data.brainDump)
          if (data.heatmap) setHeatmap(data.heatmap)
          if (data.focusTimeSeconds !== undefined) setFocusTimeSeconds(data.focusTimeSeconds)
          if (data.oneThing !== undefined) setOneThing(data.oneThing)
          showToast('복원 완료!')
        })
      } catch {
        showToast('파일을 읽을 수 없습니다.\n올바른 파일인지 확인해주세요.')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // reset input
  }

  // ── Todo handlers ────────────────────────────────────────────────────────────
  const addTodo = e => {
    e.preventDefault()
    if (!input.trim()) return
    setTodos([{ id: Date.now(), text: input, status: 'todo' }, ...todos])
    setInput('')
  }
  const cycleStatus = id => {
    setTodos(todos.map(t => {
      if (t.id !== id) return t

      // [Guard] 오늘 이전에 완료된 항목은 상태 변경 방지
      if (t.status === 'done' && t.completedAt && t.completedAt !== todayString) {
        showToast('과거의 기록은 상태 변경이 불가능합니다. 🔒')
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
  const deleteTodo = id => setTodos(todos.filter(t => t.id !== id))

  const addSubtask = (todoId, text) => {
    if (!text.trim()) return
    setTodos(todos.map(t => t.id === todoId ? {
      ...t,
      subtasks: [...(t.subtasks || []), { id: Date.now(), text, completed: false }]
    } : t))
  }

  const toggleSubtask = (todoId, subId) => {
    setTodos(todos.map(t => t.id === todoId ? {
      ...t,
      subtasks: (t.subtasks || []).map(s => {
        if (s.id === subId) {
          // [Guard] 오늘 이전에 완료된 서브태스크는 상태 변경 방지
          if (s.completed && s.completedAt && s.completedAt !== todayString) {
            showToast('과거의 기록은 상태 변경이 불가능합니다. 🔒')
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
    setTodos(todos.map(t => t.id === todoId ? {
      ...t,
      subtasks: (t.subtasks || []).filter(s => s.id !== subId)
    } : t))
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
    setArchivedTodos(prev => prev.map(t => {
      if (t.id === todoId) {
        return { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== subId) }
      }
      return t
    }))
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
    setQuests([{ id: Date.now(), text: questInputValue, completed: false }, ...quests])
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
  const deleteQuest = id => setQuests(quests.filter(q => q.id !== id))

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
    } else if (type === 'archive') {
      if (source.droppableId !== destination.droppableId) return // 날짜 간 이동 방지
      const date = source.droppableId.split('-')[1]
      setArchivedTodos(prev => {
        const otherDates = prev.filter(t => (t.completedAt || 'Unknown Date') !== date)
        const dateItems = prev.filter(t => (t.completedAt || 'Unknown Date') === date)
        const [reordered] = dateItems.splice(source.index, 1)
        dateItems.splice(destination.index, 0, reordered)
        return [...otherDates, ...dateItems]
      })
    } else if (type.startsWith('subtasks-')) {
      const todoId = parseInt(type.split('-')[1])
      setTodos(prevTodos => prevTodos.map(t => {
        if (t.id === todoId) {
          const newSub = Array.from(t.subtasks || [])
          const [reordered] = newSub.splice(source.index, 1)
          newSub.splice(destination.index, 0, reordered)
          return { ...t, subtasks: newSub }
        }
        return t
      }))
    }
  }

  // ── ZEN MODE ─────────────────────────────────────────────────────────────────
  if (isZenMode) {
    return (
      <div className={`app-container zen-mode ${!isPageVisible ? 'app-paused' : ''}`}>
        <div className="live-clock zen-clock">
          <Clock />
        </div>
        <div className="zen-content">

          <div className="zen-focus-task">
            <p className="zen-label">zen mode</p>
            <textarea
              ref={zenFrogRef}
              rows={1}
              className="zen-frog-input"
              value={oneThing}
              onChange={e => setOneThing(e.target.value)}
              placeholder="오늘 제일 중요한 일은?"
              spellCheck="false"
            />
          </div>

          <div className="timer-display zen-timer">{formatFocus(zenFocusTimeSeconds)}</div>

          {/* White noise control */}
          <button className={`btn-noise ${isNoiseOn ? 'noise-on' : ''}`} onClick={toggleNoise}>
            {isNoiseOn ? '백색소음 끄기' : '백색소음 켜기'}
          </button>
        </div>
        <button className="btn-exit-zen" onClick={() => setIsZenMode(false)}>✕</button>

        {/* Global Toast Notification */}
        <div className={`toast-container ${toast.visible ? 'visible' : ''}`}>
          <div className="toast-content">
            <span className="toast-icon">✦</span>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
  return (
    <div className={`app-container ${!isPageVisible ? 'app-paused' : ''}`}>
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
              onMouseEnter={setHeatmapTooltip}
              onMouseLeave={() => setHeatmapTooltip(null)}
            />
          ))}
        </div>

        <div className="heatmap-info-bar">
          <strong>{heatmapTooltip ? heatmapTooltip.label : `오늘 (${new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })})`}</strong>
          <div className="heatmap-info-stats" style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--cmyk-yellow)' }}>
              Acts {heatmapTooltip ? `(메인 ${heatmapTooltip.a_main}, 서브 ${heatmapTooltip.a_sub})` : `(메인 ${qa_main}, 서브 ${qa_sub})`}
            </span>
            <span style={{ color: 'var(--cmyk-magenta)' }}>
              Quests {heatmapTooltip ? (
                `(${heatmapTooltip.q_done}/${heatmapTooltip.q_total})`
              ) : `(${completedQuests}/${quests.length})`}
            </span>
            <span style={{ color: 'var(--cmyk-cyan)' }}>
              Focus {heatmapTooltip ? `(${formatFocus(heatmapTooltip.focusSeconds)})` : `(${formatFocus(totalFocusSeconds)})`}
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

                <DragDropContext onDragEnd={onDragEnd}>
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
                                  style={{ borderColor: statusMeta[todo.status].color, color: statusMeta[todo.status].color }}
                                  onClick={() => cycleStatus(todo.id)}
                                  title={todo.status === 'done' && todo.completedAt && todo.completedAt !== todayString ? '과거 완료 항목 (잠김)' : '클릭해서 상태 변경'}
                                >
                                  {statusMeta[todo.status].label}
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
                                                            <button className="btn-delete-subtask" title="세부 할일 수정" onClick={() => startEditSubtask(s.id, s.text)}>✎</button>
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
                  <DragDropContext onDragEnd={onDragEnd}>
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
                            <Droppable droppableId={`archive-${date}`} type="archive">
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
                                              <button className="btn-archive-action" onClick={() => startEditArchive(todo.id, todo.text)}>✎</button>
                                              <button className="btn-archive-action" onClick={() => deleteArchiveTodo(todo.id)}>✕</button>
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
                                                    <button className="btn-archive-sub-action" onClick={() => startEditArchiveSub(todo.id, s.id, s.text)}>✎</button>
                                                    <button className="btn-archive-sub-action" onClick={() => deleteArchiveSubtask(todo.id, s.id)}>✕</button>
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
                onClick={() => setIsFocusTimerRunning(!isFocusTimerRunning)}
              >
                {isFocusTimerRunning ? <><span className="timer-icon pause-icon">⏸</span> Pause</> : <><span className="timer-icon play-icon">▶</span> Focus</>}
              </button>
              <button
                className="btn-timer reset"
                onClick={() => {
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
              <span className="quest-progress"><span className="current">{completedQuests}</span>/{quests.length}</span>
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

      {/* Global Toast Notification */}
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
