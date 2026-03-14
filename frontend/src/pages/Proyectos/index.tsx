import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { DataGrid, type Column } from "react-open-source-grid";
import DataTable, { type DataTableColumn } from "../../components/DataTable";
import {
  getProyectos,
  updateProyecto,
  deleteProyecto,
  createProyecto,
  getPresentaciones,
  generarPresentacion,
  eliminarPresentacion,
} from "../../api/client";
import { useToast } from "../../components/Toast";
import { useConfirm } from "../../components/ConfirmDialog";


const ESTATUS_OPTIONS = ["", "Ejecución", "Por revisar", "Cerrado", "Cancelado"] as const;

const ESTATUS_STYLE: Record<string, string> = {
  "Ejecución":  "bg-green-100 text-green-800",
  "Por revisar": "bg-amber-100 text-amber-800",
  "Cerrado":    "bg-gray-100 text-gray-600",
  "Cancelado":  "bg-red-100 text-red-800",
};
const ESTATUS_CARD_ORDER = ["Ejecución", "Por revisar", "Cerrado", "Cancelado"] as const;

function EstatusCell({ value, onUpdate }: { value: string | null; onUpdate: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 148) });
    setOpen(true);
  }

  const val = value ?? "";
  const chipStyle = ESTATUS_STYLE[val] ?? "";

  return (
    <>
      <button
        ref={btnRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={toggle}
        className={`w-full text-left rounded px-2 py-0.5 text-xs font-semibold border border-gray-200 cursor-pointer ${chipStyle || "text-gray-400 bg-white"}`}
        style={{ fontFamily: "Consolas, monospace" }}
      >
        {val || "—"}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded shadow-lg overflow-hidden"
        >
          {ESTATUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onUpdate(opt === "" ? null : opt); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs block hover:bg-gray-50 ${ESTATUS_STYLE[opt] ? `font-semibold ${ESTATUS_STYLE[opt]}` : "text-gray-500"}`}
              style={{ fontFamily: "Consolas, monospace" }}
            >
              {opt === "" ? "—" : opt}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

function toUiPercent(val: unknown) {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}


function round1(val: number) {
  return Math.round(val * 10) / 10;
}

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function onlyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function sanitizeCurrencyInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integerPart = "", ...rest] = cleaned.split(".");
  const decimalPart = rest.join("").slice(0, 2);
  return decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
}

function formatCurrency(value: string) {
  if (!value) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const EMPTY_CREATE_FORM = {
  folio_ppm: "",
  nombre_proyecto: "",
  objetivo: "",
  horas_internas: "",
  horas_externas: "",
  horas_totales: "",
  costo_total: "",
  fecha_inicio: "",
  fecha_fin_liberacion: "",
  fecha_fin_garantia: "",
  area_nombre: "Ahorro y Previsión",
  lider_cliente_nombre: "",
  ern: "",
  le: "",
};

const DEFAULT_PPTX_NAME = "salida_proyectos";

const FILTER_ESTATUS_OPTIONS = ESTATUS_OPTIONS.filter((o) => o !== "");

function StatusFilterDropdown({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }

  function toggleOption(opt: string) {
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors whitespace-nowrap ${
          selected.length > 0
            ? "border-[#dc143c] bg-[#dc143c]/5 text-[#dc143c]"
            : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
        }`}
        style={{ fontFamily: "Consolas, monospace" }}
      >
        Estatus
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#dc143c] text-white text-[10px] font-bold">
            {selected.length}
          </span>
        )}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, minWidth: 160 }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1"
        >
          {FILTER_ESTATUS_OPTIONS.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggleOption(opt)}
                className="w-4 h-4 accent-[#dc143c]"
              />
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ESTATUS_STYLE[opt] ?? "text-gray-700"}`}>{opt}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 mt-1"
            >
              Limpiar filtro
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export default function Proyectos() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearchRaw] = useState<string>(
    () => sessionStorage.getItem("ppm-search") ?? ""
  );
  const [filterStatuses, setFilterStatusesRaw] = useState<string[]>(() => {
    const stored = sessionStorage.getItem("ppm-filter-statuses");
    // null = nunca tocado → default Ejecución; "" = usuario limpió → []
    return stored === null ? ["Ejecución"] : stored.split(",").filter(Boolean);
  });

  const setSearch = (val: string) => {
    sessionStorage.setItem("ppm-search", val);
    setSearchRaw(val);
  };

  const setFilterStatuses = (val: string[]) => {
    // guardar vacío ("") para distinguir "limpió explícitamente" de "nunca tocado"
    sessionStorage.setItem("ppm-filter-statuses", val.join(","));
    setFilterStatusesRaw(val);
  };
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({ ...EMPTY_CREATE_FORM });
  const [isCostoCreateFocused, setIsCostoCreateFocused] = useState(false);

  // ── Estado PPTX ──────────────────────────────────────────────────────────
  const [isPptxOpen, setIsPptxOpen] = useState(false);
  const [pptxNombre, setPptxNombre] = useState(DEFAULT_PPTX_NAME);
  const ALL_PPTX_STATUSES = ["Ejecución", "Por revisar", "Cerrado", "Cancelado"] as const;
  const [pptxStatuses, setPptxStatuses] = useState<string[]>(["Ejecución"]);
  const [pptxResult, setPptxResult] = useState<{ url_descarga: string; proyectos: number } | null>(null);

  const { data: proyectos = [], isLoading } = useQuery({
    queryKey: ["proyectos"],
    queryFn: () => getProyectos(),
  });

  const updateMut = useMutation({
    mutationFn: ({ folio, data }: { folio: string; data: any }) => updateProyecto(folio, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proyectos"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (folio: string) => deleteProyecto(folio),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      toast("success", "Proyecto eliminado");
    },
    onError: () => toast("error", "No se pudo eliminar el proyecto"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => createProyecto(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      setIsCreateOpen(false);
      setCreateError("");
      setCreateForm({ ...EMPTY_CREATE_FORM });
      toast("success", "Proyecto creado");
    },
    onError: (err: any) => setCreateError(err?.message || "No se pudo crear el proyecto"),
  });

  // ── Presentaciones PPTX ──────────────────────────────────────────────────
  const { data: presentaciones = [], refetch: refetchPresentaciones } = useQuery({
    queryKey: ["presentaciones"],
    queryFn: getPresentaciones,
  });

  const generarMut = useMutation({
    mutationFn: generarPresentacion,
    onSuccess: (data) => {
      setPptxResult(data);
      refetchPresentaciones();
    },
  });

  const eliminarMut = useMutation({
    mutationFn: (nombre: string) => eliminarPresentacion(nombre),
    onSuccess: () => {
      refetchPresentaciones();
      toast("success", "Archivo eliminado");
    },
    onError: () => toast("error", "No se pudo eliminar el archivo"),
  });

  function openPptxModal() {
    setPptxNombre(DEFAULT_PPTX_NAME);
    setPptxStatuses(["Ejecución"]);
    setPptxResult(null);
    generarMut.reset();
    setIsPptxOpen(true);
  }

  function closePptxModal() {
    if (generarMut.isPending) return;
    setIsPptxOpen(false);
    setPptxResult(null);
    generarMut.reset();
  }

  function submitGenerar() {
    const nombre = pptxNombre.trim() || DEFAULT_PPTX_NAME;
    generarMut.mutate({ nombre_archivo: nombre, estatuses: pptxStatuses });
  }

  // ── Columnas y filas del DataGrid de presentaciones ──────────────────────
  const pptxGridRef = useRef<HTMLDivElement | null>(null);
  const [pptxGridWidth, setPptxGridWidth] = useState(0);

  useEffect(() => {
    const el = pptxGridRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setPptxGridWidth(el.clientWidth));
    obs.observe(el);
    setPptxGridWidth(el.clientWidth);
    return () => obs.disconnect();
  }, [isPptxOpen]);

  const pptxGridRows = useMemo(
    () =>
      (presentaciones as any[]).map((p) => ({
        id: p.nombre,
        nombre: p.nombre,
        tamaño_kb: p.tamaño_kb,
        creado: p.creado,
        _url: p.url_descarga,
      })),
    [presentaciones],
  );

  const pptxGridColumns = useMemo<Column[]>(() => {
    const base = [260, 70, 155, 80];
    const total = base.reduce((a, b) => a + b, 0);
    const scale = pptxGridWidth > 0 && total > 0 ? Math.max(1, pptxGridWidth / total) : 1;
    const [wNombre, wKb, wFecha, wAcc] = base.map((w) => Math.round(w * scale));
    return [
      { field: "nombre", headerName: "Archivo", width: wNombre, editable: false, sortable: false, filterable: false, pinnable: false },
      { field: "tamaño_kb", headerName: "KB", width: wKb, editable: false, sortable: false, filterable: false, pinnable: false },
      { field: "creado", headerName: "Fecha", width: wFecha, editable: false, sortable: false, filterable: false, pinnable: false },
      {
        field: "_acciones",
        headerName: "",
        width: wAcc,
        editable: false,
        sortable: false,
        filterable: false,
        pinnable: false,
        renderCell: (row: any) => (
          <div className="flex items-center justify-center gap-1 h-full">
            <a
              href={row._url}
              download
              title="Descargar"
              className="inline-flex items-center justify-center w-7 h-7 rounded text-green-600 hover:bg-green-50"
              onClick={(e) => e.stopPropagation()}
            >
              <DownloadIcon style={{ fontSize: 16 }} />
            </a>
            <button
              title="Eliminar"
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirm({ title: "Eliminar archivo", message: `¿Eliminar ${row.nombre}?`, confirmLabel: "Eliminar" }))
                  eliminarMut.mutate(row.nombre);
              }}
              className="inline-flex items-center justify-center w-7 h-7 rounded text-red-500 hover:bg-red-50"
            >
              <DeleteOutlineIcon style={{ fontSize: 16 }} />
            </button>
          </div>
        ),
      },
    ];
  }, [eliminarMut, pptxGridWidth]);

  function openCreateModal() {
    setCreateError("");
    setCreateForm({ ...EMPTY_CREATE_FORM });
    setIsCreateOpen(true);
  }

  function closeCreateModal() {
    if (createMut.isPending) return;
    setIsCreateOpen(false);
    setCreateError("");
  }

  function saveCreateProyecto() {
    const folio = createForm.folio_ppm.trim();
    const nombre = createForm.nombre_proyecto.trim();
    if (!folio || !nombre) {
      setCreateError("Folio y Proyecto son obligatorios.");
      return;
    }

    const payload = {
      folio_ppm: folio,
      nombre_proyecto: nombre,
      objetivo: createForm.objetivo.trim() || null,
      horas_internas: createForm.horas_internas === "" ? null : Number(createForm.horas_internas),
      horas_externas: createForm.horas_externas === "" ? null : Number(createForm.horas_externas),
      horas_totales: createForm.horas_totales === "" ? null : Number(createForm.horas_totales),
      costo_total: createForm.costo_total === "" ? null : Number(createForm.costo_total),
      fecha_inicio: createForm.fecha_inicio || null,
      fecha_fin_liberacion: createForm.fecha_fin_liberacion || null,
      fecha_fin_garantia: createForm.fecha_fin_garantia || null,
      area_nombre: createForm.area_nombre,
      lider_cliente_nombre: createForm.lider_cliente_nombre.trim() || null,
      ern: createForm.ern.trim() || null,
      le: createForm.le.trim() || null,
    };

    createMut.mutate(payload);
  }

  const columns = useMemo<DataTableColumn<any>[]>(
    () => [
      { accessorKey: "folio_ppm", header: "Folio", size: 95, meta: { editable: false } },
      { accessorKey: "nombre_proyecto", header: "Nombre", size: 470 },
      { accessorKey: "le", header: "LE", size: 230 },
      {
        accessorKey: "avance_total",
        header: "Proyecto",
        size: 110,
        meta: { editable: false },
        cell: ({ cell }) => {
          const percent = Number(cell.getValue() ?? 0);
          const value = `${percent.toFixed(0)}%`;
          return (
            <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
              {percent > 0 ? (
                <div className="bg-blue-500 h-5 rounded-full flex items-center justify-center px-2" style={{ width: value }}>
                  <span className="text-[11px] text-white leading-none whitespace-nowrap">{value}</span>
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "avance_actividad",
        header: "Actividad",
        size: 110,
        meta: { editable: false },
        cell: ({ cell }) => {
          const val = cell.getValue();
          if (val === null || val === undefined) {
            return <span className="text-gray-400 text-xs">—</span>;
          }
          const percent = Number(val);
          const value = `${percent.toFixed(0)}%`;
          return (
            <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
              {percent > 0 ? (
                <div className="bg-green-500 h-5 rounded-full flex items-center justify-center px-2" style={{ width: value }}>
                  <span className="text-[11px] text-white leading-none whitespace-nowrap">{value}</span>
                </div>
              ) : (
                <div className="flex items-center h-5 px-2">
                  <span className="text-[11px] text-gray-400 leading-none">{value}</span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "estatus",
        header: "Estatus",
        size: 110,
        meta: { editable: false },
        cell: ({ cell, row }) => (
          <EstatusCell
            value={cell.getValue() as string | null}
            onUpdate={(v) => updateMut.mutate({ folio: row.original.folio_ppm, data: { estatus: v } })}
          />
        ),
      },
    ],
    [updateMut],
  );

  const filteredProyectos = useMemo(() => {
    let result: any[] = proyectos;

    if (filterStatuses.length > 0) {
      result = result.filter((p: any) => filterStatuses.includes(p.estatus ?? ""));
    }

    const needle = search.trim().toLowerCase();
    if (needle) {
      result = result.filter((p: any) => {
        const haystack = [p.folio_ppm, p.nombre_proyecto, p.lider_cliente_nombre, p.estatus]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    return result;
  }, [proyectos, search, filterStatuses]);

  const tableProyectos = useMemo(() => filteredProyectos, [filteredProyectos]);

  const stats = useMemo(() => {
    const total = proyectos.length;
    const estatusCountsMap = new Map<string, number>();
    for (const p of proyectos) {
      const status = String(p?.estatus ?? "").trim();
      if (!status) continue;
      estatusCountsMap.set(status, (estatusCountsMap.get(status) ?? 0) + 1);
    }
    const estatusCounts = [...estatusCountsMap.entries()]
      .map(([estatus, count]) => ({ estatus, count, norm: normalizeStatus(estatus) }))
      .sort((a, b) => {
        const orderMap = new Map(ESTATUS_CARD_ORDER.map((x, i) => [normalizeStatus(x), i]));
        const ai = orderMap.has(a.norm) ? orderMap.get(a.norm)! : Number.MAX_SAFE_INTEGER;
        const bi = orderMap.has(b.norm) ? orderMap.get(b.norm)! : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return a.estatus.localeCompare(b.estatus);
      });

    const enEjecucion = proyectos.filter((p: any) => normalizeStatus(p.estatus).includes("ejecucion"));
    const retrasados = enEjecucion.filter(
      (p: any) => toUiPercent(p.avance_real) < toUiPercent(p.avance_planeado),
    ).length;
    const promedio_avance_real = enEjecucion.length
      ? round1(enEjecucion.reduce((acc: number, p: any) => acc + toUiPercent(p.avance_real), 0) / enEjecucion.length)
      : 0;

    return {
      total,
      estatusCounts,
      retrasados,
      promedio_avance_real,
    };
  }, [proyectos]);

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#610000] tracking-tight" style={{ fontFamily: "Consolas, monospace" }}>PPM</h1>
          <p className="text-sm text-gray-500 mt-0.5" style={{ fontFamily: "Consolas, monospace" }}>Gestion y seguimiento de proyectos</p>
        </div>
        <button
          onClick={openPptxModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#16a34a] text-white text-sm rounded-lg hover:bg-[#15803d] transition-colors shadow-sm"
          style={{ fontFamily: "Consolas, monospace" }}
        >
          <SlideshowIcon fontSize="small" />
          Generar PPTX
        </button>
      </div>

      {stats &&
        (() => {
          const avance = stats.promedio_avance_real ?? 0;
          const statusLabel = (norm: string, original: string) => {
            if (norm === "ejecucion") return "En ejecución";
            if (norm === "cerrado") return "Cerrados";
            if (norm === "cancelado") return "Cancelados";
            return original;
          };
          const statusColor = (norm: string) => {
            if (norm === "ejecucion") return "bg-green-50 text-green-700 border border-green-200";
            if (norm === "por revisar") return "bg-yellow-50 text-yellow-700 border border-yellow-200";
            if (norm === "cerrado") return "bg-gray-100 text-gray-700 border border-gray-300";
            if (norm === "cancelado") return "bg-red-50 text-red-700 border border-red-200";
            return "bg-white text-gray-700 border border-gray-200";
          };
          const avanceColor =
            avance >= 80
              ? "bg-green-50 text-green-700 border border-green-200"
              : avance >= 50
                ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                : "bg-red-50 text-red-700 border border-red-200";
          const retrasadoColor =
            stats.retrasados === 0
              ? "bg-green-50 text-green-700 border border-green-200"
              : stats.retrasados <= 2
                ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                : "bg-red-50 text-red-700 border border-red-200";
          const cards = [
            { label: "Proyectos", value: stats.total, color: "bg-white text-gray-700 border border-gray-200" },
            ...stats.estatusCounts.map((s: any) => ({
              label: statusLabel(s.norm, s.estatus),
              value: s.count,
              color: statusColor(s.norm),
            })),
            { label: "Retrasados", value: stats.retrasados, color: retrasadoColor },
            { label: "Avance real", value: `${avance}%`, color: avanceColor },
          ];
          return (
            <div className="flex flex-nowrap gap-2 mb-6">
              {cards.map((s) => (
                <div key={s.label} className={`rounded-xl p-3 shadow-sm min-w-0 flex-1 ${s.color}`}>
                  <div className="text-2xl font-bold leading-tight">{s.value}</div>
                  <div className="text-[11px] font-medium mt-1 opacity-80 uppercase tracking-wide truncate">{s.label}</div>
                </div>
              ))}
            </div>
          );
        })()}

      <div>
        <DataTable
          columns={columns}
          data={tableProyectos}
          isLoading={isLoading}
          getRowId={(row) => row.folio_ppm}
          contextDeleteLabel="Eliminar proyecto"
          onEditSave={async (original, values) => {
            await updateMut.mutateAsync({ folio: original.folio_ppm, data: values });
          }}
          onContextView={(row) => navigate(`/ppm/proyectos/${row.folio_ppm}`)}
          onContextDelete={async (row) => {
            if (await confirm({ title: "Eliminar proyecto", message: `¿Eliminar el proyecto ${row.folio_ppm}?`, confirmLabel: "Eliminar" }))
              deleteMut.mutate(row.folio_ppm);
          }}
          topToolbar={(
            <>
              <button
                className="flex items-center gap-1 px-3 py-1.5 bg-[#16a34a] text-white text-sm rounded hover:bg-[#15803d] transition-colors"
                onClick={openCreateModal}
              >
                <AddIcon fontSize="small" /> Nuevo proyecto
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <StatusFilterDropdown selected={filterStatuses} onChange={setFilterStatuses} />
                <div className="relative w-full sm:w-56">
                  <SearchIcon fontSize="small" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-8 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                  />
                  {search && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setSearch("")}
                      aria-label="Limpiar busqueda"
                    >
                      <ClearIcon fontSize="small" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        />
      </div>

      {/* ── Modal Generar PPTX ── */}
      {isPptxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white border border-gray-200 shadow-xl p-6 flex flex-col" style={{ fontFamily: "Consolas, monospace" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <SlideshowIcon sx={{ color: "#610000" }} />
                <h2 className="text-lg font-semibold text-[#610000]">Generar presentación PPTX</h2>
              </div>
              <button
                className="text-sm text-gray-400 hover:text-gray-600"
                onClick={closePptxModal}
                disabled={generarMut.isPending}
              >
                ✕
              </button>
            </div>

            {!pptxResult ? (
              <>
                <div className="mb-4">
                  <label className="block text-xs text-gray-500 mb-1">Nombre del archivo (sin extensión)</label>
                  <input
                    value={pptxNombre}
                    onChange={(e) => setPptxNombre(e.target.value)}
                    disabled={generarMut.isPending}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c] disabled:bg-gray-50"
                    placeholder={DEFAULT_PPTX_NAME}
                  />
                </div>

                <div className="mb-5">
                  <p className="text-xs text-gray-500 mb-2">Estatus a incluir en la presentación</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {ALL_PPTX_STATUSES.map((s) => {
                      const id = `pptx-st-${s}`;
                      const checked = pptxStatuses.includes(s);
                      return (
                        <label key={s} htmlFor={id} className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-gray-700">
                          <input
                            type="checkbox"
                            id={id}
                            checked={checked}
                            disabled={generarMut.isPending}
                            onChange={() =>
                              setPptxStatuses((prev) =>
                                checked ? prev.filter((x) => x !== s) : [...prev, s]
                              )
                            }
                            className="w-4 h-4 accent-[#dc143c]"
                          />
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ESTATUS_STYLE[s] ?? ""}`}>{s}</span>
                        </label>
                      );
                    })}

                    <div className="ml-auto">
                      <button
                        onClick={submitGenerar}
                        disabled={generarMut.isPending || pptxStatuses.length === 0}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm rounded bg-[#16a34a] text-white hover:bg-[#15803d] disabled:opacity-60 transition-colors"
                      >
                        {generarMut.isPending ? (
                          <>
                            <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Generando...
                          </>
                        ) : (
                          <>
                            <SlideshowIcon fontSize="small" />
                            Generar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {generarMut.isError && (
                  <div className="mb-4 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
                    {(generarMut.error as any)?.message || "Error al generar la presentación"}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-2">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-sm text-gray-700 mb-1">
                  Presentación generada con <span className="font-semibold">{pptxResult.proyectos}</span> proyecto(s).
                </p>
                <div className="flex justify-center gap-3 mt-5">
                  <a
                    href={pptxResult.url_descarga}
                    download
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-[#16a34a] text-white hover:bg-[#15803d] transition-colors"
                  >
                    <DownloadIcon fontSize="small" />
                    Descargar PPTX
                  </a>
                  <button
                    onClick={() => { setPptxResult(null); generarMut.reset(); }}
                    className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}

            {/* ── Historial de archivos generados ── */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-[#610000] uppercase tracking-wide mb-2">
                Archivos generados
              </p>
              <div
                ref={pptxGridRef}
                className="data-table-headers-consolas data-table-no-footer w-full overflow-hidden rounded border border-gray-200"
                style={{
                  height: pptxGridRows.length === 0 ? 56 : Math.min(pptxGridRows.length * 32 + 124, 6 * 32 + 124),
                  fontFamily: "Consolas, monospace",
                  "--grid-font-family": "Consolas, monospace",
                } as React.CSSProperties}
              >
                {pptxGridRows.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-gray-400">
                    No hay archivos generados aún.
                  </div>
                ) : (
                  <DataGrid
                    columns={pptxGridColumns}
                    rows={pptxGridRows}
                    pageSize={10}
                    footerConfig={{ show: false }}
                    hideToolbar={true}
                    showColumnPinning={false}
                    theme="material"
                    densityMode="compact"
                    contextMenuConfig={{ enabled: false }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-xl bg-white border border-gray-200 shadow-xl p-5" style={{ fontFamily: "Consolas, monospace" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#610000]">Nuevo proyecto</h2>
              <button
                className="text-sm text-gray-400 hover:text-gray-600"
                onClick={closeCreateModal}
                disabled={createMut.isPending}
              >
                ✕
              </button>
            </div>

            <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/40 p-4">
              <h3 className="text-sm font-semibold text-[#610000] mb-3">Datos generales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Folio *</label>
                  <input
                    value={createForm.folio_ppm}
                    onChange={(e) => setCreateForm((p) => ({ ...p, folio_ppm: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                  />
                </div>
                <div className="sm:col-span-1 lg:col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Proyecto *</label>
                  <input
                    value={createForm.nombre_proyecto}
                    onChange={(e) => setCreateForm((p) => ({ ...p, nombre_proyecto: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-xs text-gray-500 mb-1">Objetivo</label>
                  <textarea
                    rows={2}
                    value={createForm.objetivo}
                    onChange={(e) => setCreateForm((p) => ({ ...p, objetivo: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Horas internas</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={createForm.horas_internas}
                    onChange={(e) => setCreateForm((p) => ({ ...p, horas_internas: onlyDigits(e.target.value) }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Horas externas</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={createForm.horas_externas}
                    onChange={(e) => setCreateForm((p) => ({ ...p, horas_externas: onlyDigits(e.target.value) }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Horas totales</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={createForm.horas_totales}
                    onChange={(e) => setCreateForm((p) => ({ ...p, horas_totales: onlyDigits(e.target.value) }))}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Costo total</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={isCostoCreateFocused ? createForm.costo_total : formatCurrency(createForm.costo_total)}
                    onChange={(e) => setCreateForm((p) => ({ ...p, costo_total: sanitizeCurrencyInput(e.target.value) }))}
                    onFocus={() => setIsCostoCreateFocused(true)}
                    onBlur={() => setIsCostoCreateFocused(false)}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
                  <input type="date" value={createForm.fecha_inicio} onChange={(e) => setCreateForm((p) => ({ ...p, fecha_inicio: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha fin de liberacion</label>
                  <input type="date" value={createForm.fecha_fin_liberacion} onChange={(e) => setCreateForm((p) => ({ ...p, fecha_fin_liberacion: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha fin de garantia</label>
                  <input type="date" value={createForm.fecha_fin_garantia} onChange={(e) => setCreateForm((p) => ({ ...p, fecha_fin_garantia: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]" />
                </div>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/40 p-4">
              <h3 className="text-sm font-semibold text-[#610000] mb-3">Responsables</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Área</label>
                  <input value={createForm.area_nombre} disabled className="w-full rounded border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm text-gray-400 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Lider Cliente</label>
                  <input value={createForm.lider_cliente_nombre} onChange={(e) => setCreateForm((p) => ({ ...p, lider_cliente_nombre: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ERN</label>
                  <input value={createForm.ern} onChange={(e) => setCreateForm((p) => ({ ...p, ern: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">LE</label>
                  <input value={createForm.le} onChange={(e) => setCreateForm((p) => ({ ...p, le: e.target.value }))} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]" />
                </div>
              </div>
            </div>

            </form>
            {createError ? <div className="text-sm text-red-600 mb-3">{createError}</div> : null}

            <div className="flex justify-end">
              <button
                onClick={saveCreateProyecto}
                disabled={createMut.isPending}
                className="px-3 py-1.5 text-sm rounded bg-[#16a34a] text-white hover:bg-[#15803d] disabled:opacity-50"
              >
                {createMut.isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
