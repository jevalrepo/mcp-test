import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { IconButton, Tooltip } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SettingsIcon from '@mui/icons-material/Settings'
import DataTable, { type DataTableColumn } from '../../components/DataTable'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import {
  getProyecto,
  getActividades,
  getRiesgos,
  getHistorial,
  getEtapas,
  updateActividad,
  deleteActividad,
  updateRiesgo,
  deleteRiesgo,
  createRiesgo,
  updateProyecto,
} from '../../api/client'

const ETAPAS_FIJAS = [
  'Estimación',
  'Planeación',
  'Análisis_tecnico',
  'Diseño_detallado',
  'Realización',
  'QA',
  'Implementación',
  'Garantía',
]

const ESTATUS_CHIP: Record<string, string> = {
  'Ejecución':  'bg-green-100 text-green-800',
  'Por revisar': 'bg-amber-100 text-amber-800',
  'Cerrado':    'bg-gray-100 text-gray-600',
  'Cancelado':  'bg-red-100 text-red-800',
}

type TabId = 'general' | 'actividades' | 'riesgos' | 'historial'
const TABS: { id: TabId; label: string }[] = [
  { id: 'general',      label: 'General' },
  { id: 'actividades',  label: 'Actividades' },
  { id: 'riesgos',      label: 'Riesgos' },
  { id: 'historial',    label: 'Historial' },
]

function toUiPercent(val: unknown) {
  const n = Number(val ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

function toDbPercent(val: unknown) {
  const n = Number(val ?? 0)
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.max(0, Math.min(100, n)))
}

function onlyDigits(value: string) {
  return value.replace(/\D+/g, '')
}

function sanitizeCurrencyInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [integerPart = '', ...rest] = cleaned.split('.')
  const decimalPart = rest.join('').slice(0, 2)
  return decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart
}

function formatCurrency(value: string) {
  if (!value) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDateDisplay(value: unknown) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const [, yyyy, mm, dd] = match
    return `${dd}/${mm}/${yyyy}`
  }
  return s
}

function DateInputEditor(props: any) {
  return (
    <input
      type="date"
      value={props.value ?? ''}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={() => props.onCommit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') props.onCommit()
        if (e.key === 'Escape') props.onCancel()
      }}
      autoFocus={props.autoFocus}
      placeholder="dd/mm/aaaa"
      className="w-full h-full min-h-[34px] px-2 border border-[#dc143c]/30 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30"
      style={{ fontFamily: 'Consolas, monospace' }}
    />
  )
}

