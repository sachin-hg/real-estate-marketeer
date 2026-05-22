import { useState, useEffect, useRef } from 'react'
import { Zap, AlertTriangle, RotateCcw } from 'lucide-react'

interface FlowDiagramProps {
  nodes: string[]
  parallelGroups?: string[][]
  activeNode?: string
  completedNodes?: string[]
  onNodeClick?: (node: string) => void
  animationSpeed?: 0.5 | 1 | 2 | 3
  allowFailureInjection?: boolean
  autoPlay?: boolean
  title?: string
}

// Layout constants
const NODE_W = 130
const NODE_H = 36
const H_GAP = 60
const V_GAP = 50
const PAD_X = 20
const PAD_Y = 30

interface NodePos {
  id: string
  x: number
  y: number
  col: number
  row: number
}

interface Edge {
  from: string
  to: string
  path: string
}

function buildLayout(nodes: string[], parallelGroups: string[][] = []): {
  positions: NodePos[]
  edges: Edge[]
  svgW: number
  svgH: number
} {
  // Determine columns: nodes in parallelGroups share a column
  const colMap: Record<string, number> = {}
  const rowMap: Record<string, number> = {}

  let col = 0
  const processed = new Set<string>()

  // Simple linear layout with parallel groups on same column
  const colGroups: string[][] = []
  const remaining = [...nodes]

  while (remaining.length > 0) {
    const node = remaining[0]
    const pg = parallelGroups.find((g) => g.includes(node))
    if (pg && pg.every((n) => remaining.includes(n))) {
      colGroups.push(pg)
      pg.forEach((n) => remaining.splice(remaining.indexOf(n), 1))
    } else {
      colGroups.push([node])
      remaining.splice(0, 1)
    }
  }

  const positions: NodePos[] = []
  let currentX = PAD_X

  colGroups.forEach((group, colIdx) => {
    const totalH = group.length * NODE_H + (group.length - 1) * V_GAP
    const startY = PAD_Y

    group.forEach((nodeId, rowIdx) => {
      const x = currentX
      const y = startY + rowIdx * (NODE_H + V_GAP)
      positions.push({ id: nodeId, x, y, col: colIdx, row: rowIdx })
      colMap[nodeId] = colIdx
      rowMap[nodeId] = rowIdx
    })
    currentX += NODE_W + H_GAP
  })

  // Build edges: connect sequential columns, connect parallel groups to next
  const edges: Edge[] = []

  colGroups.forEach((group, colIdx) => {
    if (colIdx < colGroups.length - 1) {
      const nextGroup = colGroups[colIdx + 1]
      group.forEach((fromId) => {
        nextGroup.forEach((toId) => {
          const from = positions.find((p) => p.id === fromId)!
          const to = positions.find((p) => p.id === toId)!
          const x1 = from.x + NODE_W
          const y1 = from.y + NODE_H / 2
          const x2 = to.x
          const y2 = to.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          const path = `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
          edges.push({ from: fromId, to: toId, path })
        })
      })
    }
  })

  const svgW = currentX - H_GAP + PAD_X
  const maxRows = Math.max(...colGroups.map((g) => g.length))
  const svgH = PAD_Y + maxRows * (NODE_H + V_GAP) + PAD_Y

  return { positions, edges, svgW, svgH }
}

const NODE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  default:   { fill: '#1E293B', stroke: '#475569', text: '#CBD5E1' },
  active:    { fill: '#3B1D8A', stroke: '#7C3AED', text: '#EDE9FE' },
  completed: { fill: '#064E3B', stroke: '#059669', text: '#A7F3D0' },
  error:     { fill: '#450A0A', stroke: '#DC2626', text: '#FCA5A5' },
  start:     { fill: '#1C1917', stroke: '#57534E', text: '#A8A29E' },
  end:       { fill: '#1C1917', stroke: '#57534E', text: '#A8A29E' },
}

const LABEL_MAP: Record<string, string> = {
  START: 'START',
  END: 'END',
  researcher: 'researcher',
  trend_researcher: 'trend_researcher',
  planner: 'planner',
  social_creative: 'social_creative',
  news_creative: 'news_creative',
  platform_orchestrator: 'platforms',
  qa: 'qa_agent',
  publisher: 'publisher',
  notifier: 'notifier',
}

export default function FlowDiagram({
  nodes,
  parallelGroups = [],
  activeNode,
  completedNodes = [],
  onNodeClick,
  animationSpeed = 1,
  allowFailureInjection = false,
  autoPlay = false,
  title,
}: FlowDiagramProps) {
  const { positions, edges, svgW, svgH } = buildLayout(nodes, parallelGroups)
  const [dotProgress, setDotProgress] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [failedNodes, setFailedNodes] = useState<Set<string>>(new Set())
  const [retryingNodes, setRetryingNodes] = useState<Set<string>>(new Set())
  const animRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const totalEdges = edges.length
  const duration = totalEdges > 0 ? (totalEdges * 1200) / animationSpeed : 2000

  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }
    startTimeRef.current = null
    const animate = (ts: number) => {
      if (!startTimeRef.current) startTimeRef.current = ts
      const elapsed = ts - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      setDotProgress(progress)
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setPlaying(false)
        setDotProgress(0)
      }
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [playing, duration])

  const handleFailureInject = (nodeId: string) => {
    setFailedNodes((prev) => new Set([...prev, nodeId]))
    setTimeout(() => {
      setRetryingNodes((prev) => new Set([...prev, nodeId]))
      setFailedNodes((prev) => { const n = new Set(prev); n.delete(nodeId); return n })
      setTimeout(() => {
        setRetryingNodes((prev) => { const n = new Set(prev); n.delete(nodeId); return n })
      }, 1500)
    }, 1000)
  }

  const getNodeColor = (nodeId: string) => {
    if (failedNodes.has(nodeId)) return NODE_COLORS.error
    if (retryingNodes.has(nodeId)) return NODE_COLORS.active
    if (nodeId === 'START' || nodeId === 'END') return NODE_COLORS.start
    if (nodeId === activeNode) return NODE_COLORS.active
    if (completedNodes.includes(nodeId)) return NODE_COLORS.completed
    return NODE_COLORS.default
  }

  // Compute animated dot position along the current edge
  const edgeIndex = Math.floor(dotProgress * totalEdges)
  const edgeFraction = (dotProgress * totalEdges) % 1
  const currentEdge = edges[Math.min(edgeIndex, totalEdges - 1)]

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800">
        <span className="text-xs font-semibold text-slate-400">{title || 'Pipeline Flow'}</span>
        <div className="flex items-center gap-2">
          <select
            className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-1 border-none focus:outline-none"
            onChange={(e) => {}}
            defaultValue="1"
          >
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
            <option value="3">3×</option>
          </select>
          <button
            onClick={() => { setDotProgress(0); setPlaying(false); setTimeout(() => setPlaying(true), 50) }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-brand text-white hover:bg-brand-600 transition-colors"
          >
            <Zap size={11} /> Play
          </button>
          <button
            onClick={() => { setPlaying(false); setDotProgress(0); setFailedNodes(new Set()); setRetryingNodes(new Set()) }}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* SVG */}
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="block">
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#475569" />
            </marker>
            <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#7C3AED" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const isActive = i < edgeIndex || (i === edgeIndex && playing)
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={edge.path}
                fill="none"
                stroke={isActive ? '#7C3AED' : '#334155'}
                strokeWidth={isActive ? 2 : 1.5}
                markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                strokeDasharray={isActive ? 'none' : '4 3'}
                className="transition-all duration-300"
              />
            )
          })}

          {/* Animated dot */}
          {playing && currentEdge && (
            <circle r={5} fill="#A78BFA" filter="url(#glow)">
              <animateMotion
                dur={`${1200 / animationSpeed}ms`}
                fill="freeze"
                path={currentEdge.path}
                calcMode="spline"
                keySplines="0.4 0 0.6 1"
                begin="0s"
              />
            </circle>
          )}

          {/* Nodes */}
          {positions.map((pos) => {
            const colors = getNodeColor(pos.id)
            const label = LABEL_MAP[pos.id] || pos.id
            const isRetrying = retryingNodes.has(pos.id)
            const isFailed = failedNodes.has(pos.id)

            return (
              <g
                key={pos.id}
                onClick={() => onNodeClick?.(pos.id)}
                className={onNodeClick ? 'cursor-pointer' : ''}
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={6}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={pos.id === activeNode ? 2 : 1.5}
                  filter={pos.id === activeNode ? 'url(#glow)' : undefined}
                />
                <text
                  x={pos.x + NODE_W / 2}
                  y={pos.y + NODE_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={colors.text}
                  fontSize={10}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={500}
                >
                  {isRetrying ? '↺ retrying...' : isFailed ? '✗ error' : label}
                </text>

                {/* Failure injection button */}
                {allowFailureInjection && !['START', 'END'].includes(pos.id) && (
                  <g
                    onClick={(e) => { e.stopPropagation(); handleFailureInject(pos.id) }}
                    className="cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <rect
                      x={pos.x + NODE_W - 18}
                      y={pos.y + 2}
                      width={16}
                      height={14}
                      rx={3}
                      fill="#7F1D1D"
                    />
                    <text x={pos.x + NODE_W - 10} y={pos.y + 9} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#FCA5A5">!</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      {allowFailureInjection && (
        <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-3">
          <AlertTriangle size={12} className="text-amber-400" />
          <span className="text-xs text-slate-500">Click the red <code className="text-red-400 bg-slate-800 px-1 rounded">!</code> on any node to inject a failure and see the retry animation</span>
        </div>
      )}
    </div>
  )
}
