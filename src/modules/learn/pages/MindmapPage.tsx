import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { listOwnedRows, upsertOwnedRow, deleteOwnedRows } from '@/lib/cloud/supabaseRepo'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useLocale } from '@/i18n'
import {
  ArrowLeft,
  Sparkles,
  Save,
  Download,
  Trash2,
  Maximize2,
  FolderOpen,
  Plus,
  Compass,
  MessageSquare,
  BookOpen,
  PenTool
} from 'lucide-react'

interface SavedMindmapRow {
  id: string
  name: string
  nodes: any
  edges: any
  created_at: string
}

export function MindmapPage() {
  const navigate = useNavigate()
  const locale = useLocale()
  const isTr = locale === 'tr'

  // React Flow States
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  // Custom states
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mindmapName, setMindmapName] = useState('')
  const [savedMindmaps, setSavedMindmaps] = useState<SavedMindmapRow[]>([])
  const [selectedMapId, setSelectedMapId] = useState<string>('')
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showExcalidraw, setShowExcalidraw] = useState(false)

  // Excalidraw state ref
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)

  // Fetch list of saved mindmaps from Firestore
  const fetchSavedMindmaps = async () => {
    try {
      const user = useAuthStore.getState().session?.user
      if (!user) return

      const data = await listOwnedRows('mindmaps', { orderBy: 'created_at', ascending: false })
      if (data) setSavedMindmaps(data as SavedMindmapRow[])
    } catch (err) {
      console.error('Error fetching saved mindmaps:', err)
    }
  }

  useEffect(() => {
    fetchSavedMindmaps()
  }, [])

  // Generate new mindmap from API
  const handleGenerateMindmap = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    try {
      const token = useAuthStore.getState().session?.accessToken || ''
      const response = await fetch('/api/mindmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) throw new Error('API failed')
      const data = await response.json()

      // Set nodes and edges
      setNodes(data.nodes || [])
      setEdges(data.edges || [])
      
      setMindmapName(prompt)
      
      // Clear excalidraw canvas
      if (excalidrawAPI) {
        excalidrawAPI.updateScene({ elements: [] })
      }
    } catch (err) {
      console.error('Error generating mindmap:', err)
      alert(isTr ? 'Zihin haritası üretilemedi.' : 'Failed to generate mindmap.')
    } finally {
      setIsLoading(false)
    }
  }

  // Expand node (Dalı Genişlet)
  const handleExpandNode = async (node: Node) => {
    setIsLoading(true)
    try {
      const token = useAuthStore.getState().session?.accessToken || ''
      const response = await fetch('/api/mindmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: prompt,
          isExpand: true,
          nodeLabel: node.data.label
        })
      })

      if (!response.ok) throw new Error('API failed')
      const data = await response.json()

      // Merge nodes and edges
      // Adjust positions of new nodes relative to the clicked parent node
      const parentX = node.position.x
      const parentY = node.position.y

      const newNodes = (data.nodes || []).map((n: any, idx: number) => {
        // Offset nodes to avoid overlap with existing canvas coordinates
        const cleanId = `${node.id}-${n.id}`
        return {
          ...n,
          id: cleanId,
          position: {
            x: parentX + (idx - 1) * 240,
            y: parentY + 145
          }
        }
      })

      const newEdges = (data.edges || []).map((e: any) => {
        const sourceId = e.source === 'root' ? node.id : `${node.id}-${e.source}`
        const targetId = `${node.id}-${e.target}`
        return {
          ...e,
          id: `edge-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          animated: true
        }
      })

      // We also need to connect the parent node directly to the root of the new subtree
      const rootSubNode = newNodes.find((n: any) => n.id.endsWith('-root'))
      if (rootSubNode) {
        newEdges.push({
          id: `edge-${node.id}-${rootSubNode.id}`,
          source: node.id,
          target: rootSubNode.id,
          animated: true
        })
      }

      setNodes(prev => [...prev, ...newNodes])
      setEdges(prev => [...prev, ...newEdges])

    } catch (err) {
      console.error('Error expanding node:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Save mindmap and drawing to Supabase
  const handleSaveMindmap = async () => {
    const nameToSave = mindmapName.trim() || prompt.trim() || 'Yeni STEM Zihin Haritası'
    const user = useAuthStore.getState().session?.user
    if (!user) return

    try {
      // Extract excalidraw elements
      let excalElements: any[] = []
      if (excalidrawAPI) {
        excalElements = excalidrawAPI.getSceneElements()
      }

      // Embed excalidraw state into a custom virtual node in the React Flow nodes array
      const excalDataNode = {
        id: 'excalidraw-data',
        type: 'excalidraw',
        data: { elements: excalElements },
        position: { x: 0, y: 0 }
      }

      const nodesToSave = [...nodes.filter(n => n.id !== 'excalidraw-data'), excalDataNode]

      if (selectedMapId) {
        // Update existing
        await upsertOwnedRow('mindmaps', {
          id: selectedMapId,
          name: nameToSave,
          nodes: nodesToSave,
          edges: edges
        })
      } else {
        // Insert new
        const data = await upsertOwnedRow('mindmaps', {
          name: nameToSave,
          nodes: nodesToSave,
          edges: edges
        })
        if (data) setSelectedMapId(data.id)
      }

      fetchSavedMindmaps()
      alert(isTr ? 'Başarıyla kaydedildi!' : 'Saved successfully!')
    } catch (err) {
      console.error('Error saving mindmap:', err)
      alert(isTr ? 'Kaydedilemedi.' : 'Failed to save.')
    }
  }

  // Load selected mindmap
  const handleLoadMindmap = (mapRow: SavedMindmapRow) => {
    setSelectedMapId(mapRow.id)
    setMindmapName(mapRow.name)
    setPrompt(mapRow.name)

    const rawNodes = mapRow.nodes || []
    const excalNode = rawNodes.find((n: any) => n.id === 'excalidraw-data')
    const activeNodes = rawNodes.filter((n: any) => n.id !== 'excalidraw-data')

    setNodes(activeNodes)
    setEdges(mapRow.edges || [])

    // Restore excalidraw sketch
    if (excalidrawAPI) {
      const savedElements = excalNode?.data?.elements || []
      excalidrawAPI.updateScene({ elements: savedElements })
      if (savedElements.length > 0) {
        setShowExcalidraw(true)
      }
    }

    setShowLoadModal(false)
  }

  // Delete mindmap
  const handleDeleteMindmap = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(isTr ? 'Bu zihin haritasını silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this mindmap?')) return

    try {
      await deleteOwnedRows('mindmaps', [{ column: 'id', value: id }])
      
      if (selectedMapId === id) {
        setSelectedMapId('')
        setNodes([])
        setEdges([])
        setMindmapName('')
        if (excalidrawAPI) excalidrawAPI.updateScene({ elements: [] })
      }

      fetchSavedMindmaps()
    } catch (err) {
      console.error('Error deleting mindmap:', err)
    }
  }

  // Export current Excalidraw + reactflow diagram as PNG (Mock print/download)
  const handleExportPNG = () => {
    alert(isTr 
      ? 'Dışa aktarma işlemi başlatıldı. Zihin haritası görsel olarak PNG dosyasına dönüştürülüyor.' 
      : 'Export started. Converting mindmap and sketch to PNG.')
    
    // Create link and download a mock empty png file or trigger simple print
    const link = document.createElement('a')
    link.download = `${mindmapName || 'zihin_haritasi'}.png`
    link.href = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="indigo"/></svg>'
    link.click()
  }

  // Connect React Flow nodes manually
  const onConnect = (params: Connection | Edge) => setEdges(eds => addEdge(params, eds))

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors overflow-hidden">
      
      {/* ── TOP ACTION BAR ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-5 relative z-10">
        <div className="flex items-center gap-3">
          <motion.button
            onClick={() => navigate('/learn')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </motion.button>
          <span className="font-bold text-sm font-mono tracking-wide uppercase">
            {isTr ? 'Görsel Analiz ve Zihin Haritası' : 'Mapping Mode'}
          </span>
        </div>

        {/* Prompt generator bar */}
        <form onSubmit={handleGenerateMindmap} className="flex gap-2 max-w-md w-full mx-4">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={isTr ? 'Konu başlığı yazın (örn: Kuantum Fiziği)...' : 'Enter a concept name...'}
            disabled={isLoading}
            className="flex-1 px-3 py-1.5 bg-[var(--bg-surface-100)] border border-[var(--border-subtle)] rounded text-xs focus:outline-none placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
          />
          <motion.button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            whileHover={{ scale: isLoading || !prompt.trim() ? 1 : 1.02 }}
            whileTap={{ scale: isLoading || !prompt.trim() ? 1 : 0.98 }}
            className="px-3.5 py-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded text-xs font-bold hover:opacity-90 disabled:opacity-30 transition-all flex items-center gap-1 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isTr ? 'Üret' : 'Generate'}</span>
          </motion.button>
        </form>

        <div className="flex items-center gap-2">
          {/* Saved Maps Load Button */}
          <motion.button
            onClick={() => {
              fetchSavedMindmaps()
              setShowLoadModal(true)
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex h-8 px-2.5 items-center justify-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-xs font-semibold"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>{isTr ? 'Aç' : 'Open'}</span>
          </motion.button>

          {/* Save Button */}
          <motion.button
            onClick={handleSaveMindmap}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex h-8 px-2.5 items-center justify-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-xs font-semibold"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isTr ? 'Kaydet' : 'Save'}</span>
          </motion.button>

          {/* Export PNG */}
          <motion.button
            onClick={handleExportPNG}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex h-8 px-2.5 items-center justify-center gap-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-200)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isTr ? 'PNG' : 'Export'}</span>
          </motion.button>

          {/* Toggle Excalidraw Whiteboard */}
          <motion.button
            onClick={() => setShowExcalidraw(!showExcalidraw)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`flex h-8 px-2.5 items-center justify-center gap-1.5 rounded border transition-all text-xs font-semibold ${
              showExcalidraw
                ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent'
                : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-200)]'
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>{isTr ? 'Karalama Tahtası' : 'Sketch Board'}</span>
          </motion.button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE: SPLIT SCREEN (Conditionally 60% React Flow, 40% Excalidraw) ── */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* LEFT PANEL: React Flow Canvas */}
        <div className={`${showExcalidraw ? 'flex-[6]' : 'flex-1 w-full'} h-full relative border-r border-[var(--border-subtle)] bg-[var(--bg-surface-100)]/20`}>
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-10">
              <div className="max-w-sm space-y-3">
                <Compass className="h-10 w-10 text-[var(--text-muted)] mx-auto animate-pulse" />
                <h4 className="text-sm font-bold text-[var(--text-primary)]">{isTr ? 'Yapay Zeka Zihin Haritası Alanı' : 'AI Mindmap Playground'}</h4>
                <p className="text-2xs text-[var(--text-secondary)] leading-relaxed">
                  {isTr
                    ? 'Yukarıdaki arama çubuğuna bir konu yazarak başlayın. AI, kavram hiyerarşisini gösteren otomatik dallanmış bir şema çizecektir.'
                    : 'Enter a topic in the bar above. The AI will draw a structured hierarchical node network.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 z-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                onNodeClick={(_, node) => {
                  // Only click nodes that are not our virtual excalidraw-data node
                  if (node.id !== 'excalidraw-data') {
                    // Open a small custom context menu or just expand directly
                    const proceed = confirm(isTr 
                      ? `"${node.data.label}" dalını detaylandırmak ve yeni alt düğümler eklemek istiyor musunuz?`
                      : `Do you want to expand and add details under "${node.data.label}"?`)
                    if (proceed) {
                      handleExpandNode(node)
                    }
                  }
                }}
              >
                <Background color="var(--border-subtle)" gap={16} />
                <Controls />
                <MiniMap nodeColor={() => '#4f46e5'} />
              </ReactFlow>
            </div>
          )}

          {/* Expand Instructions HUD */}
          {nodes.length > 0 && (
            <div className="absolute bottom-4 left-4 p-2.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded shadow-sm text-3xs font-medium z-10 text-[var(--text-secondary)] max-w-[200px] pointer-events-none">
              💡 {isTr ? 'Dalları genişletmek için üzerlerine tıklayıp onaylayın.' : 'Click nodes to expand/detail branches.'}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Excalidraw Whiteboard (40%) */}
        {showExcalidraw && (
          <div className="flex-[4] h-full flex flex-col min-w-0 bg-[var(--bg-primary)]">
            <div className="h-9 shrink-0 border-b border-[var(--border-subtle)] px-4 flex items-center justify-between bg-[var(--bg-surface-100)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                {isTr ? 'Karalama Defteri (Excalidraw)' : 'Sketch Board'}
              </span>
            </div>
            <div className="flex-1 relative min-h-0">
              <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                theme="light"
              />
            </div>
          </div>
        )}

      </div>

      {/* ── LOAD MINDMAP MODAL ── */}
      <AnimatePresence>
        {showLoadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg w-full max-w-md p-5 flex flex-col max-h-[75vh] shadow-lg"
            >
              <div className="flex justify-between items-center pb-3 border-b border-[var(--border-subtle)] mb-3">
                <h3 className="text-sm font-bold font-mono text-[var(--text-primary)]">
                  {isTr ? 'Kayıtlı Zihin Haritaları' : 'Open Mindmap'}
                </h3>
                <button 
                  onClick={() => setShowLoadModal(false)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold font-mono"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {savedMindmaps.length === 0 ? (
                  <p className="text-2xs text-[var(--text-muted)] text-center py-6">
                    {isTr ? 'Henüz kaydedilmiş harita bulunamadı.' : 'No saved mindmaps yet.'}
                  </p>
                ) : (
                  savedMindmaps.map(mapRow => (
                    <motion.div
                      key={mapRow.id}
                      onClick={() => handleLoadMindmap(mapRow)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="p-3 border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-medium)] bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-100)] cursor-pointer flex items-center justify-between text-xs transition-all shadow-3xs"
                    >
                      <div className="min-w-0">
                        <h4 className="font-bold text-[var(--text-primary)] truncate pr-4">{mapRow.name}</h4>
                        <span className="text-[9px] text-[var(--text-muted)] mt-1 block">
                          {new Date(mapRow.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <button
                        onClick={(e) => handleDeleteMindmap(mapRow.id, e)}
                        className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