function CircleProgress({
  label,
  color,
  value,
  onChange,
}: {
  label: string
  color: string
  value: string
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const pct = Math.min(100, Math.max(0, Number(value) || 0))
  const r = 38
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  function commit() {
    setEditing(false)
    const clamped = String(Math.min(100, Math.max(0, Number(draft.replace(/\D/g, '')) || 0)))
    onChange(clamped)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <div
        className="relative cursor-pointer select-none"
        onDoubleClick={() => { setDraft(String(pct)); setEditing(true) }}
        title="Doble clic para editar"
      >
        <svg width="90" height="90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="9" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.35s ease' }}
          />
        </svg>
        {editing ? (
          <input
            autoFocus type="text" inputMode="numeric" value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            className="absolute inset-0 w-full h-full text-center text-sm font-bold bg-transparent border-none focus:outline-none"
            style={{ fontFamily: 'Consolas, monospace' }}
            maxLength={3}
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center text-sm font-bold"
            style={{ color: pct === 0 ? '#9ca3af' : color }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  )
}

// ── Shared input style ────────────────────────────────────────────────────────
const INPUT = 'w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50'
const LABEL = 'block text-xs text-gray-400 uppercase tracking-wide mb-1'

function CollapsibleCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50/70 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function DetalleProyecto() {
  const { folio } = useParams<{ folio: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const TAB_KEY = `ppm-tab-${folio}`
  const [activeTab, setActiveTab] = useState<TabId>(
    () => (sessionStorage.getItem(TAB_KEY) as TabId) ?? 'general'
  )
  function changeTab(tab: TabId) {
    sessionStorage.setItem(TAB_KEY, tab)
    setActiveTab(tab)
  }
  const [riesgoInput, setRiesgoInput] = useState('')
  const [riesgoModalOpen, setRiesgoModalOpen] = useState(false)

  const { data: proyecto } = useQuery({
    queryKey: ['proyecto', folio],
    queryFn: () => getProyecto(folio!),
  })

  const { data: actividades = [], isLoading: loadAct } = useQuery({
    queryKey: ['actividades', folio],
    queryFn: () => getActividades(folio!),
  })

  const { data: riesgos = [], isLoading: loadRi } = useQuery({
    queryKey: ['riesgos', folio],
    queryFn: () => getRiesgos(folio!),
  })

  const { data: historial = [] } = useQuery({
    queryKey: ['historial', folio],
    queryFn: () => getHistorial(folio!),
  })

  const { data: etapas = [] } = useQuery({
    queryKey: ['etapas', folio],
    queryFn: () => getEtapas(folio!),
  })

  const [estatus, setEstatus] = useState('')
  const [estatusSaved, setEstatusSaved] = useState('')
  const [isCostoFocused, setIsCostoFocused] = useState(false)

  const EMPTY_INFO = {
    objetivo: '',
    area_nombre: '',
    lider_cliente_nombre: '',
    ern: '',
    le: '',
    horas_internas: '',
    horas_externas: '',
    horas_totales: '',
    costo_total: '',
    fecha_inicio: '',
    fecha_fin_liberacion: '',
    fecha_fin_garantia: '',
    avance_planeado: '0',
    avance_real: '0',
  }

  const [info, setInfo] = useState(EMPTY_INFO)
  const [infoSaved, setInfoSaved] = useState(EMPTY_INFO)

  useEffect(() => {
    if (proyecto) {
      setEstatus(proyecto.descripcion_estatus || '')
      setEstatusSaved(proyecto.descripcion_estatus || '')
      const next = {
        objetivo: proyecto.objetivo || '',
        area_nombre: proyecto.area_nombre || '',
        lider_cliente_nombre: proyecto.lider_cliente_nombre || '',
        ern: proyecto.ern || '',
        le: proyecto.le || '',
        horas_internas: String(proyecto.horas_internas ?? ''),
        horas_externas: String(proyecto.horas_externas ?? ''),
        horas_totales: String(proyecto.horas_totales ?? ''),
        costo_total: String(proyecto.costo_total ?? ''),
        fecha_inicio: proyecto.fecha_inicio || '',
        fecha_fin_liberacion: proyecto.fecha_fin_liberacion || '',
        fecha_fin_garantia: proyecto.fecha_fin_garantia || '',
        avance_planeado: String(proyecto.avance_planeado ?? '0'),
        avance_real: String(proyecto.avance_real ?? '0'),
      }
      setInfo(next)
      setInfoSaved(next)
    }
  }, [proyecto])

  const updProyecto = useMutation({
    mutationFn: (data: any) => updateProyecto(folio!, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['proyecto', folio] })
      qc.invalidateQueries({ queryKey: ['proyectos'] })
      setEstatusSaved(updated.descripcion_estatus || '')
      const next = {
        objetivo: updated.objetivo || '',
        area_nombre: updated.area_nombre || '',
        lider_cliente_nombre: updated.lider_cliente_nombre || '',
        ern: updated.ern || '',
        le: updated.le || '',
        horas_internas: String(updated.horas_internas ?? ''),
        horas_externas: String(updated.horas_externas ?? ''),
        horas_totales: String(updated.horas_totales ?? ''),
        costo_total: String(updated.costo_total ?? ''),
        fecha_inicio: updated.fecha_inicio || '',
        fecha_fin_liberacion: updated.fecha_fin_liberacion || '',
        fecha_fin_garantia: updated.fecha_fin_garantia || '',
        avance_planeado: String(updated.avance_planeado ?? '0'),
        avance_real: String(updated.avance_real ?? '0'),
      }
      setInfo(next)
      setInfoSaved(next)
    },
  })

  const isGeneralDirty =
    info.objetivo !== infoSaved.objetivo ||
    info.area_nombre !== infoSaved.area_nombre ||
    info.lider_cliente_nombre !== infoSaved.lider_cliente_nombre ||
    info.ern !== infoSaved.ern ||
    info.le !== infoSaved.le ||
    info.horas_internas !== infoSaved.horas_internas ||
    info.horas_externas !== infoSaved.horas_externas ||
    info.horas_totales !== infoSaved.horas_totales ||
    info.costo_total !== infoSaved.costo_total ||
    info.fecha_inicio !== infoSaved.fecha_inicio ||
    info.fecha_fin_liberacion !== infoSaved.fecha_fin_liberacion ||
    info.fecha_fin_garantia !== infoSaved.fecha_fin_garantia ||
    info.avance_planeado !== infoSaved.avance_planeado ||
    info.avance_real !== infoSaved.avance_real ||
    estatus !== estatusSaved

  function saveGeneral() {
    updProyecto.mutate({
      objetivo: info.objetivo,
      area_nombre: info.area_nombre,
      lider_cliente_nombre: info.lider_cliente_nombre,
      ern: info.ern,
      le: info.le,
      horas_internas: Number(info.horas_internas || 0),
      horas_externas: Number(info.horas_externas || 0),
      horas_totales: Number(info.horas_totales || 0),
      costo_total: Number(info.costo_total || 0),
      fecha_inicio: info.fecha_inicio,
      fecha_fin_liberacion: info.fecha_fin_liberacion,
      fecha_fin_garantia: info.fecha_fin_garantia,
      avance_planeado: toDbPercent(info.avance_planeado),
      avance_real: toDbPercent(info.avance_real),
      descripcion_estatus: estatus,
    })
  }

  // ── Etapas ────────────────────────────────────────────────────────────────
  const etapaMap: Record<string, any> = {}
  for (const e of etapas) etapaMap[e.nombre] = e


  // ── Actividades ───────────────────────────────────────────────────────────
  const updAct = useMutation({
    mutationFn: ({ id, data }: any) => updateActividad(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actividades', folio] })
      qc.invalidateQueries({ queryKey: ['etapas', folio] })
      qc.invalidateQueries({ queryKey: ['proyectos'] })
    },
  })

  const delAct = useMutation({
    mutationFn: (id: number) => deleteActividad(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['actividades', folio] })
      qc.invalidateQueries({ queryKey: ['proyectos'] })
      toast('success', 'Actividad eliminada')
    },
    onError: () => toast('error', 'No se pudo eliminar la actividad'),
  })

  // ── Riesgos ───────────────────────────────────────────────────────────────
  const updRi = useMutation({
    mutationFn: ({ id, data }: any) => updateRiesgo(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['riesgos', folio] }),
  })

  const delRi = useMutation({
    mutationFn: (id: number) => deleteRiesgo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['riesgos', folio] })
      toast('success', 'Riesgo eliminado')
    },
    onError: () => toast('error', 'No se pudo eliminar el riesgo'),
  })

  const createRi = useMutation({
    mutationFn: (data: any) => createRiesgo(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['riesgos', folio] })
      setRiesgoModalOpen(false)
      setRiesgoInput('')
      toast('success', 'Riesgo agregado')
    },
    onError: () => toast('error', 'No se pudo agregar el riesgo'),
  })

  // ── Column defs ───────────────────────────────────────────────────────────
  const colsAct = useMemo<DataTableColumn<any>[]>(
    () => [
      { accessorKey: 'actividad', header: 'Actividad', size: 200, meta: { editable: false, sortable: false } },
      { accessorKey: 'responsable_nombre', header: 'Responsable', size: 160, meta: { sortable: false } },
      { accessorKey: 'fecha_inicio', header: 'Inicio', size: 100, editor: DateInputEditor, cell: ({ cell }) => formatDateDisplay(cell.getValue()), meta: { sortable: false } },
      { accessorKey: 'fecha_fin', header: 'Fin', size: 100, editor: DateInputEditor, cell: ({ cell }) => formatDateDisplay(cell.getValue()), meta: { sortable: false } },
      {
        accessorKey: 'avance',
        header: 'Avance',
        size: 220,
        meta: { sortable: false },
        cell: ({ cell }) => {
          const percent = Math.max(0, Math.min(100, Number(cell.getValue() ?? 0)))
          const value = `${percent.toFixed(0)}%`
          return (
            <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
              {percent > 0 ? (
                <div className="bg-green-500 h-5 rounded-full flex items-center justify-center px-2" style={{ width: value }}>
                  <span className="text-[11px] text-white leading-none whitespace-nowrap">{value}</span>
                </div>
              ) : null}
            </div>
          )
        },
      },
    ],
    [],
  )

  const colsRi = useMemo<DataTableColumn<any>[]>(
    () => [
      { accessorKey: 'riesgo', header: 'Riesgo', size: 220 },
      { accessorKey: 'responsable_nombre', header: 'Responsable', size: 160 },
      { accessorKey: 'mitigacion', header: 'Mitigacion', size: 220 },
      { accessorKey: 'fecha_materializacion', header: 'Materializacion', size: 120 },
    ],
    [],
  )

  const tableActividades = useMemo(
    () => actividades.map((a: any) => ({ ...a, avance: toUiPercent(a.avance) })),
    [actividades],
  )

  const historialCount = (historial as any[]).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 transition-colors duration-200" style={{ fontFamily: 'Consolas, monospace' }}>

      {/* ── Tab bar + nav ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 pt-2">
        <div className="max-w-screen-xl mx-auto pl-0 pr-4 sm:pr-6 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-3 text-sm font-medium text-gray-500 hover:text-[#610000] hover:bg-gray-50 transition-colors rounded-lg mr-2 flex-shrink-0 border-b-2 border-transparent"
          >
            <ArrowBackIcon fontSize="small" />
            Volver
          </button>

          <div className="h-4 w-px bg-gray-200 flex-shrink-0 mr-2" />

          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-[#610000] text-[#610000]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.id === 'historial' && historialCount > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-[#610000]/10 text-[#610000]' : 'bg-gray-100 text-gray-500'}`}>
                    {historialCount > 99 ? '99+' : historialCount}
                  </span>
                )}
              </button>
            )
          })}

          <div className="flex-1" />

          {isGeneralDirty && activeTab === 'general' && (
            <button
              onClick={saveGeneral}
              disabled={updProyecto.isPending}
              className="flex-shrink-0 bg-[#16a34a] text-white text-xs font-medium rounded-lg px-4 py-1.5 hover:bg-[#15803d] transition-colors disabled:opacity-50"
            >
              {updProyecto.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5">

        {/* ── Tab: General ──────────────────────────────────────────────── */}
        {activeTab === 'general' && proyecto && (
          <div className="space-y-4">

            {/* Objetivo + Avances */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              <div className="xl:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
                <div className="mb-4 pb-3 border-b border-gray-100 flex-shrink-0">
                  <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-0.5">{proyecto.folio_ppm}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-gray-800 leading-snug">{proyecto.nombre_proyecto}</h2>
                    {proyecto.estatus && (
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${ESTATUS_CHIP[proyecto.estatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {proyecto.estatus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[7fr_3fr] gap-4 flex-1 min-h-0">
                  <div className="flex flex-col min-h-0">
                    <p className={`${LABEL} flex-shrink-0`}>Objetivo</p>
                    <textarea
                      value={info.objetivo}
                      onChange={(e) => setInfo((p) => ({ ...p, objetivo: e.target.value }))}
                      className="flex-1 mt-1 min-h-[120px] text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50 transition-colors"
                      style={{ fontFamily: 'Consolas, monospace' }}
                      placeholder="Descripción del objetivo del proyecto..."
                    />
                  </div>
                  <div className="flex flex-col min-h-0 sm:border-l sm:border-gray-100 sm:pl-4">
                    <p className={`${LABEL} flex-shrink-0`}>Descripción del estatus</p>
                    <textarea
                      value={estatus}
                      onChange={(e) => setEstatus(e.target.value)}
                      className="flex-1 mt-1 min-h-[120px] text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50 transition-colors"
                      style={{ fontFamily: 'Consolas, monospace' }}
                      placeholder="Descripción del estatus del proyecto..."
                    />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col items-center">
                <p className={`${LABEL} self-start`}>Avances</p>
                <div className="flex xl:flex-col items-center justify-center gap-6 flex-1 w-full pt-2">
                  <CircleProgress
                    label="Planeado" color="#3b82f6"
                    value={info.avance_planeado}
                    onChange={(v) => setInfo((p) => ({ ...p, avance_planeado: v }))}
                  />
                  <CircleProgress
                    label="Real" color="#22c55e"
                    value={info.avance_real}
                    onChange={(v) => setInfo((p) => ({ ...p, avance_real: v }))}
                  />
                </div>
              </div>
            </div>

            {/* Esfuerzo y costo */}
            <CollapsibleCard title="Esfuerzo y costo" defaultOpen={false}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={LABEL}>Horas internas</label>
                  <input type="text" inputMode="numeric" value={info.horas_internas}
                    onChange={(e) => setInfo((p) => ({ ...p, horas_internas: onlyDigits(e.target.value) }))}
                    placeholder="0" className={INPUT} style={{ fontFamily: 'Consolas, monospace' }} />
                </div>
                <div>
                  <label className={LABEL}>Horas externas</label>
                  <input type="text" inputMode="numeric" value={info.horas_externas}
                    onChange={(e) => setInfo((p) => ({ ...p, horas_externas: onlyDigits(e.target.value) }))}
                    placeholder="0" className={INPUT} style={{ fontFamily: 'Consolas, monospace' }} />
                </div>
                <div>
                  <label className={LABEL}>Horas totales</label>
                  <input type="text" inputMode="numeric" value={info.horas_totales}
                    onChange={(e) => setInfo((p) => ({ ...p, horas_totales: onlyDigits(e.target.value) }))}
                    placeholder="0" className={INPUT} style={{ fontFamily: 'Consolas, monospace' }} />
                </div>
                <div>
                  <label className={LABEL}>Costo total</label>
                  <input type="text" inputMode="decimal"
                    value={isCostoFocused ? info.costo_total : formatCurrency(info.costo_total)}
                    onChange={(e) => setInfo((p) => ({ ...p, costo_total: sanitizeCurrencyInput(e.target.value) }))}
                    onFocus={() => setIsCostoFocused(true)}
                    onBlur={() => setIsCostoFocused(false)}
                    placeholder="$0.00" className={INPUT} style={{ fontFamily: 'Consolas, monospace' }} />
                </div>
              </div>
            </CollapsibleCard>

            {/* Calendario */}
            <CollapsibleCard title="Calendario" defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Fecha inicio</label>
                  <input type="date" value={info.fecha_inicio}
                    onChange={(e) => setInfo((p) => ({ ...p, fecha_inicio: e.target.value }))}
                    className={INPUT} style={{ fontFamily: 'Consolas, monospace' }} />
                </div>
                <div>
                  <label className={LABEL}>Fecha fin liberación</label>
                  <input type="date" value={info.fecha_fin_liberacion}
                    onChange={(e) => setInfo((p) => ({ ...p, fecha_fin_liberacion: e.target.value }))}
                    className={INPUT} style={{ fontFamily: 'Consolas, monospace' }} />
                </div>
                <div>
                  <label className={LABEL}>Fecha fin garantía</label>
                  <input type="date" value={info.fecha_fin_garantia}
                    onChange={(e) => setInfo((p) => ({ ...p, fecha_fin_garantia: e.target.value }))}
                    className={INPUT} style={{ fontFamily: 'Consolas, monospace' }} />
                </div>
              </div>
            </CollapsibleCard>

            {/* Responsables */}
            <CollapsibleCard title="Responsables" defaultOpen={false}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={LABEL}>Área</label>
                  <input
                    value={info.area_nombre}
                    disabled
                    className="w-full bg-gray-100 border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-400 cursor-not-allowed"
                    style={{ fontFamily: 'Consolas, monospace' }}
                  />
                </div>
                {[
                  { key: 'lider_cliente_nombre', label: 'Líder cliente', placeholder: 'Líder cliente' },
                  { key: 'ern', label: 'ERN', placeholder: 'ERN' },
                  { key: 'le', label: 'LE', placeholder: 'Líder de ejecución' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className={LABEL}>{label}</label>
                    <input
                      value={(info as any)[key]}
                      onChange={(e) => setInfo((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className={INPUT}
                      style={{ fontFamily: 'Consolas, monospace' }}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleCard>

          </div>
        )}

        {/* ── Tab: Actividades ──────────────────────────────────────────── */}
        {activeTab === 'actividades' && (
          <div className="space-y-5">

            {/* Etapas */}
            <div>
              <p className={`${LABEL} mb-3`}>Etapas del proyecto</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                <table className="w-full table-fixed text-center" style={{ fontFamily: 'Consolas, monospace' }}>
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b-2 border-gray-200">
                      {ETAPAS_FIJAS.map((e) => (
                        <th key={e} className="w-[12.5%] px-2 py-2 text-gray-500 text-[0.65rem] font-semibold tracking-widest uppercase whitespace-nowrap border-r border-gray-200 last:border-r-0">
                          {e.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {ETAPAS_FIJAS.map((nombre) => {
                        const e = etapaMap[nombre]
                        const estado = String(e?.estatus || '').toUpperCase()
                        const completado = estado === 'COMPLETADO'
                        const enCurso = estado === 'EN_CURSO'
                        return (
                          <td key={nombre} className="px-3 py-2 border-r border-gray-100 last:border-r-0">
                            <div className="flex items-center justify-center w-full h-9">
                              {completado ? (
                                <CheckCircleIcon sx={{ fontSize: 28, color: '#16a34a' }} />
                              ) : enCurso ? (
                                <SettingsIcon sx={{ fontSize: 28, color: '#94a3b8' }} />
                              ) : (
                                <span style={{ width: 28, height: 28, display: 'inline-block' }} />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actividades */}
            <div>
              <p className={`${LABEL} mb-3`}>Actividades</p>
              <DataTable
                columns={colsAct}
                data={tableActividades}
                isLoading={loadAct}
                getRowId={(row) => row.id}
                pageSize={7}
                onEditSave={async (original, values) => {
                  const payload = { ...values } as Record<string, unknown>
                  if ('avance' in payload) payload.avance = toDbPercent(payload.avance)
                  await updAct.mutateAsync({ id: original.id, data: payload })
                }}
                renderRowActions={(row, { startEdit }) => (
                  <div className="flex gap-1">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={startEdit}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton size="small" color="error" onClick={async () => {
                        if (await confirm({ title: 'Eliminar actividad', message: '¿Confirmar eliminación de esta actividad?', confirmLabel: 'Eliminar' }))
                          delAct.mutate(row.original.id)
                      }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {/* ── Tab: Riesgos ──────────────────────────────────────────────── */}
        {activeTab === 'riesgos' && (
          <DataTable
            columns={colsRi}
            data={riesgos}
            isLoading={loadRi}
            getRowId={(row) => row.id}
            onEditSave={async (original, values) => {
              await updRi.mutateAsync({ id: original.id, data: values })
            }}
            renderRowActions={(row, { startEdit }) => (
              <div className="flex gap-1">
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={startEdit}><EditIcon fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" color="error" onClick={async () => {
                    if (await confirm({ title: 'Eliminar riesgo', message: '¿Confirmar eliminación de este riesgo?', confirmLabel: 'Eliminar' }))
                      delRi.mutate(row.original.id)
                  }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            )}
            topToolbar={
              <button
                className="flex items-center gap-1 px-3 py-1.5 bg-[#16a34a] text-white text-sm rounded hover:bg-[#15803d] transition-colors"
                onClick={() => { setRiesgoInput(''); setRiesgoModalOpen(true) }}
              >
                <AddIcon fontSize="small" /> Agregar
              </button>
            }
          />
        )}

        {/* ── Tab: Historial ────────────────────────────────────────────── */}
        {activeTab === 'historial' && (
          historialCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <span className="text-4xl mb-3">📋</span>
              <p className="text-sm">Sin cambios registrados aún</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Registro de cambios</span>
                <span className="text-xs text-gray-400">{historialCount} {historialCount === 1 ? 'entrada' : 'entradas'}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(historial as any[]).map((h: any) => (
                  <div key={h.id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm hover:bg-gray-50/50 transition-colors">
                    <span className="text-gray-400 text-xs w-full sm:w-auto flex-shrink-0 tabular-nums">
                      {new Date(h.fecha).toLocaleString('es-MX')}
                    </span>
                    <span className="font-medium text-gray-700">{h.campo}</span>
                    {h.referencia && <span className="text-gray-400 text-xs">({h.referencia})</span>}
                    <span className="text-gray-300 text-xs">→</span>
                    <span className="text-green-600 font-semibold">{h.valor_nuevo}</span>
                    <span className="text-gray-300 text-xs sm:ml-auto">antes: {h.valor_anterior}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

      </div>

      {/* ── Modal Agregar Riesgo ─────────────────────────────────────────── */}
      {riesgoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-xl bg-white border border-gray-200 shadow-xl p-6"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#610000]">Agregar riesgo</h2>
              <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => setRiesgoModalOpen(false)}>✕</button>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Descripción del riesgo</label>
              <textarea
                rows={3} value={riesgoInput}
                onChange={(e) => setRiesgoInput(e.target.value)}
                autoFocus
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c] resize-none"
                placeholder="Describe el riesgo..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRiesgoModalOpen(false)}
                className="px-4 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >Cancelar</button>
              <button
                onClick={() => { const desc = riesgoInput.trim(); if (!desc) return; createRi.mutate({ folio_ppm: folio, riesgo: desc }) }}
                disabled={!riesgoInput.trim() || createRi.isPending}
                className="px-4 py-1.5 text-sm rounded bg-[#16a34a] text-white hover:bg-[#15803d] disabled:opacity-50 transition-colors"
              >
                {createRi.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
