import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { listOwnedRows, upsertOwnedRow, deleteOwnedRows } from '@/lib/cloud/supabaseRepo'
import { supabase } from '@/config/supabase'
import { useLocale } from '@/i18n'
import { 
  ArrowLeft, 
  Send, 
  Sparkles, 
  Paperclip, 
  Image as ImageIcon, 
  PenTool, 
  HelpCircle,
  Brain,
  Layers,
  Info,
  Clock,
  RotateCcw,
  Activity,
  CheckCircle2,
  ChevronDown,
  BookOpen,
  FileText,
  X,
  File,
  Check,
  TrendingUp,
  Award,
  Lightbulb,
  UploadCloud,
  Layers3,
  AlertCircle,
  AlertTriangle,
  PieChart,
  Compass,
  Camera
} from 'lucide-react'
import { LatexRenderer } from '../components/LatexRenderer'
import { lazy, Suspense } from 'react'
import type { WhiteboardElement } from '../components/Whiteboard'

const Whiteboard = lazy(() => import('../components/Whiteboard').then(m => ({ default: m.Whiteboard })))
import { scheduleFSRS, SRCard } from '../lib/fsrs'
import { calculateMasteryScore } from '../lib/mastery'
import { splitIntoChunksWithBoundaries, Chunk, ChunkMetadata } from '../lib/chunking'
import { buildErrorIndex, matchChunkToConcepts, buildConceptKeywordMap } from '../lib/errorIndex'
import { cleanLatex } from '../lib/latexCleaner'
import { eventBus } from '@/events'
import { CalibrationChart, ErrorTypeChart } from '../components/StudyStatsChart'

interface AttachedFile {
  id: string
  name: string
  type: 'document' | 'image'
  size?: string
  dataUrl?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  hintLevel?: number
  mode?: 'socratic' | 'feynman' | 'free'
  feynmanResult?: {
    score: number
    feedback: string
    gaps: string[]
    mnemonic: string
  }
  attachments?: AttachedFile[]
}

interface Concept {
  id: string
  code: string
  name: string
  description: string
  mastery?: number
  prerequisite_id?: string
}

const DEFAULT_CONCEPTS: Concept[] = [
  { id: 'math101', code: 'MATH101', name: 'Limit ve Süreklilik', description: 'Limit kavramı, limit alma kuralları, süreklilik tanımı ve sandviç teoremi.', mastery: 0 },
  { id: 'math102', code: 'MATH102', name: 'Türev ve Uygulamaları', description: 'Türev tanımı, türev alma kuralları, zincir kuralı, maksimum/minimum problemleri ve grafik çizimi.', mastery: 0, prerequisite_id: 'math101' },
  { id: 'math103', code: 'MATH103', name: 'İntegral ve Alan Hesabı', description: 'Belirsiz integral, belirli integral, Riemann toplamları ve integral yardımıyla alan/hacim hesaplama.', mastery: 0, prerequisite_id: 'math102' },
  { id: 'math104', code: 'MATH104', name: 'Kısmi İntegrasyon', description: 'Kısmi integral formülü, değişken değiştirme ile karmaşık integral çözümleri ve integral teknikleri.', mastery: 0, prerequisite_id: 'math103' },
  { id: 'phys101', code: 'PHYS101', name: 'Newton\'ın Hareket Yasaları', description: 'Kuvvet, kütle, ivme, serbest cisim diyagramları, statik ve kinetik sürtünme kuvvetleri.', mastery: 0, prerequisite_id: 'math102' },
  { id: 'phys102', code: 'PHYS102', name: 'İş ve Enerji Teoremi', description: 'İş tanımı, kinetik enerji, potansiyel enerji, mekanik enerjinin korunumu ve korunumsuz kuvvetlerin işi.', mastery: 0, prerequisite_id: 'phys101' },
  { id: 'phys103', code: 'PHYS103', name: 'Elektriksel Potansiyel ve Güç', description: 'Elektriksel alan, elektriksel potansiyel farkı, iş, güç ve elektrik potansiyel enerjisi.', mastery: 0, prerequisite_id: 'phys102' },
  { id: 'eee201', code: 'EEE201', name: 'Devre Analizi ve Kirchhoff Yasaları', description: 'Kirchhoff Akım Yasası (KCL), Kirchhoff Voltaj Yasası (KVL), düğüm gerilimleri yöntemi ve çevre akımları yöntemi.', mastery: 0, prerequisite_id: 'phys103' }
]

interface DocumentRow {
  id: string
  title: string
  file_path: string
  file_type: string
  size: number
  created_at: string
}

