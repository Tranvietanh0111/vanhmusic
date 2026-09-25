import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { motion } from 'framer-motion'
import {
  Home,
  Search,
  Library,
  Heart,
  ListMusic,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  Shuffle,
  Repeat2,
  Upload,
  Pause,
  X,
  Sparkles,
  User,
  UserPlus,
  LogIn,
  LogOut,
  Music2,
  Clock3,
  Trash2,
  Plus,
} from 'lucide-react'

type Playlist = {
  id: number
  name: string
  song_ids: number[]
}

type Track = {
  id?: number
  title: string
  artist: string
  color: string
  color2: string
  url?: string
}

const defaultTrack: Track = { 
  title: 'Chưa có bài hát', 
  artist: 'Unknown', 
  color: '#7c3aed', 
  color2: '#ec4899' 
}

const importedColors = [
  ['#7c3aed', '#ec4899'],
  ['#06b6d4', '#3b82f6'],
  ['#ec4899', '#f97316'],
  ['#f97316', '#facc15'],
  ['#22c55e', '#06b6d4'],
  ['#6366f1', '#06b6d4'],
]

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '00:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function readList(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter((item) => Number.isInteger(item)) : []
  } catch {
    return []
  }
}

function App() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    const value = Number(localStorage.getItem('vanhmusic-volume'))
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.75
  })
  const [shuffle, setShuffle] = useState(() => localStorage.getItem('vanhmusic-shuffle') === 'true')
  const [repeat, setRepeat] = useState(() => localStorage.getItem('vanhmusic-repeat') === 'true')
  const [active, setActive] = useState('Home')
  const [search, setSearch] = useState('')
  const [dragging, setDragging] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('vanhmusic-user') || '')

  const API_URL = 'http://127.0.0.1:8000'
  
  const [liked, setLiked] = useState<number[]>(() => readList('vanhmusic-liked'))
  const [recent, setRecent] = useState<number[]>(() => readList('vanhmusic-recent'))
  const [queue, setQueue] = useState<number[]>(() => readList('vanhmusic-queue'))
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationRef = useRef<number | null>(null)

  const track = tracks[current] || defaultTrack

  useEffect(() => {
    const loadSongs = async () => {
      try {
        const response = await fetch(`${API_URL}/songs`)
        if (!response.ok) return
        const songs = await response.json()
        if (!Array.isArray(songs) || !songs.length) return

        const serverTracks: Track[] = songs.map((song: { id: number; title: string; artist: string; stream_url: string }, index: number) => {
          const color = importedColors[index % importedColors.length]
          return {
            id: song.id,
            title: song.title,
            artist: song.artist,
            color: color[0],
            color2: color[1],
            url: `${API_URL}${song.stream_url}`,
          }
        })

        setTracks(serverTracks)
        setCurrent(0)
      } catch {
      }
    }

    loadSongs()
  }, [])

  useEffect(() => {
    const loadLibrary = async () => {
      const token = localStorage.getItem('vanhmusic-token')
      if (!token) return
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [likesResponse, recentResponse, playlistsResponse] = await Promise.all([
          fetch(`${API_URL}/library/likes`, { headers }),
          fetch(`${API_URL}/library/recent`, { headers }),
          fetch(`${API_URL}/library/playlists`, { headers }),
        ])
        const likes = likesResponse.ok ? await likesResponse.json() : []
        const recentRows = recentResponse.ok ? await recentResponse.json() : []
        const playlistRows = playlistsResponse.ok ? await playlistsResponse.json() : []
        setLiked((current) => {
          const serverIndexes = Array.isArray(likes)
            ? likes.map((id: number) => tracks.findIndex((item) => item.id === id)).filter((index: number) => index >= 0)
            : []
          return Array.from(new Set([...current, ...serverIndexes]))
        })
        setRecent((current) => {
          const serverIndexes = Array.isArray(recentRows)
            ? recentRows.map((row: { song_id: number }) => tracks.findIndex((item) => item.id === row.song_id)).filter((index: number) => index >= 0)
            : []
          return Array.from(new Set([...serverIndexes, ...current])).slice(0, 12)
        })
        if (Array.isArray(playlistRows)) setPlaylists(playlistRows)
      } catch {
      }
    }
    loadLibrary()
  }, [tracks.length])

  const currentRef = useRef(current)
  const shuffleRef = useRef(shuffle)
  const repeatRef = useRef(repeat)
  const tracksRef = useRef(tracks)
  const trackRef = useRef(track)
  const playingRef = useRef(playing)

  const filteredTracks = tracks.filter((item) =>
    `${item.title} ${item.artist}`.toLowerCase().includes(search.trim().toLowerCase())
  )

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')

    const email = authEmail.trim().toLowerCase()
    const password = authPassword

    if (!email || !password) {
      setAuthError('Vui lòng nhập đầy đủ thông tin.')
      return
    }

    if (authMode === 'register' && !authName.trim()) {
      setAuthError('Vui lòng nhập tên của bạn.')
      return
    }

    setAuthLoading(true)

    try {
      const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login'
      const body = authMode === 'register'
        ? { email, full_name: authName.trim(), password }
        : { email, password }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item: { msg?: string }) => item.msg || '').join(', ')
          : data.detail
        throw new Error(detail || 'Không thể kết nối với máy chủ.')
      }

      localStorage.setItem('vanhmusic-token', data.access_token)
      localStorage.setItem('vanhmusic-user', data.user?.email || email)
      localStorage.setItem('vanhmusic-name', data.user?.full_name || authName.trim())
      setUserEmail(data.user?.email || email)
      setAuthOpen(false)
      setAuthName('')
      setAuthEmail('')
      setAuthPassword('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Có lỗi xảy ra.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('vanhmusic-token')
    localStorage.removeItem('vanhmusic-user')
    localStorage.removeItem('vanhmusic-name')
    setUserEmail('')
    setAuthOpen(false)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    const query = search.trim().toLowerCase()
    if (!query) return
    const index = tracks.findIndex((item) => `${item.title} ${item.artist}`.toLowerCase().includes(query))
    if (index < 0) return
    setCurrent(index)
    setActive('Home')
    requestAnimationFrame(() => {
      document.querySelector(`[data-track-index=\"${index}\"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  useEffect(() => { currentRef.current = current }, [current])
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])
  useEffect(() => { repeatRef.current = repeat }, [repeat])
  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { trackRef.current = track }, [track])
  useEffect(() => { playingRef.current = playing }, [playing])

  useEffect(() => {
    localStorage.setItem('vanhmusic-volume', String(volume))
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => { localStorage.setItem('vanhmusic-shuffle', String(shuffle)) }, [shuffle])
  useEffect(() => { localStorage.setItem('vanhmusic-repeat', String(repeat)) }, [repeat])
  useEffect(() => { localStorage.setItem('vanhmusic-liked', JSON.stringify(liked)) }, [liked])
  useEffect(() => { localStorage.setItem('vanhmusic-recent', JSON.stringify(recent)) }, [recent])
  useEffect(() => { localStorage.setItem('vanhmusic-queue', JSON.stringify(queue)) }, [queue])

  const startAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!sourceRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      if (AudioContextClass) {
        audio.crossOrigin = 'anonymous'

        const context = new AudioContextClass()
        const source = context.createMediaElementSource(audio)
        const analyser = context.createAnalyser()

        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.52
        source.connect(analyser)
        analyser.connect(context.destination)

        audioContextRef.current = context
        sourceRef.current = source
        analyserRef.current = analyser
      }
    }

    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {})
    }
  }, [])

  const rememberRecent = useCallback((index: number) => {
    setRecent((items) => [index, ...items.filter((item) => item !== index)].slice(0, 12))
    const songId = tracksRef.current[index]?.id
    const token = localStorage.getItem('vanhmusic-token')
    if (songId && token) {
      fetch(`${API_URL}/library/recent/${songId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
  }, [])

  const nextTrack = useCallback(() => {
    const list = tracksRef.current
    if (!list.length) return

    if (repeatRef.current) {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        startAudio()
        audio.play().catch(() => {})
      }
      setProgress(0)
      setPlaying(true)
      return
    }

    const queued = queue
      .map((index) => list[index] ? index : -1)
      .filter((index) => index >= 0 && index !== currentRef.current)

    let nextIndex = currentRef.current + 1

    if (queued.length && !shuffleRef.current) {
      nextIndex = queued[0]
      setQueue((items) => items.filter((item) => item !== nextIndex))
    } else if (shuffleRef.current && list.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * list.length)
      } while (nextIndex === currentRef.current)
    } else {
      nextIndex = nextIndex % list.length
    }

    setCurrent(nextIndex)
    setProgress(0)
    setPlaying(true)
    rememberRecent(nextIndex)
    startAudio()
  }, [queue, rememberRecent, startAudio])

  const previousTrack = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0
      setProgress(0)
      return
    }

    const list = tracksRef.current
    if (!list.length) return

    const previousIndex = (currentRef.current - 1 + list.length) % list.length
    setCurrent(previousIndex)
    setProgress(0)
    setPlaying(true)
    rememberRecent(previousIndex)
    startAudio()
  }, [rememberRecent, startAudio])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      if (!dragging) setProgress(audio.currentTime)
    }
    const onMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onEnded = () => nextTrack()
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onMetadata)
    audio.addEventListener('durationchange', onMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onMetadata)
      audio.removeEventListener('durationchange', onMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [dragging, nextTrack])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!track.url) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      setProgress(0)
      setDuration(0)
      return
    }

    audio.src = track.url
    audio.load()
    setProgress(0)
    setDuration(0)

    if (playing) {
      audio.play().catch(() => setPlaying(false))
    }
  }, [current])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !track.url) return

    if (playing && audio.paused) audio.play().catch(() => setPlaying(false))
    if (!playing && !audio.paused) audio.pause()
  }, [playing, track.url])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      
      if (event.repeat) return

      if (event.code === 'Space') {
        if (target instanceof HTMLButtonElement) return

        event.preventDefault()
        togglePlay()
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault()
        seek(Math.min(audioRef.current?.duration || 0, (audioRef.current?.currentTime || 0) + 5))
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        seek(Math.max(0, (audioRef.current?.currentTime || 0) - 5))
      }
      if (event.code === 'ArrowUp') {
        event.preventDefault()
        setVolume((value) => Math.min(1, Number((value + 0.05).toFixed(2))))
      }
      if (event.code === 'ArrowDown') {
        event.preventDefault()
        setVolume((value) => Math.max(0, Number((value - 0.05).toFixed(2))))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, volume])

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
      tracksRef.current.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url)
      })
    }
  }, [])

  function drawVisualizer() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let data: Uint8Array | null = null
    const bars = 88
    let lastWidth = 0
    let lastHeight = 0
    let gradients: CanvasGradient[] = []
    let previousBass = 0
    let beatPulse = 0

    const rainbow = [
      '#ff2d55',
      '#ff6b00',
      '#ffd60a',
      '#32d74b',
      '#00d4ff',
      '#0a84ff',
      '#5e5ce6',
      '#bf5af2',
      '#ff2d92',
    ]

    const render = (time: number) => {
      if (document.hidden) {
        animationRef.current = requestAnimationFrame(render)
        return
      }

      const phase = time * 0.003
      const analyser = analyserRef.current
      const activeTrack = trackRef.current
      const isPlaying = playingRef.current

      if (!isPlaying || !analyser) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        animationRef.current = requestAnimationFrame(render)
        return
      }

      if (!data) {
        data = new Uint8Array(analyser.frequencyBinCount)
      }
      analyser.getByteFrequencyData(data)

      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = Math.max(1, Math.floor(rect.width * dpr))
      const height = Math.max(1, Math.floor(rect.height * dpr))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        lastWidth = 0
        lastHeight = 0
      }

      if (lastWidth !== width || lastHeight !== height) {
        gradients = []
        for (let i = 0; i < bars; i++) {
          const gradient = ctx.createLinearGradient(0, 0, 0, height)
          const a = rainbow[i % rainbow.length]
          const b = rainbow[(i + 3) % rainbow.length]
          const c = rainbow[(i + 6) % rainbow.length]
          gradient.addColorStop(0, '#ffffff')
          gradient.addColorStop(0.08, a)
          gradient.addColorStop(0.38, b)
          gradient.addColorStop(0.72, c)
          gradient.addColorStop(1, 'rgba(255,255,255,0)')
          gradients.push(gradient)
        }
        lastWidth = width
        lastHeight = height
      }

      ctx.clearRect(0, 0, width, height)

      const center = height * 0.70
      const gap = Math.max(2, 2.4 * dpr)
      const barWidth = Math.max(2, width / bars - gap)

      let bassEnergy = 0
      if (data && analyser) {
        const bassBins = Math.max(4, Math.floor(data.length * 0.08))
        for (let i = 0; i < bassBins; i++) bassEnergy += data[i] / 255
        bassEnergy /= bassBins
      }

      const bassDelta = bassEnergy - previousBass
      previousBass = bassEnergy
      beatPulse = Math.max(beatPulse * 0.84, Math.max(0, bassDelta) * 3.8)

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      for (let i = 0; i < bars; i++) {
        const start = Math.floor((i / bars) * data.length)
        const end = Math.max(start + 1, Math.floor(((i + 1) / bars) * data.length))
        let peak = 0
        let average = 0
        let count = 0

        for (let bin = start; bin < end && bin < data.length; bin++) {
          const sample = data[bin] / 255
          peak = Math.max(peak, sample)
          average += sample
          count++
        }

        average = count ? average / count : 0
        const frequencyShape = i < bars * 0.25 ? 1.28 : i < bars * 0.55 ? 1.08 : 0.94
        const sharpValue = Math.pow(Math.max(peak, average * 1.15), 0.48)
        const value = Math.min(1, sharpValue * frequencyShape + beatPulse * (i < bars * 0.35 ? 1.15 : 0.35))
        const barHeight = Math.max(5 * dpr, value * height * 0.88)
        const x = i * (barWidth + gap)
        const y = center - barHeight

        ctx.shadowColor = rainbow[i % rainbow.length]
        ctx.shadowBlur = 18 * dpr
        ctx.globalAlpha = 0.92
        ctx.fillStyle = gradients[i]
        ctx.fillRect(x, y, barWidth, barHeight)

        ctx.globalAlpha = 0.20
        ctx.fillRect(x, center + 5 * dpr, barWidth, barHeight * 0.28)
      }
      ctx.restore()

      const drawWave = (offset: number, amplitude: number, speed: number, alpha: number, widthLine: number) => {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = alpha
        ctx.lineWidth = widthLine * dpr
        ctx.shadowBlur = 22 * dpr
        const gradient = ctx.createLinearGradient(0, 0, width, 0)
        rainbow.forEach((color, index) => {
          const shift = ((index / (rainbow.length - 1)) + phase * speed * 0.025) % 1
          gradient.addColorStop(shift, color)
        })
        ctx.strokeStyle = gradient
        ctx.shadowColor = activeTrack.color
        ctx.beginPath()

        for (let i = 0; i <= 260; i++) {
          const x = (i / 260) * width
          const t = i * 0.11 + phase * speed + offset
          const audio = data && analyser ? (data[Math.min(data.length - 1, Math.floor((i / 260) * data.length))] / 255) : 0
          const energy = Math.pow(audio, 0.45)
          const y = center +
            Math.sin(t) * amplitude * (0.12 + energy * 1.15) +
            Math.sin(t * 0.47 + 1.8) * amplitude * (0.08 + energy * 0.62) +
            Math.sin(t * 1.9) * amplitude * (0.04 + energy * 0.28)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.restore()
      }

      drawWave(0, height * 0.13, 2.4, 0.95, 2.2)
      drawWave(2.5, height * 0.085, 1.6, 0.55, 1.4)
      drawWave(5.5, height * 0.055, 3.6, 0.34, 1)

      ctx.save()
      const glow = ctx.createRadialGradient(width * 0.5, center, 0, width * 0.5, center, width * 0.62)
      glow.addColorStop(0, `${activeTrack.color}28`)
      glow.addColorStop(0.35, 'rgba(191,90,242,0.12)')
      glow.addColorStop(0.7, 'rgba(0,212,255,0.05)')
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)
      ctx.restore()

      animationRef.current = requestAnimationFrame(render)
    }

    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    render(performance.now())
  }

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      drawVisualizer()
    })

    return () => {
      cancelAnimationFrame(timer)
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [])

  async function togglePlay() {
    const audio = audioRef.current
    if (!audio) return

    if (!track.url) {
      inputRef.current?.click()
      return
    }

    startAudio()

    if (audio.paused) {
      try {
        await audio.play()
        setPlaying(true)
        rememberRecent(current)
      } catch {
        setPlaying(false)
      }
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  function seek(value: number) {
    const audio = audioRef.current
    if (!audio || !track.url) return
    audio.currentTime = value
    setProgress(value)
  }

  function playTrack(index: number) {
    const audio = audioRef.current
    if (!audio) return

    if (index === current) {
      togglePlay()
      return
    }

    startAudio()
    
    setCurrent(index)
    setProgress(0)
    setDuration(0)
    setPlaying(true)
    rememberRecent(index)
  }

  async function toggleLike(index: number) {
    if (liked.includes(index)) return
    const songId = tracks[index]?.id
    if (songId) {
      const token = localStorage.getItem('vanhmusic-token')
      if (!token) {
        setAuthMode('login')
        setAuthOpen(true)
        setAuthError('Bạn cần đăng nhập để Like bài hát.')
        return
      }
      const response = await fetch(`${API_URL}/library/likes/${songId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return
    }
    setLiked((items) => items.includes(index) ? items : [...items, index])
  }

  async function createPlaylist() {
    const token = localStorage.getItem('vanhmusic-token')
    if (!token) {
      setAuthMode('login')
      setAuthOpen(true)
      setAuthError('Bạn cần đăng nhập để tạo playlist.')
      return
    }
    const name = window.prompt('Tên playlist mới:')?.trim()
    if (!name) return
    const response = await fetch(`${API_URL}/library/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    })
    if (!response.ok) return
    const playlist = await response.json()
    setPlaylists((items) => [playlist, ...items])
  }

  async function addToPlaylist(index: number) {
    const songId = tracks[index]?.id
    const token = localStorage.getItem('vanhmusic-token')
    if (!songId || !token) {
      if (!token) { setAuthMode('login'); setAuthOpen(true); setAuthError('Bạn cần đăng nhập để dùng playlist.') }
      return
    }
    if (!playlists.length) {
      await createPlaylist()
      return
    }
    const choices = playlists.map((item, position) => `${position + 1}. ${item.name}`).join('\n')
    const answer = window.prompt(`Chọn playlist bằng số:\n${choices}`)
    const position = Number(answer) - 1
    const playlist = playlists[position]
    if (!playlist) return
    const response = await fetch(`${API_URL}/library/playlists/${playlist.id}/songs/${songId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return
    const updated = await response.json()
    setPlaylists((items) => items.map((item) => item.id === updated.id ? updated : item))
  }

  function addToQueue(index: number) {
    setQueue((items) => items.includes(index) ? items : [...items, index])
  }

  function removeFromQueue(index: number) {
    setQueue((items) => items.filter((item) => item !== index))
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const token = localStorage.getItem('vanhmusic-token')
    if (!token) {
      setAuthMode('login')
      setAuthOpen(true)
      setAuthError('Bạn cần đăng nhập để upload nhạc.')
      event.target.value = ''
      return
    }

    try {
      const uploaded: Track[] = []

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('title', file.name.replace(/\.[^/.]+$/, ''))
        formData.append('artist', localStorage.getItem('vanhmusic-name') || 'Vanh')

        const response = await fetch(`${API_URL}/songs/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.detail || 'Upload bài hát thất bại.')
        }

        const color = importedColors[index % importedColors.length]
        uploaded.push({
          id: data.id,
          title: data.title,
          artist: data.artist,
          color: color[0],
          color2: color[1],
          url: `${API_URL}${data.stream_url}`,
        })
      }

      const firstNewIndex = tracks.length
      setTracks((oldTracks) => [...oldTracks, ...uploaded])
      setCurrent(firstNewIndex)
      setProgress(0)
      setDuration(0)
      setPlaying(true)
      rememberRecent(firstNewIndex)
      startAudio()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Upload thất bại.')
    } finally {
      event.target.value = ''
    }
  }

  async function removeTrack(index: number) {
    const removed = tracks[index]
    if (!removed) return

    if (removed.id) {
      const token = localStorage.getItem('vanhmusic-token')
      if (!token) return

      const response = await fetch(`${API_URL}/songs/${removed.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        window.alert(data.detail || 'Không thể xóa bài hát.')
        return
      }
    }

    setTracks((items) => items.filter((_, itemIndex) => itemIndex !== index))
    setLiked((items) => items.filter((item) => item !== index).map((item) => item > index ? item - 1 : item))
    setRecent((items) => items.filter((item) => item !== index).map((item) => item > index ? item - 1 : item))
    setQueue((items) => items.filter((item) => item !== index).map((item) => item > index ? item - 1 : item))

    if (index < current) setCurrent((value) => Math.max(0, value - 1))
    if (index === current) {
      setPlaying(false)
      setProgress(0)
      setDuration(0)
      setCurrent((value) => Math.min(value, Math.max(0, tracks.length - 2)))
    }
  }

  function getTrack(index: number) {
    return tracks[index]
  }

  const visibleTracks =
    active === 'Liked Songs'
      ? liked.map(getTrack).filter(Boolean) as Track[]
      : active === 'Recently Played'
        ? recent.map(getTrack).filter(Boolean) as Track[]
        : active === 'Queue'
          ? queue.map(getTrack).filter(Boolean) as Track[]
          : filteredTracks

  const visibleIndices =
    active === 'Liked Songs'
      ? liked.filter((index) => tracks[index])
      : active === 'Recently Played'
        ? recent.filter((index) => tracks[index])
        : active === 'Queue'
          ? queue.filter((index) => tracks[index])
          : filteredTracks.map((item) => tracks.indexOf(item))

  return (
    <div
      className="app"
      style={{
        '--accent': track.color,
        '--accent-2': track.color2,
        '--mouse-x': '50%',
        '--mouse-y': '50%',
      } as CSSProperties}
    >
      <audio ref={audioRef} crossOrigin="anonymous" />

      <div className="light-orb orb-one" />
      <div className="light-orb orb-two" />
      <div className="light-orb orb-three" />
      <div className="mouse-light" />

      <aside className="sidebar glass">
        <div className="brand">
          <div className="brand-logo"><span>V</span></div>
          <div><strong>VANH</strong><span>MUSIC</span></div>
        </div>

        <nav>
          {[
            { icon: Home, label: 'Home' },
            { icon: Search, label: 'Discover' },
            { icon: Library, label: 'Library' },
          ].map(({ icon: Icon, label }) => (
            <button
              className={active === label ? 'nav-item active' : 'nav-item'}
              onClick={() => setActive(label)}
              key={label}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="nav-title">YOUR LIBRARY</div>

        <button className={active === 'Liked Songs' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Liked Songs')}>
          <Heart size={19} fill={active === 'Liked Songs' ? 'currentColor' : 'none'} />
          <span>Liked Songs</span>
          <b className="nav-count">{liked.length}</b>
        </button>

        <button className={active === 'Queue' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Queue')}>
          <ListMusic size={19} />
          <span>Queue</span>
          <b className="nav-count">{queue.length}</b>
        </button>

        <button className={active === 'Playlists' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Playlists')}>
          <ListMusic size={19} />
          <span>Playlists</span>
          <b className="nav-count">{playlists.length}</b>
        </button>

        <button className={active === 'Recently Played' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('Recently Played')}>
          <Clock3 size={19} />
          <span>Recent</span>
          <b className="nav-count">{recent.length}</b>
        </button>

        <div className="sidebar-bottom">
          <button className="upload-button" onClick={() => inputRef.current?.click()}>
            <Upload size={16} />
            <span>Thêm nhạc</span>
          </button>
          <div className="mini-status"><span className="live-dot" /> HỆ THỐNG ÂM THANH SẴN SÀNG</div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <div className="eyebrow">VANHMUSIC EXPERIENCE</div>
            <h1>Âm thanh <span>bừng sức sống.</span></h1>
            <p className="top-description">Âm nhạc của bạn. Không gian của bạn. Nhịp điệu của bạn.</p>
          </div>

          <div className="top-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Tìm kiếm bài hát..."
              />
              {search && <button type="button" onClick={() => setSearch('')}><X size={14} /></button>}
            </label>
            <div className="engine-pill"><span /> CÔNG NGHỆ 3D</div>
            <button className="profile" onClick={() => { setAuthError(''); setAuthOpen(true) }} title={userEmail ? userEmail : 'Đăng nhập'}>{userEmail ? userEmail.slice(0, 2).toUpperCase() : 'VX'}</button>
          </div>
        </header>

        {active === 'Home' ? (
          <>
            <section className="hero-3d glass">
              <div className="hero-grid" />
              <div className="hero-copy">
                <div className="eyebrow"><Sparkles size={14} /> ÂM THANH THẾ HỆ MỚI</div>
                <h2>Âm thanh<br /><span>bừng sức sống.</span></h2>
                <div className="hero-actions">
                  <button className="primary" onClick={togglePlay}>
                    {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                    {playing ? 'Tạm dừng' : 'Bắt đầu nghe'}
                  </button>
                  <button className="secondary" onClick={() => inputRef.current?.click()}>
                    <Upload size={17} /> Thêm nhạc
                  </button>
                </div>
              </div>

              <div className="scene">
                <div className="album-scene">
                  <div className="album-shadow" style={{ background: track.color }} />
                  <motion.div
                    className="album"
                    animate={{ rotateZ: playing ? 360 : 0, scale: playing ? [1, 1.025, 1] : 1 }}
                    transition={{
                      rotateZ: { duration: 22, repeat: Infinity, ease: 'linear' },
                      scale: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' },
                    }}
                    style={{ background: `linear-gradient(135deg, ${track.color}, ${track.color2} 48%, #111827 100%)` }}
                  >
                    <div className="album-noise" />
                    <div className="album-lines"><span /><span /><span /><span /></div>
                    <div className="album-logo"><Music2 size={36} /></div>
                    <div className="album-name"><small>VANH MUSIC</small><strong>{track.title}</strong></div>
                  </motion.div>
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit orbit-three" />
                  <div className="particle particle-one" />
                  <div className="particle particle-two" />
                  <div className="particle particle-three" />
                  <div className="particle particle-four" />
                  <div className="particle particle-five" />
                </div>
              </div>

              <div className="hero-now">
                <div className="hero-now-label">ĐANG PHÁT</div>
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </div>
            </section>

          </>
        ) : null}

        {active === 'Playlists' && (
          <section className="section">
            <div className="section-head">
              <div>
                <div className="eyebrow">YOUR COLLECTION</div>
                <h3>Playlists</h3>
              </div>
              <button className="text-button" onClick={createPlaylist}><Plus size={14} /> Tạo playlist</button>
            </div>
            {playlists.length ? (
              <div className="song-grid">
                {playlists.map((playlist) => (
                  <motion.div className="song-card glass" key={playlist.id}>
                    <div className="song-main">
                      <div className="cover" style={{ background: `linear-gradient(135deg, ${track.color}, ${track.color2} 55%, #111827)` }}>
                        <div className="cover-glow" />
                        <div className="cover-center"><ListMusic size={28} /></div>
                      </div>
                      <div className="song-info"><strong>{playlist.name}</strong><small>{playlist.song_ids.length} bài hát</small></div>
                    </div>
                    <div className="card-tools">
                      <button className="icon-tool danger" onClick={async () => {
                        const token = localStorage.getItem('vanhmusic-token')
                        if (!token) return
                        const response = await fetch(`${API_URL}/library/playlists/${playlist.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
                        if (response.ok) setPlaylists((items) => items.filter((item) => item.id !== playlist.id))
                      }}><Trash2 size={14} /></button>
                    </div>
                    <div className="card-line" style={{ background: `linear-gradient(90deg, ${track.color}, ${track.color2})` }} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="empty-state glass">
                <ListMusic size={34} />
                <strong>Chưa có playlist</strong>
                <span>Tạo playlist đầu tiên để lưu nhạc.</span>
                <button className="secondary" onClick={createPlaylist}><Plus size={16} /> Tạo playlist</button>
              </div>
            )}
          </section>
        )}

        {(active === 'Home' || active === 'Library' || active === 'Liked Songs' || active === 'Queue' || active === 'Recently Played') && (
          <section className="section">
            <div className="section-head">
              <div>
                <div className="eyebrow">
                  {active === 'Home' ? 'ÂM NHẠC CỦA BẠN' : active.toUpperCase()}
                </div>
                <h3>{active === 'Home' ? 'Tracks' : active}</h3>
              </div>
              <div className="section-actions">
                <span className="result-count">{visibleTracks.length} tracks</span>
                <button className="text-button" onClick={() => inputRef.current?.click()}><Plus size={14} /> Import</button>
              </div>
            </div>

            {visibleTracks.length ? (
              <div className="song-grid">
                {visibleTracks.map((item, position) => {
                  const index = visibleIndices[position]
                  const isLiked = liked.includes(index)
                  const isQueued = queue.includes(index)
                  return (
                    <motion.div
                      className={index === current ? 'song-card glass selected' : 'song-card glass'}
                      data-track-index={index}
                      whileHover={{ y: -5, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      key={`${item.title}-${index}`}
                    >
                      <button className="song-main" onClick={() => playTrack(index)}>
                        <div className="cover" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color2} 55%, #111827)` }}>
                          <div className="cover-glow" />
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <div className="cover-center"><Music2 size={22} /></div>
                          <div className="cover-play">
                            {index === current && playing ? <Pause size={17} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                          </div>
                        </div>
                        <div className="song-info"><strong>{item.title}</strong><small>{item.artist}</small></div>
                      </button>

                      <div className="card-tools">
                        <button className={isLiked ? 'icon-tool liked' : 'icon-tool'} onClick={() => toggleLike(index)} title="Like">
                          <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                        </button>
                        <button className={isQueued ? 'icon-tool queued' : 'icon-tool'} onClick={() => isQueued ? removeFromQueue(index) : addToQueue(index)} title={isQueued ? 'Remove from queue' : 'Add to queue'}>
                          <ListMusic size={15} />
                        </button>
                        <button className="icon-tool" onClick={() => addToPlaylist(index)} title="Add to playlist">
                          <Plus size={15} />
                        </button>
                        {item.url && (
                          <button className="icon-tool danger" onClick={() => removeTrack(index)} title="Remove">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {index === current && playing && <div className="queue-playing">ĐANG PHÁT</div>}
                      <div className="card-line" style={{ background: `linear-gradient(90deg, ${item.color}, ${item.color2})` }} />
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state glass">
                <Music2 size={34} />
                <strong>Nothing here yet</strong>
                <span>Import music or add tracks to this collection.</span>
                <button className="secondary" onClick={() => inputRef.current?.click()}><Upload size={16} /> Thêm nhạc</button>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="player glass">
        <div className="player-spectrum"><canvas ref={canvasRef} className="visualizer player-visualizer" /></div>
        <div className="now player-content">
          <div className="now-cover" style={{ background: `linear-gradient(135deg, ${track.color}, ${track.color2})` }}><Music2 size={22} /></div>
          <div><strong>{track.title}</strong><small>{track.artist}</small></div>
        </div>

        <div className="controls player-content">
          <div className="control-row">
            <button className={shuffle ? 'control active-control' : 'control'} onClick={() => setShuffle((value) => !value)} title="Shuffle"><Shuffle size={16} /></button>
            <button className="control" onClick={previousTrack} title="Previous"><SkipBack size={19} fill="currentColor" /></button>
            
            <motion.button
              className="play-main"
              onClick={togglePlay}
              whileTap={{ scale: 0.88 }}
              animate={{ boxShadow: [`0 0 20px ${track.color}`, `0 0 42px ${track.color}`, `0 0 20px ${track.color}`] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ background: `linear-gradient(135deg, ${track.color}, ${track.color2})` }}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
            </motion.button>
            
            <button className="control" onClick={nextTrack} title="Next"><SkipForward size={19} fill="currentColor" /></button>
            <button className={repeat ? 'control active-control' : 'control'} onClick={() => setRepeat((value) => !value)} title="Repeat"><Repeat2 size={16} /></button>
          </div>

          <div className="progress-wrap">
            <span>{formatTime(progress)}</span>
            <input
              className="progress-input"
              type="range"
              min="0"
              max={duration || 0}
              value={Math.min(progress, duration || 0)}
              onMouseDown={() => setDragging(true)}
              onMouseUp={() => setDragging(false)}
              onTouchStart={() => setDragging(true)}
              onTouchEnd={() => setDragging(false)}
              onChange={(event) => seek(Number(event.target.value))}
              style={{ '--range-color': track.color } as CSSProperties}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="volume">
          <Volume2 size={18} />
          <input className="volume-input" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} style={{ '--range-color': track.color } as CSSProperties} />
        </div>
      </footer>

      {authOpen && (
        <div className="auth-backdrop" onMouseDown={() => setAuthOpen(false)}>
          <div className="auth-modal glass" onMouseDown={(event) => event.stopPropagation()}>
            {userEmail ? (
              <>
                <div className="auth-icon"><User size={24} /></div>
                <div className="eyebrow">TÀI KHOẢN</div>
                <h2>Xin chào!</h2>
                <p className="auth-subtitle">{userEmail}</p>
                <button className="auth-submit logout-button" onClick={handleLogout}><LogOut size={17} /> Đăng xuất</button>
                <button className="auth-close" onClick={() => setAuthOpen(false)}>Đóng</button>
              </>
            ) : (
              <>
                <div className="auth-tabs">
                  <button className={authMode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setAuthMode('login'); setAuthError('') }}><LogIn size={16} /> Đăng nhập</button>
                  <button className={authMode === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setAuthMode('register'); setAuthError('') }}><UserPlus size={16} /> Đăng ký</button>
                </div>
                <div className="auth-icon"><User size={24} /></div>
                <h2>{authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h2>
                <p className="auth-subtitle">{authMode === 'login' ? 'Đăng nhập để tiếp tục với VANH MUSIC.' : 'Đăng ký để lưu tài khoản của bạn.'}</p>
                <form className="auth-form" onSubmit={handleAuthSubmit}>
                  {authMode === 'register' && <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Tên của bạn" autoComplete="name" />}
                  <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" autoComplete="email" />
                  <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Mật khẩu" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
                  {authError && <div className="auth-error">{authError}</div>}
                  <button className="auth-submit" type="submit" disabled={authLoading}>{authLoading ? 'Đang xử lý...' : authMode === 'login' ? <><LogIn size={17} /> Đăng nhập</> : <><UserPlus size={17} /> Tạo tài khoản</>}</button>
                </form>
                <button className="auth-close" onClick={() => setAuthOpen(false)}>Đóng</button>
              </>
            )}
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept="audio/*" multiple hidden onChange={handleFiles} />
    </div>
  )
}

export default App