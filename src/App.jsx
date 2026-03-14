import { useState, useEffect, useRef, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import './App.css'

// ── Web Audio: white noise generator ──────────────────────────────────────────
function createWhiteNoise(ctx) {
  const bufferSize = 2 * ctx.sampleRate
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const output = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  // Gentle low-pass filter for a softer rain-like sound
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
      return parsed.map(t => {
        // Legacy 'completed' boolean to 'status' migration (이미 존재하던 로직)
        let item = t
        if (t.completed !== undefined) {
          const status = t.completed ? 'done' : 'todo'
          const { completed: _c, ...rest } = t
          item = { ...rest, status }
        }

        // [New Migration] 기존 DONE 항목에 완료 날짜가 없으면 어제로 소급 적용
        if (item.status === 'done' && !item.completedAt) {
          item = { ...item, completedAt: yesterday }
        }

        // 서브태스크 마이그레이션: subquests -> subtasks
        if (item.subquests || item.subtasks) {
          const rawSubtasks = item.subtasks || item.subquests || []
          item.subtasks = rawSubtasks.map(s => {
            if (s.completed && !s.completedAt) {
              return { ...s, completedAt: yesterday }
            }
            return s
          })
          delete item.subquests // 구버전 필드 삭제
        }

        return item
      })
    }
    return []
  })

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
      return parsed.map(q => {
        // [New Migration] 기존 완료된 퀘스트에 날짜가 없으면 어제로 소급 적용
        if (q.completed && !q.completedAt) {
          return { ...q, completedAt: yesterday }
        }
        return q
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
    
    return data
  })
  const [heatmapTooltip, setHeatmapTooltip] = useState(null)

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

  // 2. Action Items completion ratio (Yellow) - Only count progress made TODAY
  let totalActionScore = 0
  if (todos.length > 0) {
    todos.forEach(t => {
      // Rule 1: Only whole tasks finished TODAY get 1 point
      if (t.status === 'done' && t.completedAt === todayString) {
        totalActionScore += 1
      }
      // Rule 2: Unfinished tasks (DOING) get partial credit for subtasks finished TODAY
      else if (t.status === 'doing' && t.subtasks?.length > 0) {
        const subCompletedToday = t.subtasks.filter(s => s.completed && s.completedAt === todayString).length
        totalActionScore += (subCompletedToday / t.subtasks.length) * 0.8
      }
    })
  }
  const todosRatio = todos.length > 0 ? totalActionScore / todos.length : 0

  // 3. Focus Timer ratio (Cyan) - Target: 4 hours = 14400 seconds (Updated from 3h)
  const targetFocusSeconds = 14400
  const totalFocusSeconds = focusTimeSeconds + zenFocusTimeSeconds
  const focusRatio = Math.min(totalFocusSeconds / targetFocusSeconds, 1)

  // Combined score for the total (still used for info bar calculation)
  const todayRatio = (questsRatio + todosRatio + focusRatio) / 3

  // Update today's layered ratios in heatmap
  useEffect(() => {
    setHeatmap(prev => {
      const updated = {
        ...prev,
        [todayString]: {
          q: questsRatio,   // Magenta
          a: todosRatio,    // Yellow
          t: focusRatio,    // Cyan
          total: todayRatio // Overall
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

  // ── Live Clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000)
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
    } else {
      if (ctx.state === 'suspended') ctx.resume()
      noiseRef.current = createWhiteNoise(ctx)
      noiseRef.current.source.start()
      setIsNoiseOn(true)
    }
  }, [isNoiseOn])

  // Sync isZenMode (Simplified for always-fullscreen mode)
  useEffect(() => {
    if (!isZenMode) {
      window.chrome?.webview?.postMessage("topmost:false")
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
      window.chrome?.webview?.postMessage("topmost:true")
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isZenMode])

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const formatTime = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDate = d => d.toLocaleDateString('ko-KR', { weekday: 'long', month: 'short', day: 'numeric' })
  const formatFocus = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // ── Backup / Restore ─────────────────────────────────────────────────────────
  const exportData = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      todos,
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
          if (data.todos) setTodos(data.todos)
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

  // ── Status meta ──────────────────────────────────────────────────────────────
  const statusMeta = {
    todo: { label: 'TODO', color: '#adb5bd' },
    doing: { label: 'DOING', color: 'var(--cmyk-yellow)' },
    done: { label: 'DONE', color: 'var(--cmyk-yellow)' },
  }

  // ── ZEN MODE ─────────────────────────────────────────────────────────────────
  if (isZenMode) {
    return (
      <div className="app-container zen-mode">
        <div className="live-clock zen-clock">
          <div className="clock-time">{formatTime(currentTime)}</div>
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
    <div className="app-container">
      <header className="header">
        <div>
          <h1>00Hub<span className="title-dot">.</span></h1>
        </div>
        <div className="header-actions">
          <div className="live-clock" onClick={() => setIsZenMode(true)} title="젠 모드 시작">
            <div className="clock-time">{formatTime(currentTime)}</div>
            <div className="clock-date">{formatDate(currentTime)}</div>
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
          {Array.from({ length: 30 }).map((_, i) => {
            const date = new Date()
            date.setDate(date.getDate() - (29 - i))
            const ds = date.toDateString()
            const isToday = i === 29

            // Handle legacy single-value numbers vs new layered objects
            const rawData = heatmap[ds]
            let data = { q: 0, a: 0, t: 0, total: 0 }
            if (typeof rawData === 'number') {
              data = { q: rawData, a: rawData, t: rawData, total: rawData } // fallback
            } else if (rawData) {
              data = rawData
            }

            const label = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
            const pctTotal = Math.round(data.total * 100)
            const pctQ = Math.round(data.q * 100)
            const pctA = Math.round(data.a * 100)
            const pctT = Math.round(data.t * 100)

            // Dynamic Layering Logic: Sort by percentage to determine z-index (higher pct = lower z-index)
            const priority = { a: 1, q: 2, t: 3 }; // Yellow(a) is back(1), Magenta(q) mid(2), Cyan(t) is front(3)
            const stats = [
              { key: 'q', val: pctQ },
              { key: 'a', val: pctA },
              { key: 't', val: pctT }
            ].sort((a, b) => {
              if (b.val !== a.val) return b.val - a.val; // Higher value goes back
              return priority[a.key] - priority[b.key]; // Tie-break: C -> Y -> M
            });

            // Mapping for dynamic z-index and wave height
            const layerProps = {};
            const waveHByRank = ['8px', '6px', '4px']; 
            stats.forEach((stat, idx) => {
              layerProps[stat.key] = {
                zIndex: idx + 1,
                waveHeight: waveHByRank[idx]
              };
            });

            const minPct = Math.min(pctQ, pctA, pctT);

            return (
              <div
                key={i}
                className={`heatmap-cell layered ${isToday ? 'today' : ''}`}
                style={{
                  '--pct-q': pctQ,
                  '--pct-a': pctA,
                  '--pct-t': pctT,
                  '--pct-w': minPct,
                  '--pct-total': pctTotal
                }}
                onMouseEnter={() => setHeatmapTooltip({ label, pct: pctTotal, q: pctQ, a: pctA, t: pctT })}
                onMouseLeave={() => setHeatmapTooltip(null)}
              >
                <div className="layer-y" title="Action Items" style={{ zIndex: layerProps.a.zIndex, '--wave-h': layerProps.a.waveHeight }} />
                <div className="layer-m" title="Daily Quests" style={{ zIndex: layerProps.q.zIndex, '--wave-h': layerProps.q.waveHeight }} />
                <div className="layer-c" title="Work Timer" style={{ zIndex: layerProps.t.zIndex, '--wave-h': layerProps.t.waveHeight }} />
                {minPct > 0 && <div className="layer-w" style={{ zIndex: 10, '--wave-h': '4px' }} />}
              </div>
            )
          })}
        </div>

        <div className="heatmap-info-bar">
          <strong>{heatmapTooltip ? heatmapTooltip.label : `오늘 (${new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })})`}</strong>
          <div className="heatmap-info-stats" style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--cmyk-yellow)' }}>Acts {heatmapTooltip ? heatmapTooltip.a : Math.round(todosRatio * 100)}%</span>
            <span style={{ color: 'var(--cmyk-magenta)' }}>Quests {heatmapTooltip ? heatmapTooltip.q : Math.round(questsRatio * 100)}%</span>
            <span style={{ color: 'var(--cmyk-cyan)' }}>Focus {heatmapTooltip ? heatmapTooltip.t : Math.round(focusRatio * 100)}%</span>
            <span style={{ fontWeight: 'bold' }}>Total {heatmapTooltip ? heatmapTooltip.pct : Math.round(todayRatio * 100)}%</span>
          </div>
        </div>

      </section>

      <main className="dashboard-grid">
        {/* 메인 2단 컬럼 시작 */}
        <div className="main-content-stack">
          {/* ACTION ITEMS — list style */}
          <section className="card action-items">
            <h2 className="card-title">Action Items</h2>

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
          </section>
        </div>

        {/* SIDEBAR */}
        <div className="sidebar-stack">
          {/* FOCUS TIMER */}
          <section className="card timer-card">
            <h2 className="card-title">Work Timer</h2>
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
            <div className="quest-header">
              <h2 className="card-title">Daily Quests</h2>
              <span className="quest-progress">{completedQuests}/{quests.length}</span>
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