export function LearnChat() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialConceptId = searchParams.get('conceptId')
  const initialConceptName = searchParams.get('conceptName')
  const initialMode = searchParams.get('mode') as 'socratic' | 'feynman' | 'free' || 'socratic'

  // Translations
  const locale = useLocale()
  const isTr = locale === 'tr'

  const dict = {
    title: isTr ? 'STEMA Çalışma Alanı' : 'STEMA Workspace',
    socraticMode: isTr ? 'Sokratik Eğitim' : 'Socratic Learning',
    feynmanMode: isTr ? 'Feynman Hakemi' : 'Feynman Referee',
    freeMode: isTr ? 'Serbest Analiz' : 'Free Analysis',
    resetSession: isTr ? 'Sohbeti Yenile' : 'Reset Session',
    workbenchOpen: isTr ? 'Workbench Aç' : 'Open Workbench',
    workbenchClose: isTr ? 'Workbench Kapat' : 'Close Workbench',
    activeTopic: isTr ? 'Şu an çalışan konu' : 'Current topic',
    activeHintLevel: isTr ? 'İpucu Kademesi' : 'Hint Level',
    evaluationScore: isTr ? 'Değerlendirme Puanı' : 'Evaluation Score',
    conceptualGaps: isTr ? 'Kavramsal Boşluklar' : 'Conceptual Gaps',
    memoryAnchor: isTr ? 'Hafıza Çapası (Mnemonic)' : 'Memory Anchor (Mnemonic)',
    whiteboardTab: isTr ? 'Beyaz Tahta' : 'Whiteboard',
    flashcardsTab: isTr ? 'Tekrar Kartları' : 'FSRS Cards',
    notesTab: isTr ? 'Ders Notları' : 'Notes',
    conceptsTab: isTr ? 'Kavramlar' : 'Concepts',
    notesTabDesc: isTr ? 'RAG analizi için ders notu ve döküman ekleyin.' : 'Upload study materials for RAG analysis.',
    notesTabEmpty: isTr ? 'Kütüphaneye eklenmiş ders notu bulunmamaktadır.' : 'No study materials in the library.',
    flashcardsEmpty: isTr ? 'Şu an çalışılması gereken kartınız bulunmamaktadır.' : 'No cards due for review.',
    evaluationLoading: isTr ? 'Feynman Hakemi anlatımınızı inceliyor...' : 'Feynman Referee evaluating your explanation...',
    inputPlaceholderSocratic: isTr ? 'STEM sorunuzu sorun (örn: Limit, integral)...' : 'Ask your STEM question...',
    inputPlaceholderFeynman: isTr ? 'Seçilen konuyu basitleştirerek anlatın...' : 'Explain the selected topic in simple terms...',
    inputPlaceholderFree: isTr ? 'Genel STEM analizi için sorunuzu sorun...' : 'Ask for general STEM analysis...',
    attachFile: isTr ? 'Dosya Ekle' : 'Attach File',
    attachImage: isTr ? 'Resim/Çizim Ekle' : 'Attach Image',
    whiteboardDesc: isTr ? 'Teoremleri, denklemleri ve grafikleri burada karalayabilir, asistanın çizimlerini inceleyebilirsiniz.' : 'Sketch theorems, equations and graphs here, and view agent drawings.',
    masteryLevel: isTr ? 'Hakimiyet Seviyesi' : 'Mastery Level'
  }

  const suggestions = {
    socratic: isTr ? [
      { text: 'İpucu ver', value: 'Bana bir sonraki ipucunu verebilir misin?' },
      { text: 'Formülü açıkla', value: 'Bu formülün arkasındaki temel mantık nedir?' },
      { text: 'Doğru mu?', value: 'Yaptığım çözüm adımları doğru mu?' }
    ] : [
      { text: 'Give a hint', value: 'Can you give me the next hint?' },
      { text: 'Explain formula', value: 'What is the basic logic behind this formula?' },
      { text: 'Is it correct?', value: 'Is my solution step correct?' }
    ],
    feynman: isTr ? [
      { text: 'Örnek Anlatım', value: 'Bu konuyu basit bir dille nasıl özetleyebilirim?' },
      { text: 'Kilit Kavramlar', value: 'Bu konuda kesinlikle değinmem gereken anahtar kelimeler nelerdir?' }
    ] : [
      { text: 'Sample Explanation', value: 'How can I summarize this topic in simple terms?' },
      { text: 'Key Concepts', value: 'What key concepts should I definitely mention?' }
    ],
    free: isTr ? [
      { text: 'Çizimi açıkla', value: 'Beyaz tahtaya çizdiğim grafik modelini analiz edebilir misin?' },
      { text: 'Türev Grafiği çiz', value: 'Bana sin(x) fonksiyonunun türevini grafik olarak çizip açıklayabilir misin?' }
    ] : [
      { text: 'Explain drawing', value: 'Can you analyze the graph model I sketched on the whiteboard?' },
      { text: 'Plot derivative', value: 'Can you plot the derivative of sin(x) as a graph and explain it?' }
    ]
  }

  // Workspace Core States
  const [mode, setMode] = useState<'socratic' | 'feynman' | 'free'>(initialMode)
  const [selectedConceptId, setSelectedConceptId] = useState<string>(initialConceptId || '')
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestProgress, setIngestProgress] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  
  // Chat States
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hintLevel, setHintLevel] = useState<number>(0)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docUploadInputRef = useRef<HTMLInputElement>(null)

  // Layout & Workbench States
  const [workbenchTab, setWorkbenchTab] = useState<'whiteboard' | 'flashcards' | 'notes' | 'concepts'>('whiteboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showScrollDown, setShowScrollDown] = useState(false)
  
  // Whiteboard drawing elements fed by the AI agent
  const [agentElements, setAgentElements] = useState<WhiteboardElement[]>([])

  // Flashcard States
  const [dueCards, setDueCards] = useState<SRCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isCardFlipped, setIsCardFlipped] = useState(false)
  const [flashcardsReviewedCount, setFlashcardsReviewedCount] = useState(0)

  // Phase 11: OCR & Multimodal states
  const [ocrModalImage, setOcrModalImage] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<string>('')
  const [ocrEditedResult, setOcrEditedResult] = useState<string>('')
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [showOcrModal, setShowOcrModal] = useState(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Metacognitive & Analytics States
  const [errorLogs, setErrorLogs] = useState<any[]>([])
  const [tutorEvents, setTutorEvents] = useState<any[]>([])
  const [allCards, setAllCards] = useState<SRCard[]>([])
  const [showMetacognitivePrompt, setShowMetacognitivePrompt] = useState(false)
  const [conceptsSubTab, setConceptsSubTab] = useState<'tree' | 'calibration' | 'errors'>('tree')

  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleScroll = () => {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
    setShowScrollDown(!isAtBottom)
  }

  // Fetch initial workspace data (concepts, documents, due flashcards)
  const fetchWorkspaceData = async () => {
    try {
      const user = useAuthStore.getState().session?.user
      if (!user) return

      // 1. Fetch concepts
      const conceptData = await listOwnedRows('concepts', { orderBy: 'code', ascending: true })

      // 2. Fetch error logs
      const errorLogsData = await listOwnedRows('error_logs')
      const currentErrors = errorLogsData || []
      setErrorLogs(currentErrors)

      // 3. Fetch tutor events
      const tutorEventsData = await listOwnedRows('tutor_events')
      const currentEvents = tutorEventsData || []
      setTutorEvents(currentEvents)

      // 4. Fetch all flashcards
      const allCardsData = await listOwnedRows('sr_cards')
      const currentAllCards = (allCardsData || []) as SRCard[]
      setAllCards(currentAllCards)

      // 5. Fetch concept mastery
      const masteryData = await listOwnedRows('concept_mastery')

      const masteryMap: Record<string, number> = {}
      masteryData?.forEach((m: any) => {
        masteryMap[m.concept_id] = Number(m.score)
      })

      // Resolve concepts list (use database or fallback)
      let resolvedConcepts: Concept[] = []
      if (conceptData && conceptData.length > 0) {
        resolvedConcepts = conceptData.map((c: any) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          description: c.description || '',
          prerequisite_id: c.prerequisite_id || undefined,
          mastery: masteryMap[c.id] || 0
        }))
      } else {
        // Fallback to local default concepts
        resolvedConcepts = DEFAULT_CONCEPTS.map(c => ({
          ...c,
          mastery: masteryMap[c.id] || 0
        }))
      }

      // 6. Recalculate Mastery Score for each concept using the 3-Evidence Algorithm (8.1)
      const updatedConcepts: Concept[] = []
      for (const concept of resolvedConcepts) {
        // Calculate Socratic successes
        const socraticSuccessCount = currentEvents.filter(
          (e: any) => e.event_type === 'socratic_success' && e.payload?.concept_id === concept.id
        ).length

        // Calculate Feynman best score
        const feynmanEvents = currentEvents.filter(
          (e: any) => e.event_type === 'feynman_evaluation' && e.payload?.concept_id === concept.id
        )
        const maxFeynmanScore = feynmanEvents.length > 0
          ? Math.max(0, ...feynmanEvents.map((e: any) => Number(e.payload?.score || 0)))
          : 0

        // Calculate Card successes (Good or Easy rating reviews)
        const cardSuccessCount = currentEvents.filter(
          (e: any) => e.event_type === 'flashcard_review' && 
               e.payload?.concept_id === concept.id && 
               (e.payload?.rating === 3 || e.payload?.rating === 4)
        ).length

        const calculatedScore = calculateMasteryScore({
          socraticSuccessCount,
          maxFeynmanScore,
          cardSuccessCount
        })

        // Check if score changed, if so upsert to concept_mastery
        const oldScore = masteryMap[concept.id] || 0
        if (calculatedScore !== oldScore && concept.id.length > 10) { // check if valid UUID (fallback has short ids)
          try {
            await upsertOwnedRow('concept_mastery', {
              id: `${user.id}_${concept.id}`,
              concept_id: concept.id,
              score: calculatedScore,
              evidence_count: socraticSuccessCount + (feynmanEvents.length > 0 ? 1 : 0) + (cardSuccessCount > 0 ? 1 : 0),
            })
          } catch (upsertErr) {
            console.error('Error upserting concept mastery:', upsertErr)
          }
        }

        updatedConcepts.push({
          ...concept,
          mastery: calculatedScore
        })
      }

      setConcepts(updatedConcepts)
      
      // Auto-select first concept if none is set
      if (!selectedConceptId && updatedConcepts.length > 0) {
        setSelectedConceptId(updatedConcepts[0].id)
      }

      // 7. Fetch documents
      const docData = await listOwnedRows('documents', { orderBy: 'created_at', ascending: false })
      if (docData) setDocuments(docData as DocumentRow[])

      // 8. Fetch due flashcards
      const cardData = await listOwnedRows('sr_cards')
      if (cardData) {
        const nowStr = new Date().toISOString()
        const due = cardData.filter((card: any) => card.due_at <= nowStr)
        due.sort((a: any, b: any) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
        setDueCards(due as SRCard[])
      }

    } catch (err) {
      console.error('Error fetching workspace data:', err)
    }
  }

  useEffect(() => {
    fetchWorkspaceData()
  }, [])

  // Initialize Chat Session based on selected Mode and Concept
  const initChat = () => {
    const activeConcept = concepts.find(c => c.id === selectedConceptId)
    const conceptNameStr = activeConcept ? `"${activeConcept.name}"` : (isTr ? 'seçilen konu' : 'selected topic')
    setAgentElements([]) // Clear drawings on session switch
    
    // Set metacognitive prompt visible at Socratic initiation
    setShowMetacognitivePrompt(mode === 'socratic')

    if (mode === 'socratic') {
      setMessages([
        {
          id: 'init',
          role: 'assistant',
          content: isTr 
            ? `Merhaba! ${conceptNameStr} konusu üzerinde çalışmak için hazırım. Doğrudan cevap vermek yerine, ipuçları ve yönlendirici sorularla doğru cevabı bulmanızı sağlayacağım. İlk adım olarak aklınıza takılan yeri veya çözmek istediğiniz soruyu sorabilirsiniz.`
            : `Hello! I am ready to study the topic ${conceptNameStr}. Instead of giving direct answers, I will help you find the right answers with hints and guidance. Please start by asking your questions.`,
          mode: 'socratic'
        }
      ])
      setHintLevel(0)
    } else if (mode === 'feynman') {
      setMessages([
        {
          id: 'init',
          role: 'assistant',
          content: isTr
            ? `Feynman Tekniği Çalışma Moduna hoş geldiniz! Bu yönteme göre bir konuyu en iyi öğrenme yolu, onu başkasına anlatmaktır. Lütfen aşağıdaki giriş kutusuna ${conceptNameStr} konusunu hiç bilmeyen birine anlatır gibi kendi cümlelerinizle açıklayın. Anlatımınız bittiğinde hakem olarak eksiklerinizi ve kavramsal boşluklarınızı analiz edeceğim.`
            : `Welcome to the Feynman Explainer Mode! The best way to learn is to explain it to someone else. Please write your explanation of ${conceptNameStr} in the input box as if you were teaching it to a beginner. I will then evaluate your conceptual gaps.`,
          mode: 'feynman'
        }
      ])
    } else {
      setMessages([
        {
          id: 'init',
          role: 'assistant',
          content: isTr
            ? `Serbest STEM Analizi Modu aktif. Matematik, fizik veya kodlama konularında genel sorularınızı sorabilir, whiteboard üzerindeki çizimlerinizi sohbete ekleyerek fikir alabilirsiniz.`
            : `Free STEM Analysis Mode is active. Feel free to ask general questions in math, physics, or coding, or attach whiteboard drawings to get feedback.`,
          mode: 'free'
        }
      ])
    }
  }

  const handleSaveMetacognitivePrediction = async (val: number) => {
    const user = useAuthStore.getState().session?.user
    if (!user) return

    try {
      await upsertOwnedRow('tutor_events', {
        event_type: 'metacognitive_prediction',
        payload: {
          concept_id: selectedConceptId,
          prediction: val,
          timestamp: new Date().toISOString()
        }
      })

      setShowMetacognitivePrompt(false)
      fetchWorkspaceData()

      const userText = isTr
        ? `Bu konudaki güven seviyemi ${val}/5 olarak seçtim. Çalışmaya hazırız!`
        : `I selected my confidence level as ${val}/5. Let's start studying!`

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: userText
        }
      ])

      await runChatAPI(userText)
    } catch (err) {
      console.error('Error saving metacognitive prediction:', err)
    }
  }

  useEffect(() => {
    if (concepts.length > 0) {
      initChat()
    }
  }, [mode, selectedConceptId, concepts.length])

  // Attach visual drawings from whiteboard
  const handleAttachWhiteboardImage = (dataUrl: string) => {
    const newAttachment: AttachedFile = {
      id: crypto.randomUUID(),
      name: `tahta_cizimi_${attachments.length + 1}.png`,
      type: 'image',
      dataUrl
    }
    setAttachments(prev => [...prev, newAttachment])
  }

  // Handle local file uploads (PDF / Text)
  const handleLocalFileSelection = (e: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'image') => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const reader = new FileReader()

    reader.onload = () => {
      const dataUrl = reader.result as string
      const newAttachment: AttachedFile = {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        dataUrl
      }
      setAttachments(prev => [...prev, newAttachment])
    }
    
    if (type === 'image') {
      reader.readAsDataURL(file)
    } else {
      reader.readAsText(file)
    }
  }

  // Dynamic script loader for PDF.js and helper reader functions
  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        resolve(pdfjsLib)
      }
      script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'))
      document.head.appendChild(script)
    })
  }

  const chunkTextSmart = (text: string, pageNumber: number = 1): Chunk[] => {
    const loadedConcepts = concepts.length > 0 ? concepts : DEFAULT_CONCEPTS
    return splitIntoChunksWithBoundaries(text, loadedConcepts, pageNumber)
  }

  // Upload Ders Notu to Database with smart chunking, metadata enrichment & error index matching
  const handleUploadDocumentToDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const user = useAuthStore.getState().session?.user
    if (!user) return

    setIsIngesting(true)
    setIngestProgress(isTr ? 'Dosya okunuyor...' : 'Reading file...')

    let documentId = ''
    try {
      // 0. Build error index for concept-to-chunk matching (10.5)
      const errorIndexData = buildErrorIndex(errorLogs)
      const conceptMap = buildConceptKeywordMap(concepts.length > 0 ? concepts : DEFAULT_CONCEPTS)

      // 1. Read document text content
      let textContent = ''
      const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt'
      const chunks: Array<{ content: string; metadata: any }> = []

      if (fileType === 'txt') {
        textContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (ev) => resolve(ev.target?.result as string || '')
          reader.onerror = (err) => reject(err)
          reader.readAsText(file)
        })
        const smartChunks = chunkTextSmart(textContent, 1)
        smartChunks.forEach(chunk => {
          // Enrich with concept tags via keyword matching
          const matchedConcepts = matchChunkToConcepts(chunk.content, conceptMap)
          const enrichedMetadata: ChunkMetadata = {
            ...chunk.metadata,
            concept_tags: [...new Set([...(chunk.metadata.concept_tags || []), ...matchedConcepts])],
          }
          // Mark error-prone concepts in metadata (10.5)
          const errorRelated = matchedConcepts.filter(cid => errorIndexData[cid])
          if (errorRelated.length > 0) {
            enrichedMetadata.error_related_concepts = errorRelated
            enrichedMetadata.error_frequencies = errorRelated.map(cid => ({
              concept_id: cid,
              frequency: errorIndexData[cid].frequency,
              types: errorIndexData[cid].errorTypes,
            }))
          }
          chunks.push({
            content: chunk.content,
            metadata: enrichedMetadata,
          })
        })
      } else if (fileType === 'pdf') {
        setIngestProgress(isTr ? 'PDF kütüphanesi yükleniyor...' : 'Loading PDF engine...')
        const pdfjsLib = await loadPdfJs()
        
        setIngestProgress(isTr ? 'PDF sayfaları ayrıştırılıyor...' : 'Parsing PDF pages...')
        const arrayBuffer = await file.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdf = await loadingTask.promise
        
        for (let i = 1; i <= pdf.numPages; i++) {
          setIngestProgress(isTr ? `Sayfa ${i} / ${pdf.numPages} ayrıştırılıyor...` : `Parsing page ${i} of ${pdf.numPages}...`)
          const page = await pdf.getPage(i)
          const textCont = await page.getTextContent()
          const pageText = textCont.items.map((item: any) => item.str).join(' ')
          
          if (!pageText.trim()) continue
          
          const smartChunks = chunkTextSmart(pageText, i)
          smartChunks.forEach(chunk => {
            const matchedConcepts = matchChunkToConcepts(chunk.content, conceptMap)
            const enrichedMetadata: ChunkMetadata = {
              ...chunk.metadata,
              concept_tags: [...new Set([...(chunk.metadata.concept_tags || []), ...matchedConcepts])],
            }
            const errorRelated = matchedConcepts.filter(cid => errorIndexData[cid])
            if (errorRelated.length > 0) {
              enrichedMetadata.error_related_concepts = errorRelated
              enrichedMetadata.error_frequencies = errorRelated.map(cid => ({
                concept_id: cid,
                frequency: errorIndexData[cid].frequency,
                types: errorIndexData[cid].errorTypes,
              }))
            }
            chunks.push({
              content: chunk.content,
              metadata: enrichedMetadata,
            })
          })
        }
      } else {
        throw new Error(isTr ? 'Sadece .txt ve .pdf dosyaları desteklenmektedir.' : 'Only .txt and .pdf files are supported.')
      }

      if (chunks.length === 0) {
        throw new Error(isTr ? 'Dosyadan metin okunamadı veya dosya boş.' : 'No text could be extracted or the file is empty.')
      }

      // 2. Upload file to Supabase Storage (optional / try-catch)
      setIngestProgress(isTr ? 'Ders notu kaydediliyor...' : 'Saving study material...')
      const filePath = `${user.id}/${Date.now()}_${file.name}`

      let uploadError = null
      try {
        const { error } = await supabase.storage.from('documents').upload(filePath, file, { contentType: file.type })
        if (error) throw error
      } catch (err) {
        uploadError = err
      }

      // 3. Insert record into documents table
      const docPayload = {
        title: file.name,
        file_path: uploadError ? `local_fallback/${file.name}` : filePath,
        file_type: fileType,
        size: file.size
      }
      
      const docData = await upsertOwnedRow('documents', docPayload)
      documentId = docData.id

      // 4. Send chunks to /api/documents/ingest for embedding extraction & storage
      setIngestProgress(isTr ? `Embedding alınıyor ve indeksleniyor (${chunks.length} parça)...` : `Generating embeddings & indexing (${chunks.length} chunks)...`)
      
      const token = useAuthStore.getState().session?.accessToken || ''
      const ingestResponse = await fetch('/api/documents/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentId,
          chunks
        })
      })

      if (!ingestResponse.ok) {
        const errData = await ingestResponse.json()
        throw new Error(errData.error || 'Ingestion API returned an error')
      }

      setIngestProgress(isTr ? 'Başarıyla indekslendi!' : 'Successfully indexed!')
      setTimeout(() => {
        setIsIngesting(false)
        setIngestProgress('')
      }, 1500)

      fetchWorkspaceData()
    } catch (err: any) {
      console.error('Ingestion failed:', err)
      if (documentId) {
        await deleteOwnedRows('documents', [{ column: 'id', value: documentId }])
      }
      alert(isTr ? `Yükleme başarısız oldu: ${err.message}` : `Upload failed: ${err.message}`)
      setIsIngesting(false)
      setIngestProgress('')
    }

    // Reset file input
    if (e.target) e.target.value = ''
  }

  // Remove attached file
  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  // Phase 11: Real OCR via Gemini Flash (11.3)
  const runOcrOnImage = async (dataUrl: string): Promise<string> => {
    try {
      const token = useAuthStore.getState().session?.accessToken || ''
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ image: dataUrl }),
      })
      if (!response.ok) throw new Error('OCR API failed')
      const result = await response.json()
      const raw = result.latex || ''
      const { cleaned } = cleanLatex(raw)
      return cleaned || raw
    } catch (err) {
      console.error('OCR error:', err)
      return ''
    }
  }

  // OCR verification modal (11.5)
  const openOcrModal = (dataUrl: string) => {
    setOcrModalImage(dataUrl)
    setOcrResult('')
    setOcrEditedResult('')
    setShowOcrModal(true)
    setIsOcrProcessing(true)

    runOcrOnImage(dataUrl).then(latex => {
      setOcrResult(latex)
      setOcrEditedResult(latex)
      setIsOcrProcessing(false)
    })
  }

  const confirmOcrResult = () => {
    if (!ocrModalImage) return
    const newAttachment: AttachedFile = {
      id: crypto.randomUUID(),
      name: `ocr_${Date.now()}.png`,
      type: 'image',
      dataUrl: ocrModalImage,
    }
    setAttachments(prev => [...prev, newAttachment])

    // Inject OCR text as pending input
    if (ocrEditedResult.trim()) {
      setInput(prev => {
        const sep = prev.trim() ? '\n' : ''
        return prev + sep + ocrEditedResult
      })
    }
    setShowOcrModal(false)
    setOcrModalImage(null)
  }

  const cancelOcrConfirm = () => {
    setShowOcrModal(false)
    setOcrModalImage(null)
  }

  // Formula OCR / Document text extraction based on attachments
  const processAttachmentsText = (atts: AttachedFile[]): string => {
    let documentRAG = ''
    atts.forEach(att => {
      if (att.type !== 'image') {
        documentRAG += `\n[Ders Notu: "${att.name}" eklendi.]`
      }
    })
    return documentRAG
  }

  // Submit message & Call API with real OCR for images (11.3)
  const handleSend = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault()
    const targetText = customText || input
    if (!targetText.trim() && attachments.length === 0 || isLoading) return

    setInput('')
    const currentAttachments = [...attachments]
    setAttachments([])

    const userMessageId = crypto.randomUUID()

    // Run OCR on image attachments before sending (11.3)
    let ocrText = ''
    for (const att of currentAttachments) {
      if (att.type === 'image' && att.dataUrl) {
        const result = await runOcrOnImage(att.dataUrl)
        if (result) ocrText += `\n[OCR: ${result}]`
      }
    }

    const newUserMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: targetText,
      attachments: currentAttachments
    }

    setMessages(prev => [...prev, newUserMessage])

    const metaPrompt = processAttachmentsText(currentAttachments)
    const finalUserPrompt = targetText + ocrText + metaPrompt

    if (mode === 'feynman') {
      await runFeynmanAPI(finalUserPrompt, userMessageId)
    } else {
      await runChatAPI(finalUserPrompt)
    }
  }

  // Feynman Technique API Execution
  const runFeynmanAPI = async (userText: string, userMsgId: string) => {
    setIsLoading(true)
    const assistantMsgId = crypto.randomUUID()
    
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      content: dict.evaluationLoading,
      mode: 'feynman'
    }])

    try {
      const activeConcept = concepts.find(c => c.id === selectedConceptId)
      const token = useAuthStore.getState().session?.accessToken || ''
      const response = await fetch('/api/feynman', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conceptName: activeConcept?.name || 'STEM Konusu',
          conceptDescription: activeConcept?.description || '',
          userExplanation: userText,
          conceptId: selectedConceptId || undefined
        })
      })

      if (!response.ok) throw new Error('Referee API error')

      const resultData = await response.json()
      
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMsgId
          ? {
              ...msg,
              content: resultData.feedback,
              feynmanResult: {
                score: resultData.score,
                feedback: resultData.feedback,
                gaps: resultData.gaps || [],
                mnemonic: resultData.mnemonic || ''
              }
            }
          : msg
      ))

      // Trigger agent drawings onto whiteboard reactively
      if (resultData.whiteboardCommands) {
        setAgentElements(resultData.whiteboardCommands)
        setWorkbenchTab('whiteboard') // Auto focus drawing screen
      }

      fetchWorkspaceData()

    } catch (err: any) {
      console.error('Feynman API call error:', err)
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMsgId 
          ? { ...msg, content: '⚠️ Feynman Hakem değerlendirmesi başarısız oldu.' }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  // Socratic / Free Tutor Streaming API Execution
  const runChatAPI = async (userText: string) => {
    setIsLoading(true)
    const assistantMessageId = crypto.randomUUID()
    
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      mode
    }])

    try {
      const token = useAuthStore.getState().session?.accessToken || ''
      
      const historyPayload = messages.map(m => ({ 
        role: m.role, 
        content: m.content + (m.attachments ? processAttachmentsText(m.attachments) : '')
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: historyPayload,
          userMessage: userText,
          sessionId: currentSessionId || undefined,
          conceptId: selectedConceptId || undefined
        })
      })

      if (!response.ok) throw new Error(`API Connection Failed: ${response.statusText}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Response stream unavailable')

      const decoder = new TextDecoder()
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        
        let cleanChunk = chunk
        const sessionMatch = chunk.match(/\[SESSION_ID:([^\]]+)\]/)
        if (sessionMatch) {
          setCurrentSessionId(sessionMatch[1])
          cleanChunk = chunk.replace(/\[SESSION_ID:[^\]]+\]\n?/, '')
        }

        let tempText = accumulatedText + cleanChunk
        let detectedHintLevel: number | undefined = undefined
        const hintMatch = tempText.match(/\[HINT_LEVEL:(\d)\]/)
        
        if (hintMatch) {
          const newLevel = parseInt(hintMatch[1], 10)
          detectedHintLevel = newLevel
          setHintLevel(newLevel)
          tempText = tempText.replace(/\[HINT_LEVEL:\d\]\n?/, '')
        }
        
        // Extract agent whiteboard drawing commands dynamically
        const drawMatches = Array.from(tempText.matchAll(/\[WHITEBOARD_DRAW:\s*({.*?})\s*\]/g))
        const streamElements: WhiteboardElement[] = []
        for (const match of drawMatches) {
          try {
            const parsed = JSON.parse(match[1])
            streamElements.push(parsed)
          } catch (e) {
            // ignore JSON errors while streaming
          }
        }
        if (streamElements.length > 0) {
          setAgentElements(streamElements)
          setWorkbenchTab('whiteboard') // Focus drawings
        }

        tempText = tempText.replace(/\[WHITEBOARD_DRAW:.*?\]\n?/g, '')
        tempText = tempText.replace(/\[ERROR_TYPE:\w+\]\n?/, '')
        accumulatedText = tempText
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                content: accumulatedText, 
                hintLevel: detectedHintLevel !== undefined ? detectedHintLevel : msg.hintLevel 
              }
            : msg
        ))
      }

      fetchWorkspaceData()

    } catch (err: any) {
      console.error('Chat API Error:', err)
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: `⚠️ Bağlantı kurulamadı: ${err.message || err}` }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  // FSRS Flashcard rating logic inside workbench
  const handleRateFlashcard = async (rating: 1 | 2 | 3 | 4) => {
    if (dueCards.length === 0 || currentCardIndex >= dueCards.length) return

    const card = dueCards[currentCardIndex]
    const { id, created_at, ...cardData } = card
    const updates = scheduleFSRS(cardData, rating)

    try {
      await upsertOwnedRow('sr_cards', {
        id: card.id,
        difficulty: updates.difficulty,
        stability: updates.stability,
        reps: updates.reps,
        lapses: updates.lapses,
        state: updates.state,
        last_review: updates.last_review,
        due_at: updates.due_at
      })

      if (updates.due_at) {
        const dueDate = new Date(updates.due_at)
        const conceptName = concepts.find(c => c.id === card.concept_id)?.name || 'Hata Tekrarı'
        await eventBus.publish('LEARN_EVENT_CREATED', {
          title: `Tekrar Görevi: ${conceptName}`,
          dateISO: dueDate.toISOString().slice(0, 10),
          description: `FSRS spaced repetition tekrar görevi.`,
          color: '#d97706'
        })
      }

      const user = useAuthStore.getState().session?.user
      if (user) {
        await upsertOwnedRow('tutor_events', {
          event_type: 'flashcard_review',
          payload: {
            card_id: card.id,
            concept_id: card.concept_id || null,
            rating,
            timestamp: new Date().toISOString()
          }
        })
      }

      setFlashcardsReviewedCount(prev => prev + 1)
      setIsCardFlipped(false)

      setTimeout(() => {
        setCurrentCardIndex(prev => prev + 1)
      }, 200)

    } catch (err) {
      console.error('Error updating flashcard schedule:', err)
    }
  }

  const resetChatSession = () => {
    setCurrentSessionId(null)
    initChat()
  }

  return (
    <div className="flex h-full bg-[var(--bg-primary)] overflow-hidden text-[var(--text-primary)] transition-colors">
      
      {/* ── LEFT PANEL: Consolidated Chat Interface (65% Width) ── */}
      <div className="flex-1 flex flex-col h-full border-r border-[var(--border-subtle)] relative bg-[var(--bg-primary)]">
        
        {/* Chat Header Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-5 relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/planner')}
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            
            {/* Mode selection tabs inside the toolbar */}
            <div className="flex bg-[var(--bg-surface-100)] p-1 rounded border border-[var(--border-subtle)]">
              <button
                onClick={() => setMode('socratic')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded transition-all ${
                  mode === 'socratic' 
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-2xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Brain className="h-3.5 w-3.5" />
                {dict.socraticMode}
              </button>
              <button
                onClick={() => setMode('feynman')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded transition-all ${
                  mode === 'feynman' 
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-2xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {dict.feynmanMode}
              </button>
              <button
                onClick={() => setMode('free')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded transition-all ${
                  mode === 'free' 
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-2xs' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <PenTool className="h-3.5 w-3.5" />
                {dict.freeMode}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              onClick={resetChatSession}
              title={dict.resetSession}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </motion.button>

            <motion.button
              onClick={() => navigate('/learn/map')}
              title={isTr ? 'Zihin Haritası (Görsel Analiz)' : 'Mindmap (Mapping Mode)'}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex h-8 px-2.5 items-center justify-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-xs font-semibold"
            >
              <Compass className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              <span>{isTr ? 'Zihin Haritası' : 'Mindmap'}</span>
            </motion.button>

            <motion.button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex h-8 px-2.5 items-center justify-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-xs font-semibold"
            >
              <Layers3 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              <span>{isSidebarOpen ? dict.workbenchClose : dict.workbenchOpen}</span>
            </motion.button>
          </div>
        </header>

        {/* Chat Feed */}
        <main 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-[var(--bg-surface-100)]/20 scrollbar-thin"
        >
          <div className="mx-auto max-w-2xl space-y-5">
            
            {mode !== 'free' && selectedConceptId && (
              <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg text-xs flex items-center justify-between text-[var(--text-secondary)]">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-[var(--text-secondary)]" />
                  <span>{dict.activeTopic}: <strong>{concepts.find(c => c.id === selectedConceptId)?.name}</strong></span>
                </div>
                
                <select
                  value={selectedConceptId}
                  onChange={(e) => setSelectedConceptId(e.target.value)}
                  className="bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded px-2 py-1 text-2xs font-semibold text-[var(--text-primary)] focus:outline-none"
                >
                  {concepts.map(c => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {messages.map(message => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role !== 'user' && (
                  <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] shadow-3xs mt-1">
                    <Brain className="h-4 w-4" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-lg px-4.5 py-3.5 border leading-relaxed text-sm ${
                  message.role === 'user'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-3xs'
                    : 'bg-[var(--bg-surface-100)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-3xs'
                }`}>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3.5 pb-2 border-b border-[var(--border-subtle)]">
                      {message.attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded text-2xs font-medium text-[var(--text-secondary)]">
                          {att.type === 'image' ? (
                            <>
                              <ImageIcon className="h-3 w-3 text-[var(--text-secondary)]" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                              {att.dataUrl && (
                                <img
                                  src={att.dataUrl}
                                  alt={att.name}
                                  className="h-16 w-auto rounded object-contain border border-[var(--border-subtle)] ml-1 cursor-pointer"
                                  onClick={() => window.open(att.dataUrl, '_blank')}
                                />
                              )}
                            </>
                          ) : (
                            <>
                              <FileText className="h-3 w-3 text-[var(--text-secondary)]" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <LatexRenderer text={message.content} />
                  
                  {message.role === 'assistant' && message.hintLevel && message.hintLevel > 0 && (
                    <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center text-[10px] text-[var(--text-muted)] font-mono">
                      <span className="flex items-center gap-1 font-semibold">
                        <Layers className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        {dict.activeHintLevel}: {message.hintLevel} / 3
                      </span>
                    </div>
                  )}

                  {message.role === 'assistant' && message.feynmanResult && (
                    <div className="mt-4 pt-3.5 border-t border-[var(--border-subtle)] space-y-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text-primary)]">{dict.evaluationScore}:</span>
                        <span className={`px-2.5 py-0.5 rounded-full font-bold font-mono border text-[11px] ${
                          message.feynmanResult.score >= 80 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : message.feynmanResult.score >= 50 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {message.feynmanResult.score} / 100
                        </span>
                      </div>

                      {message.feynmanResult.gaps.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-bold text-[var(--text-primary)] block">{dict.conceptualGaps}:</span>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {message.feynmanResult.gaps.map((gap, gIdx) => (
                              <span key={gIdx} className="px-2 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded text-2xs text-[var(--text-secondary)] font-medium">
                                {gap}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {message.feynmanResult.mnemonic && (
                        <div className="p-3 bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-secondary)] flex items-start gap-1.5">
                          <Lightbulb className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold text-[var(--text-primary)] block text-2xs uppercase tracking-wider font-mono">{dict.memoryAnchor}:</span>
                            <p className="text-2xs leading-relaxed text-[var(--text-secondary)] font-medium">{message.feynmanResult.mnemonic}</p>
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                </div>

                {message.role === 'user' && (
                  <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-100)] text-[var(--text-secondary)] font-bold font-mono text-[10px] shadow-3xs mt-1">
                    U
                  </div>
                )}
              </motion.div>
            ))}

            {mode === 'socratic' && messages.length === 1 && showMetacognitivePrompt && (
              <div className="flex gap-4 justify-start">
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] mt-1">
                  <Brain className="h-4 w-4 text-amber-500" />
                </div>
                <div className="max-w-[85%] rounded-lg px-4.5 py-3.5 border bg-[var(--bg-surface-100)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-3xs">
                  <p className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)] font-mono mb-2">
                    {isTr ? 'Metakognitif Kalibrasyon' : 'Metacognitive Calibration'}
                  </p>
                  <p className="text-sm mb-3">
                    {isTr 
                      ? 'Sokratik çalışmaya başlamadan önce, bu konundaki bilgi seviyenize ve problem çözme becerinize ne kadar güveniyorsunuz?'
                      : 'Before starting, how confident are you in your knowledge and problem-solving skills for this topic?'}
                  </p>
                  
                  <div className="flex gap-2 justify-center mb-2">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => handleSaveMetacognitivePrediction(val)}
                        className="h-10 w-10 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-sm font-bold flex items-center justify-center transition-all active:scale-95 text-[var(--text-primary)]"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] px-2 font-medium">
                    <span>{isTr ? '1: Hiç Güvenmiyorum' : '1: Not Confident'}</span>
                    <span>{isTr ? '5: Tamamen Güveniyorum' : '5: Very Confident'}</span>
                  </div>
                </div>
              </div>
            )}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-4 justify-start">
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] animate-pulse">
                  <Brain className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
                </div>
                <div className="max-w-[70%] rounded-lg px-4.5 py-3 bg-[var(--bg-surface-100)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-2xs font-semibold ml-1 text-[var(--text-muted)]">STEMA...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </main>

        <AnimatePresence>
          {showScrollDown && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute bottom-36 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] transition-all shadow-sm text-2xs font-bold z-20"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Yeni Mesajlar
            </motion.button>
          )}
        </AnimatePresence>

        {/* Text Input area and toolbox */}
        <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 relative z-10 shrink-0">
          <div className="mx-auto max-w-2xl space-y-3">
            
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {suggestions[mode].map((sug: { text: string; value: string }, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(undefined, sug.value)}
                  disabled={isLoading || (mode === 'socratic' && showMetacognitivePrompt)}
                  className="px-3 py-1.5 text-2xs font-bold rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap transition-all shadow-3xs active:scale-[0.98] disabled:opacity-40"
                >
                  {sug.text}
                </button>
              ))}
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded-lg">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded text-2xs text-[var(--text-secondary)]">
                    {att.type === 'image' ? <ImageIcon className="h-3.5 w-3.5 text-[var(--text-secondary)]" /> : <FileText className="h-3.5 w-3.5 text-[var(--text-secondary)]" />}
                    <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="p-0.5 rounded-full hover:bg-[var(--bg-surface-200)] text-[var(--text-muted)] hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="flex gap-2.5 items-end bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg p-2 focus-within:ring-1 focus-within:ring-slate-400 transition-all">
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || (mode === 'socratic' && showMetacognitivePrompt)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-100)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-200)] transition-all disabled:opacity-40"
                title={dict.attachFile}
              >
                <Paperclip className="h-4.5 w-4.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf"
                className="hidden"
                onChange={(e) => handleLocalFileSelection(e, 'document')}
              />

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isLoading || (mode === 'socratic' && showMetacognitivePrompt)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-100)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-200)] transition-all disabled:opacity-40"
                title={dict.attachImage}
              >
                <ImageIcon className="h-4.5 w-4.5" />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLocalFileSelection(e, 'image')}
              />

              {/* Camera button (11.1) */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (isCameraActive) {
                      mediaStreamRef.current?.getTracks().forEach(t => t.stop())
                      setIsCameraActive(false)
                      return
                    }
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                    mediaStreamRef.current = stream
                    setIsCameraActive(true)
                  } catch {
                    // Camera not available
                  }
                }}
                disabled={isLoading || (mode === 'socratic' && showMetacognitivePrompt)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-200)] transition-all disabled:opacity-40 ${
                  isCameraActive ? 'bg-blue-100 border-blue-300 text-blue-600' : 'border-[var(--border-subtle)] bg-[var(--bg-surface-100)]'
                }`}
                title={isTr ? 'Kamera' : 'Camera'}
              >
                <Camera className="h-4.5 w-4.5" />
              </button>

              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onPaste={(e) => {
                  const items = e.clipboardData?.items
                  if (!items) return
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                      e.preventDefault()
                      const file = item.getAsFile()
                      if (!file) continue
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const dataUrl = ev.target?.result as string
                        openOcrModal(dataUrl)
                      }
                      reader.readAsDataURL(file)
                      break
                    }
                  }
                }}
                placeholder={
                  mode === 'socratic' && showMetacognitivePrompt
                    ? (isTr ? 'Lütfen önce güven seviyenizi seçin...' : 'Please select your confidence level first...')
                    : mode === 'socratic' 
                      ? dict.inputPlaceholderSocratic 
                      : mode === 'feynman' 
                        ? dict.inputPlaceholderFeynman 
                        : dict.inputPlaceholderFree
                }
                disabled={isLoading || (mode === 'socratic' && showMetacognitivePrompt)}
                rows={1}
                className="flex-1 min-h-[36px] max-h-[140px] px-3 py-2 bg-transparent text-sm focus:outline-none placeholder:text-[var(--text-muted)] disabled:opacity-50 resize-none leading-relaxed text-[var(--text-primary)]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />

              <motion.button
                type="submit"
                disabled={(!input.trim() && attachments.length === 0) || isLoading || (mode === 'socratic' && showMetacognitivePrompt)}
                whileHover={{ scale: (!input.trim() && attachments.length === 0) || isLoading || (mode === 'socratic' && showMetacognitivePrompt) ? 1 : 1.05 }}
                whileTap={{ scale: (!input.trim() && attachments.length === 0) || isLoading || (mode === 'socratic' && showMetacognitivePrompt) ? 1 : 0.95 }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            </form>
          </div>
        </footer>
      </div>

      {/* ── RIGHT PANEL: Study Workbench (35% Width) ── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden lg:flex flex-col h-full bg-[var(--bg-primary)] shrink-0 overflow-hidden relative border-l border-[var(--border-subtle)]"
          >
            {/* Tab header buttons */}
            <div className="h-14 border-b border-[var(--border-subtle)] px-4 flex items-center gap-1 bg-[var(--bg-surface-100)] shrink-0 select-none">
              <button
                onClick={() => setWorkbenchTab('whiteboard')}
                className={`flex-1 py-1.5 px-2 rounded text-center text-xs font-bold transition-all border ${
                  workbenchTab === 'whiteboard'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-2xs'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                {dict.whiteboardTab}
              </button>
              <button
                onClick={() => setWorkbenchTab('flashcards')}
                className={`flex-1 py-1.5 px-2 rounded text-center text-xs font-bold transition-all border ${
                  workbenchTab === 'flashcards'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-2xs'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                {dict.flashcardsTab} ({dueCards.length})
              </button>
              <button
                onClick={() => setWorkbenchTab('notes')}
                className={`flex-1 py-1.5 px-2 rounded text-center text-xs font-bold transition-all border ${
                  workbenchTab === 'notes'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-2xs'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                {dict.notesTab}
              </button>
              <button
                onClick={() => setWorkbenchTab('concepts')}
                className={`flex-1 py-1.5 px-2 rounded text-center text-xs font-bold transition-all border ${
                  workbenchTab === 'concepts'
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-subtle)] shadow-2xs'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                {dict.conceptsTab}
              </button>
            </div>

            {/* Tab content area */}
            <div className="flex-1 overflow-y-auto p-5 min-h-0 bg-[var(--bg-primary)]">
              
              {/* TAB 1: Whiteboard Canvas */}
              {workbenchTab === 'whiteboard' && (
                <div className="h-full flex flex-col min-h-0">
                  <div className="mb-2 shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{dict.whiteboardTab}</h3>
                    <p className="text-2xs text-[var(--text-secondary)] mt-0.5">{dict.whiteboardDesc}</p>
                  </div>
                  <div className="flex-1 min-h-[380px]">
                    <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-xs text-text-muted">Loading Whiteboard...</div>}>
                        <Whiteboard onAttachImage={handleAttachWhiteboardImage} agentElements={agentElements} />
                    </Suspense>
                  </div>
                </div>
              )}

              {/* TAB 2: Spaced Repetition Flashcards Study */}
              {workbenchTab === 'flashcards' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{dict.flashcardsTab}</h3>
                    <span className="text-2xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-bold">FSRS Modülü</span>
                  </div>

                  {dueCards.length === 0 || currentCardIndex >= dueCards.length ? (
                    <div className="text-center py-10 border border-dashed border-[var(--border-subtle)] rounded-lg p-6 bg-[var(--bg-surface-100)]/50 space-y-4">
                      <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-[var(--text-primary)]">Harika İş!</h4>
                        <p className="text-2xs text-[var(--text-secondary)] leading-relaxed">{dict.flashcardsEmpty}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between text-2xs text-[var(--text-secondary)] font-bold font-mono">
                        <span>Kart {currentCardIndex + 1} / {dueCards.length}</span>
                        <span>Çalışılan: {flashcardsReviewedCount}</span>
                      </div>
                      
                      {/* 3D Flip Card Container */}
                      <div className="w-full min-h-[220px]" style={{ perspective: 1000 }}>
                        <motion.div
                          onClick={() => setIsCardFlipped(!isCardFlipped)}
                          animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                          style={{ transformStyle: 'preserve-3d' }}
                          className="w-full min-h-[220px] relative cursor-pointer select-none"
                        >
                          {/* Front Side */}
                          <div
                            style={{ 
                              backfaceVisibility: 'hidden', 
                              WebkitBackfaceVisibility: 'hidden',
                              position: 'absolute',
                              inset: 0,
                              zIndex: isCardFlipped ? 0 : 2
                            }}
                            className="w-full h-full bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded-lg p-5 flex flex-col justify-between shadow-3xs hover:border-[var(--border-medium)] transition-colors"
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-bold text-[var(--text-secondary)] font-mono">
                                <span>{concepts.find(c => c.id === dueCards[currentCardIndex].concept_id)?.name || 'Hata Tekrarı'}</span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                  SORU
                                </span>
                              </div>
                              
                              <div className="text-xs text-[var(--text-primary)] leading-relaxed overflow-y-auto max-h-[140px] pt-1">
                                <LatexRenderer text={dueCards[currentCardIndex].front} />
                              </div>
                            </div>

                            <div className="text-center text-[10px] text-[var(--text-secondary)] font-bold border-t border-[var(--border-subtle)] pt-2 flex items-center justify-center gap-1.5">
                              <RotateCcw className="h-3 w-3" />
                              Cevabı görmek için tıklayın
                            </div>
                          </div>

                          {/* Back Side */}
                          <div
                            style={{ 
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)',
                              position: 'absolute',
                              inset: 0,
                              zIndex: isCardFlipped ? 2 : 0
                            }}
                            className="w-full h-full bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded-lg p-5 flex flex-col justify-between shadow-3xs hover:border-[var(--border-medium)] transition-colors"
                          >
                            <div className="space-y-3" style={{ transform: 'rotateY(180deg)' }}>
                              <div className="flex justify-between items-center text-[10px] font-bold text-[var(--text-secondary)] font-mono">
                                <span>{concepts.find(c => c.id === dueCards[currentCardIndex].concept_id)?.name || 'Hata Tekrarı'}</span>
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                  CEVAP
                                </span>
                              </div>
                              
                              <div className="text-xs text-[var(--text-primary)] leading-relaxed overflow-y-auto max-h-[140px] pt-1">
                                <LatexRenderer text={dueCards[currentCardIndex].back} />
                              </div>
                            </div>

                            <div className="text-center text-[10px] text-[var(--text-secondary)] font-bold border-t border-[var(--border-subtle)] pt-2 flex items-center justify-center gap-1.5" style={{ transform: 'rotateY(180deg)' }}>
                              <RotateCcw className="h-3 w-3" />
                              Soruyu görmek için tıklayın
                            </div>
                          </div>
                        </motion.div>
                      </div>

                      <div className="pt-2">
                        {isCardFlipped ? (
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              onClick={() => handleRateFlashcard(1)}
                              className="py-2 rounded border border-red-200 bg-red-50/20 hover:bg-red-50 text-red-600 text-2xs font-bold transition-all"
                            >
                              Tekrar
                            </button>
                            <button
                              onClick={() => handleRateFlashcard(2)}
                              className="py-2 rounded border border-amber-200 bg-amber-50/20 hover:bg-amber-50 text-amber-700 text-2xs font-bold transition-all"
                            >
                              Zor
                            </button>
                            <button
                              onClick={() => handleRateFlashcard(3)}
                              className="py-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-100)] hover:bg-[var(--bg-surface-200)] text-[var(--text-primary)] text-2xs font-bold transition-all"
                            >
                              İyi
                            </button>
                            <button
                              onClick={() => handleRateFlashcard(4)}
                              className="py-2 rounded border border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50 text-emerald-700 text-2xs font-bold transition-all"
                            >
                              Kolay
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsCardFlipped(true)}
                            className="w-full py-2.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-bold rounded hover:opacity-90 transition-all"
                          >
                            Cevabı Göster
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Ders Notları & RAG Document Uploads */}
              {workbenchTab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{dict.notesTab}</h3>
                  </div>

                  {/* Drag & Drop Upload Zone (10.1) */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDragOver(false)
                      const droppedFiles = e.dataTransfer.files
                      if (droppedFiles.length > 0) {
                        const input = docUploadInputRef.current
                        if (input) {
                          const dt = new DataTransfer()
                          dt.items.add(droppedFiles[0])
                          input.files = dt.files
                          handleUploadDocumentToDatabase({ target: input } as any)
                        }
                      }
                    }}
                    onClick={() => !isIngesting && docUploadInputRef.current?.click()}
                    className={`relative cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                      isDragOver
                        ? 'border-[var(--text-primary)] bg-[var(--bg-surface-100)] scale-[1.02]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-100)]/50 hover:border-[var(--border-medium)] hover:bg-[var(--bg-surface-100)]'
                    } ${isIngesting ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input
                      ref={docUploadInputRef}
                      type="file"
                      accept=".txt,.pdf"
                      className="hidden"
                      onChange={handleUploadDocumentToDatabase}
                    />
                    {isDragOver ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <UploadCloud className="h-8 w-8 text-[var(--text-primary)]" />
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {isTr ? 'Bırak ve Yükle' : 'Drop to Upload'}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <UploadCloud className="h-7 w-7 text-[var(--text-muted)]" />
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {isTr ? 'PDF veya TXT dosyası sürükleyin' : 'Drag & drop PDF or TXT'}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">
                          {isTr ? 'veya tıklayarak seçin' : 'or click to browse'}
                        </p>
                      </div>
                    )}
                  </div>

                  {isIngesting && (
                    <div className="p-3 bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded-lg space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-[var(--text-primary)] border-t-transparent animate-spin shrink-0" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {isTr ? 'Dosya İşleniyor...' : 'Processing File...'}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-[var(--border-subtle)] rounded-full h-1.5">
                        <div className="bg-[var(--text-primary)] h-1.5 rounded-full transition-all duration-500 animate-pulse" style={{ width: '65%' }} />
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] font-mono leading-relaxed">
                        {ingestProgress}
                      </p>
                    </div>
                  )}

                  {documents.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-[var(--border-subtle)] rounded-lg p-6 bg-[var(--bg-surface-100)]/50">
                      <File className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
                      <p className="text-2xs text-[var(--text-secondary)] leading-relaxed">{dict.notesTabEmpty}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {documents.map(doc => (
                        <div key={doc.id} className="p-3 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg flex items-center justify-between text-xs hover:border-[var(--border-medium)] transition-all shadow-3xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded bg-[var(--bg-surface-100)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
                              <FileText className="h-4.5 w-4.5 text-[var(--text-secondary)]" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-[var(--text-primary)] truncate pr-2" title={doc.title}>{doc.title}</h4>
                              <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">{(doc.size / 1024).toFixed(1)} KB • {doc.file_type.toUpperCase()}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={async () => {
                              try {
                                await deleteOwnedRows('documents', [{ column: 'id', value: doc.id }])
                                fetchWorkspaceData()
                              } catch (err) {
                                console.error('Error deleting document:', err)
                              }
                            }}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50"
                            title="Dosyayı Sil"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Concept Mastery Dashboard */}
              {workbenchTab === 'concepts' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{dict.conceptsTab}</h3>
                    
                    {/* Sub-tab selection bar */}
                    <div className="flex bg-[var(--bg-surface-100)] p-0.5 rounded border border-[var(--border-subtle)] text-[10px]">
                      <button
                        onClick={() => setConceptsSubTab('tree')}
                        className={`px-2 py-1 font-semibold rounded ${
                          conceptsSubTab === 'tree'
                            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-3xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {isTr ? 'Ağaç' : 'Tree'}
                      </button>
                      <button
                        onClick={() => setConceptsSubTab('calibration')}
                        className={`px-2 py-1 font-semibold rounded ${
                          conceptsSubTab === 'calibration'
                            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-3xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {isTr ? 'Metakognisyon' : 'Calibration'}
                      </button>
                      <button
                        onClick={() => setConceptsSubTab('errors')}
                        className={`px-2 py-1 font-semibold rounded ${
                          conceptsSubTab === 'errors'
                            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-3xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {isTr ? 'Hatalar' : 'Errors'}
                      </button>
                    </div>
                  </div>

                  {/* Weak Topics Alert List (always shown if any topics are weak) */}
                  {concepts.filter(c => (c.mastery || 0) < 50).length > 0 && (
                    <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-1.5 text-red-700 font-bold text-xs">
                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                        <span>{isTr ? 'Acil Tekrar Edilmesi Gerekenler' : 'Urgent Review Needed'}</span>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {concepts
                          .filter(c => (c.mastery || 0) < 50)
                          .map(topic => (
                            <div
                              key={topic.id}
                              onClick={() => {
                                setSelectedConceptId(topic.id)
                                initChat()
                              }}
                              className="text-2xs text-red-700 hover:underline cursor-pointer flex justify-between items-center font-medium"
                            >
                              <span>{topic.code} - {topic.name}</span>
                              <span className="font-mono font-bold bg-red-50 border border-red-200 px-1 py-0.2 rounded">%{topic.mastery || 0}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-tab 1: SVG Knowledge Graph / Concept Tree */}
                  {conceptsSubTab === 'tree' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-[var(--bg-surface-100)]/50 border border-[var(--border-subtle)] rounded-lg text-2xs space-y-2">
                        <h4 className="font-bold text-[var(--text-primary)]">{isTr ? 'Konu Önkoşul Ağacı' : 'Concept Prerequisite Tree'}</h4>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                          {isTr
                            ? 'Kavramların üzerine tıklayarak ilgili konuya geçiş yapabilirsiniz. Çalışılabilir seviyeye gelmek için önkoşulları tamamlamanız gerekir.'
                            : 'Click on concepts to select them. Complete prerequisites to unlock advanced concepts.'}
                        </p>
                        <div className="flex flex-wrap gap-3 pt-1">
                          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-medium">
                            <span className="h-2.5 w-2.5 rounded bg-emerald-50 border border-emerald-500 shrink-0" />
                            {isTr ? 'Tamamlandı (%90+)' : 'Completed (90%+)'}
                          </span>
                          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-medium">
                            <span className="h-2.5 w-2.5 rounded bg-red-50 border border-red-500 shrink-0" />
                            {isTr ? 'Açık (Çalışılabilir)' : 'Unlocked'}
                          </span>
                          <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-medium">
                            <span className="h-2.5 w-2.5 rounded bg-slate-100 border border-slate-300 shrink-0 opacity-60" />
                            {isTr ? 'Kilitli' : 'Locked'}
                          </span>
                        </div>
                      </div>

                      <div className="border border-[var(--border-subtle)] rounded-lg p-2 bg-[var(--bg-primary)] overflow-x-auto">
                        <svg width="340" height="430" viewBox="0 0 340 430" className="mx-auto">
                          <defs>
                            <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                              <path d="M 0 2 L 8 5 L 0 8 z" fill="#94a3b8" />
                            </marker>
                            <marker id="arrow-green" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                              <path d="M 0 2 L 8 5 L 0 8 z" fill="#10b981" />
                            </marker>
                          </defs>
                          {(() => {
                            const nodePositions: Record<string, { x: number; y: number }> = {
                              MATH101: { x: 170, y: 35 },
                              MATH102: { x: 170, y: 105 },
                              MATH103: { x: 85, y: 175 },
                              MATH104: { x: 85, y: 245 },
                              PHYS101: { x: 255, y: 175 },
                              PHYS102: { x: 255, y: 245 },
                              PHYS103: { x: 255, y: 315 },
                              EEE201: { x: 255, y: 385 }
                            }

                            const isCompleted = (c: Concept) => (c.mastery || 0) >= 90
                            
                            const isUnlocked = (c: Concept) => {
                              if (!c.prerequisite_id) return true
                              const prereq = concepts.find(p => p.id === c.prerequisite_id)
                              return prereq ? isCompleted(prereq) : true
                            }

                            // 1. Draw Connection Lines
                            const lines: React.ReactNode[] = []
                            concepts.forEach(concept => {
                              if (concept.prerequisite_id) {
                                const parent = concepts.find(p => p.id === concept.prerequisite_id)
                                if (parent) {
                                  const pPos = nodePositions[parent.code]
                                  const cPos = nodePositions[concept.code]
                                  if (pPos && cPos) {
                                    const comp = isCompleted(concept)
                                    const unl = isUnlocked(concept)
                                    lines.push(
                                      <line
                                        key={`line-${parent.id}-${concept.id}`}
                                        x1={pPos.x}
                                        y1={pPos.y + 20}
                                        x2={cPos.x}
                                        y2={cPos.y - 20}
                                        stroke={comp ? '#10b981' : unl ? '#94a3b8' : '#cbd5e1'}
                                        strokeWidth={comp ? 1.8 : 1.2}
                                        strokeDasharray={(!unl && !comp) ? "4" : undefined}
                                        markerEnd={comp ? "url(#arrow-green)" : "url(#arrow)"}
                                      />
                                    )
                                  }
                                }
                              }
                            })

                            // 2. Draw Concept Nodes
                            const nodes = concepts.map(concept => {
                              const pos = nodePositions[concept.code] || { x: 0, y: 0 }
                              const comp = isCompleted(concept)
                              const unl = isUnlocked(concept)
                              const isSelected = concept.id === selectedConceptId

                              let cardFill = 'var(--bg-primary)'
                              let cardStroke = 'var(--border-subtle)'
                              let textCodeColor = 'var(--text-primary)'
                              let textNameColor = 'var(--text-secondary)'
                              let textMasteryColor = 'var(--text-muted)'
                              let opacity = 1

                              if (comp) {
                                cardFill = '#f0fdf4'
                                cardStroke = '#10b981'
                                textCodeColor = '#065f46'
                                textNameColor = '#047857'
                                textMasteryColor = '#059669'
                              } else if (unl) {
                                cardFill = '#fef2f2'
                                cardStroke = '#ef4444'
                                textCodeColor = '#991b1b'
                                textNameColor = '#b91c1c'
                                textMasteryColor = '#dc2626'
                              } else {
                                cardFill = '#f8fafc'
                                cardStroke = '#cbd5e1'
                                textCodeColor = '#64748b'
                                textNameColor = '#64748b'
                                textMasteryColor = '#94a3b8'
                                opacity = 0.5
                              }

                              if (isSelected) {
                                cardStroke = 'var(--text-primary)'
                              }

                              return (
                                <g 
                                  key={concept.id} 
                                  className="cursor-pointer select-none"
                                  opacity={opacity}
                                  onClick={() => {
                                    if (unl || comp || isSelected) {
                                      setSelectedConceptId(concept.id)
                                      initChat()
                                    }
                                  }}
                                >
                                  <rect
                                    x={pos.x - 55}
                                    y={pos.y - 20}
                                    width={110}
                                    height={40}
                                    rx={6}
                                    fill={cardFill}
                                    stroke={cardStroke}
                                    strokeWidth={isSelected ? 2 : 1}
                                    className="transition-all duration-200"
                                  />
                                  <text
                                    x={pos.x}
                                    y={pos.y - 6}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fontWeight="bold"
                                    fill={textCodeColor}
                                  >
                                    {concept.code}
                                  </text>
                                  <text
                                    x={pos.x}
                                    y={pos.y + 4}
                                    textAnchor="middle"
                                    fontSize="7.5"
                                    fill={textNameColor}
                                  >
                                    {concept.name.length > 20 ? concept.name.substring(0, 18) + '..' : concept.name}
                                  </text>
                                  <text
                                    x={pos.x}
                                    y={pos.y + 13}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fill={textMasteryColor}
                                  >
                                    %{concept.mastery || 0}
                                  </text>
                                </g>
                              )
                            })

                            return [...lines, ...nodes]
                          })()}
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Sub-tab 2: Calibration Scatter Plot */}
                  {conceptsSubTab === 'calibration' && (
                    <div className="space-y-4">
                      {(() => {
                        const calibrationPoints: { name: string; value: [number, number] }[] = []
                        concepts.forEach(concept => {
                          const preds = tutorEvents.filter(
                            e => e.event_type === 'metacognitive_prediction' && e.payload?.concept_id === concept.id
                          )
                          if (preds.length === 0) return

                          const avgPred = preds.reduce((sum, e) => sum + Number(e.payload?.prediction || 0), 0) / preds.length
                          const S = tutorEvents.filter(e => e.event_type === 'socratic_success' && e.payload?.concept_id === concept.id).length
                          const H = tutorEvents.filter(e => e.event_type === 'hint_shown' && e.payload?.concept_id === concept.id).length
                          const E = errorLogs.filter(e => e.concept_id === concept.id).length

                          if (S === 0 && H === 0 && E === 0) return

                          const deduction = (E * 0.4) + (H * 0.2)
                          const actualPerf = Math.max(1, Math.min(5, 5 - deduction))

                          calibrationPoints.push({
                            name: `${concept.code}: ${concept.name}`,
                            value: [Number(avgPred.toFixed(2)), Number(actualPerf.toFixed(2))]
                          })
                        })

                        return <CalibrationChart isTr={isTr} calibrationPoints={calibrationPoints} />
                      })()}
                    </div>
                  )}

                  {/* Sub-tab 3: Error Cluster Pie Chart */}
                  {conceptsSubTab === 'errors' && (
                    <div className="space-y-4">
                      <ErrorTypeChart isTr={isTr} errorLogs={errorLogs} />
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── OCR Verification Modal (11.5) ── */}
      <AnimatePresence>
        {showOcrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={cancelOcrConfirm}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {isTr ? 'OCR ile Tanınan Formül' : 'OCR Recognized Formula'}
                </h3>
                <button onClick={cancelOcrConfirm} className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {ocrModalImage && (
                <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[var(--bg-surface-100)]">
                  <img src={ocrModalImage} alt="OCR Input" className="max-h-48 w-full object-contain" />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                  {isTr ? 'Algılanan LaTeX / Metin' : 'Detected LaTeX / Text'}
                </label>
                {isOcrProcessing ? (
                  <div className="flex items-center gap-2 p-3 bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded-lg">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[var(--text-primary)] border-t-transparent animate-spin shrink-0" />
                    <span className="text-xs text-[var(--text-secondary)]">{isTr ? 'OCR işleniyor...' : 'Processing OCR...'}</span>
                  </div>
                ) : (
                  <textarea
                    value={ocrEditedResult}
                    onChange={(e) => setOcrEditedResult(e.target.value)}
                    rows={4}
                    className="w-full p-3 bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded-lg text-sm font-mono text-[var(--text-primary)] resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
                    placeholder={isTr ? 'OCR sonucu burada görünecek...' : 'OCR result will appear here...'}
                  />
                )}
              </div>

              {ocrResult && (
                <div className="p-3 bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded-lg">
                  <p className="text-2xs font-bold text-[var(--text-secondary)] mb-1">{isTr ? 'Önizleme:' : 'Preview:'}</p>
                  <LatexRenderer text={ocrEditedResult} />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={cancelOcrConfirm}
                  className="px-4 py-2 text-xs font-bold rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  {isTr ? 'İptal' : 'Cancel'}
                </button>
                <button
                  onClick={confirmOcrResult}
                  disabled={isOcrProcessing}
                  className="px-4 py-2 text-xs font-bold rounded bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-40 transition-all"
                >
                  {isTr ? 'Sohbete Ekle' : 'Add to Chat'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Camera Preview Overlay (11.1) ── */}
      <AnimatePresence>
        {isCameraActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => {
              mediaStreamRef.current?.getTracks().forEach(t => t.stop())
              setIsCameraActive(false)
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-black rounded-xl overflow-hidden shadow-2xl max-w-md w-full"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full aspect-[4/3] object-cover"
                onLoadedMetadata={() => videoRef.current?.play()}
              />
              <div className="flex justify-center gap-4 p-4 bg-black/80">
                <button
                  onClick={() => {
                    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
                    setIsCameraActive(false)
                  }}
                  className="px-4 py-2 text-xs font-bold rounded bg-white/20 text-white hover:bg-white/30 transition-all"
                >
                  {isTr ? 'İptal' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    const video = videoRef.current
                    if (!video) return
                    const canvas = document.createElement('canvas')
                    canvas.width = video.videoWidth
                    canvas.height = video.videoHeight
                    const ctx = canvas.getContext('2d')
                    if (!ctx) return
                    ctx.drawImage(video, 0, 0)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
                    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
                    setIsCameraActive(false)
                    openOcrModal(dataUrl)
                  }}
                  className="px-6 py-2 text-xs font-bold rounded bg-white text-black hover:bg-white/90 transition-all"
                >
                  {isTr ? 'Fotoğraf Çek' : 'Capture'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
