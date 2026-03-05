import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconButton, Tooltip, Chip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import DataTable, { type DataTableColumn } from "../../components/DataTable";
import { useToast } from "../../components/Toast";
import { useConfirm } from "../../components/ConfirmDialog";
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
  createEtapa,
  updateEtapa,
  updateProyecto,
} from "../../api/client";

const ETAPAS_FIJAS = [
  "Estimación",
  "Planeación",
  "Análisis_tecnico",
  "Diseño_detallado",
  "Realización",
  "QA",
  "Implementación",
  "Garantía",
];

function pct(val: number) {
  return `${Math.round(val)}%`;
}

function toUiPercent(val: unknown) {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function toDbPercent(val: unknown) {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(100, n)));
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

function formatDateDisplay(value: unknown) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = s.match(iso);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${dd}/${mm}/${yyyy}`;
  }
  return s;
}

function DateInputEditor(props: any) {
  return (
    <input
      type="date"
      value={props.value ?? ""}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={() => props.onCommit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") props.onCommit();
        if (e.key === "Escape") props.onCancel();
      }}
      autoFocus={props.autoFocus}
      className="w-full h-full min-h-[34px] px-2 border border-[#dc143c]/30 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30"
      style={{ fontFamily: "Consolas, monospace" }}
    />
  );
}

export default function DetalleProyecto() {
  const { folio } = useParams<{ folio: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [riesgoInput, setRiesgoInput] = useState("");
  const [riesgoModalOpen, setRiesgoModalOpen] = useState(false);

  const { data: proyecto } = useQuery({
    queryKey: ["proyecto", folio],
    queryFn: () => getProyecto(folio!),
  });

  const { data: actividades = [], isLoading: loadAct } = useQuery({
    queryKey: ["actividades", folio],
    queryFn: () => getActividades(folio!),
  });

  const { data: riesgos = [], isLoading: loadRi } = useQuery({
    queryKey: ["riesgos", folio],
    queryFn: () => getRiesgos(folio!),
  });

  const { data: historial = [] } = useQuery({
    queryKey: ["historial", folio],
    queryFn: () => getHistorial(folio!),
  });

  const { data: etapas = [] } = useQuery({
    queryKey: ["etapas", folio],
    queryFn: () => getEtapas(folio!),
  });

  const [estatus, setEstatus] = useState("");
  const [estatusSaved, setEstatusSaved] = useState("");
  const [isCostoFocused, setIsCostoFocused] = useState(false);
  const [info, setInfo] = useState({
    objetivo: "",
    area_nombre: "",
    lider_cliente_nombre: "",
    ern: "",
    le: "",
    horas_internas: "",
    horas_externas: "",
    horas_totales: "",
    costo_total: "",
    fecha_inicio: "",
    fecha_fin_liberacion: "",
    fecha_fin_garantia: "",
  });
  const [infoSaved, setInfoSaved] = useState({
    objetivo: "",
    area_nombre: "",
    lider_cliente_nombre: "",
    ern: "",
    le: "",
    horas_internas: "",
    horas_externas: "",
    horas_totales: "",
    costo_total: "",
    fecha_inicio: "",
    fecha_fin_liberacion: "",
    fecha_fin_garantia: "",
  });

  useEffect(() => {
    if (proyecto) {
      setEstatus(proyecto.descripcion_estatus || "");
      setEstatusSaved(proyecto.descripcion_estatus || "");
      const nextInfo = {
        objetivo: proyecto.objetivo || "",
        area_nombre: proyecto.area_nombre || "",
        lider_cliente_nombre: proyecto.lider_cliente_nombre || "",
        ern: proyecto.ern || "",
        le: proyecto.le || "",
        horas_internas: String(proyecto.horas_internas ?? ""),
        horas_externas: String(proyecto.horas_externas ?? ""),
        horas_totales: String(proyecto.horas_totales ?? ""),
        costo_total: String(proyecto.costo_total ?? ""),
        fecha_inicio: proyecto.fecha_inicio || "",
        fecha_fin_liberacion: proyecto.fecha_fin_liberacion || "",
        fecha_fin_garantia: proyecto.fecha_fin_garantia || "",
      };
      setInfo(nextInfo);
      setInfoSaved(nextInfo);
    }
  }, [proyecto]);

  const updProyecto = useMutation({
    mutationFn: (data: any) => updateProyecto(folio!, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["proyecto", folio] });
      setEstatusSaved(updated.descripcion_estatus || "");
      const nextInfo = {
        objetivo: updated.objetivo || "",
        area_nombre: updated.area_nombre || "",
        lider_cliente_nombre: updated.lider_cliente_nombre || "",
        ern: updated.ern || "",
        le: updated.le || "",
        horas_internas: String(updated.horas_internas ?? ""),
        horas_externas: String(updated.horas_externas ?? ""),
        horas_totales: String(updated.horas_totales ?? ""),
        costo_total: String(updated.costo_total ?? ""),
        fecha_inicio: updated.fecha_inicio || "",
        fecha_fin_liberacion: updated.fecha_fin_liberacion || "",
        fecha_fin_garantia: updated.fecha_fin_garantia || "",
      };
      setInfo(nextInfo);
      setInfoSaved(nextInfo);
    },
  });

  const responsiblesDirty =
    info.area_nombre !== infoSaved.area_nombre ||
    info.lider_cliente_nombre !== infoSaved.lider_cliente_nombre ||
    info.ern !== infoSaved.ern ||
    info.le !== infoSaved.le;

  const detalleDirty =
    info.objetivo !== infoSaved.objetivo ||
    info.horas_internas !== infoSaved.horas_internas ||
    info.horas_externas !== infoSaved.horas_externas ||
    info.horas_totales !== infoSaved.horas_totales ||
    info.costo_total !== infoSaved.costo_total ||
    info.fecha_inicio !== infoSaved.fecha_inicio ||
    info.fecha_fin_liberacion !== infoSaved.fecha_fin_liberacion ||
    info.fecha_fin_garantia !== infoSaved.fecha_fin_garantia;
  const estatusDirty = estatus !== estatusSaved;
  const hasPendingChanges = detalleDirty || estatusDirty;

  function saveDetalle() {
    const payload = {
      objetivo: info.objetivo,
      horas_internas: Number(info.horas_internas || 0),
      horas_externas: Number(info.horas_externas || 0),
      horas_totales: Number(info.horas_totales || 0),
      costo_total: Number(info.costo_total || 0),
      fecha_inicio: info.fecha_inicio,
      fecha_fin_liberacion: info.fecha_fin_liberacion,
      fecha_fin_garantia: info.fecha_fin_garantia,
    };
    updProyecto.mutate({
      ...payload,
      descripcion_estatus: estatus,
    });
  }

  function saveResponsables() {
    const payload = {
      area_nombre: info.area_nombre,
      lider_cliente_nombre: info.lider_cliente_nombre,
      ern: info.ern,
      le: info.le,
    };
    updProyecto.mutate(payload);
  }

  const etapaMap: Record<string, any> = {};
  for (const e of etapas) etapaMap[e.nombre] = e;

  const createEtapaMut = useMutation({
    mutationFn: (data: any) => createEtapa(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etapas", folio] }),
  });

  const updateEtapaMut = useMutation({
    mutationFn: ({ id, data }: any) => updateEtapa(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etapas", folio] }),
  });

  function toggleEtapa(nombre: string) {
    const existing = etapaMap[nombre];
    if (!existing) {
      createEtapaMut.mutate({
        folio_ppm: folio,
        nombre,
        estatus: "EN_CURSO",
        orden: ETAPAS_FIJAS.indexOf(nombre),
      });
    } else {
      const current = String(existing.estatus || "").toUpperCase();
      const next =
        current === "COMPLETADO"
          ? null
          : current === "EN_CURSO"
            ? "COMPLETADO"
            : "EN_CURSO";
      updateEtapaMut.mutate({ id: existing.id, data: { estatus: next } });
    }
  }

  const updAct = useMutation({
    mutationFn: ({ id, data }: any) => updateActividad(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["actividades", folio] }),
  });

  const delAct = useMutation({
    mutationFn: (id: number) => deleteActividad(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actividades", folio] });
      toast("success", "Actividad eliminada");
    },
    onError: () => toast("error", "No se pudo eliminar la actividad"),
  });

  const updRi = useMutation({
    mutationFn: ({ id, data }: any) => updateRiesgo(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["riesgos", folio] }),
  });

  const delRi = useMutation({
    mutationFn: (id: number) => deleteRiesgo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["riesgos", folio] });
      toast("success", "Riesgo eliminado");
    },
    onError: () => toast("error", "No se pudo eliminar el riesgo"),
  });

  const createRi = useMutation({
    mutationFn: (data: any) => createRiesgo(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["riesgos", folio] });
      setRiesgoModalOpen(false);
      setRiesgoInput("");
      toast("success", "Riesgo agregado");
    },
    onError: () => toast("error", "No se pudo agregar el riesgo"),
  });

  const colsAct = useMemo<DataTableColumn<any>[]>(
    () => [
      { accessorKey: "actividad", header: "Actividad", size: 200, meta: { editable: false } },
      { accessorKey: "responsable_nombre", header: "Responsable", size: 160 },
      {
        accessorKey: "fecha_inicio",
        header: "Inicio",
        size: 100,
        editor: DateInputEditor,
        cell: ({ cell }) => formatDateDisplay(cell.getValue()),
      },
      {
        accessorKey: "fecha_fin",
        header: "Fin",
        size: 100,
        editor: DateInputEditor,
        cell: ({ cell }) => formatDateDisplay(cell.getValue()),
      },
      {
        accessorKey: "avance",
        header: "Avance",
        size: 220,
        cell: ({ cell }) => {
          const raw = Number(cell.getValue() ?? 0);
          const percent = Math.max(0, Math.min(100, raw));
          const value = `${percent.toFixed(0)}%`;
          return (
            <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
              {percent > 0 ? (
                <div
                  className="bg-green-500 h-5 rounded-full flex items-center justify-center px-2"
                  style={{ width: value }}
                >
                  <span className="text-[11px] text-white leading-none whitespace-nowrap">{value}</span>
                </div>
              ) : null}
            </div>
          );
        },
      },
    ],
    [],
  );

  const colsRi = useMemo<DataTableColumn<any>[]>(
    () => [
      { accessorKey: "riesgo", header: "Riesgo", size: 220 },
      { accessorKey: "responsable_nombre", header: "Responsable", size: 160 },
      { accessorKey: "mitigacion", header: "Mitigacion", size: 220 },
      { accessorKey: "fecha_materializacion", header: "Materializacion", size: 120 },
    ],
    [],
  );

  const tableActividades = useMemo(
    () =>
      actividades.map((a: any) => ({
        ...a,
        avance: toUiPercent(a.avance),
      })),
    [actividades],
  );

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      <button
        onClick={() => navigate("/ppm")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#610000] mb-4 transition-colors"
      >
        <ArrowBackIcon fontSize="small" /> Volver a proyectos
      </button>

      {proyecto && (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-gray-400 tracking-wider">{proyecto.folio_ppm}</span>
              <h1 className="text-xl font-bold text-[#610000] mt-0.5 tracking-tight" style={{ fontFamily: "Consolas, monospace" }}>{proyecto.nombre_proyecto}</h1>
            </div>
            <Chip label={proyecto.activo ? "Activo" : "Inactivo"} color={proyecto.activo ? "success" : "default"} />
          </div>
          <div className="mt-4 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Objetivo</span>
            </div>
            <textarea
              value={info.objetivo}
              onChange={(e) => setInfo((prev) => ({ ...prev, objetivo: e.target.value }))}
              rows={2}
              className="w-full mt-0.5 text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50 transition-colors"
              style={{ fontFamily: "Consolas, monospace" }}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Horas internas</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={info.horas_internas}
                  onChange={(e) => setInfo((prev) => ({ ...prev, horas_internas: onlyDigits(e.target.value) }))}
                  className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                  style={{ fontFamily: "Consolas, monospace" }}
                />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Horas externas</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={info.horas_externas}
                  onChange={(e) => setInfo((prev) => ({ ...prev, horas_externas: onlyDigits(e.target.value) }))}
                  className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                  style={{ fontFamily: "Consolas, monospace" }}
                />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Horas totales</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={info.horas_totales}
                  onChange={(e) => setInfo((prev) => ({ ...prev, horas_totales: onlyDigits(e.target.value) }))}
                  className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                  style={{ fontFamily: "Consolas, monospace" }}
                />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Costo total</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={isCostoFocused ? info.costo_total : formatCurrency(info.costo_total)}
                  onChange={(e) => setInfo((prev) => ({ ...prev, costo_total: sanitizeCurrencyInput(e.target.value) }))}
                  onFocus={() => setIsCostoFocused(true)}
                  onBlur={() => setIsCostoFocused(false)}
                  className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                  style={{ fontFamily: "Consolas, monospace" }}
                />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Fecha inicio</span>
                <input
                  type="date"
                  value={info.fecha_inicio}
                  onChange={(e) => setInfo((prev) => ({ ...prev, fecha_inicio: e.target.value }))}
                  className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                  style={{ fontFamily: "Consolas, monospace" }}
                />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Fecha fin de liberacion</span>
                <input
                  type="date"
                  value={info.fecha_fin_liberacion}
                  onChange={(e) => setInfo((prev) => ({ ...prev, fecha_fin_liberacion: e.target.value }))}
                  className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                  style={{ fontFamily: "Consolas, monospace" }}
                />
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide">Fecha fin de garantia</span>
                <input
                  type="date"
                  value={info.fecha_fin_garantia}
                  onChange={(e) => setInfo((prev) => ({ ...prev, fecha_fin_garantia: e.target.value }))}
                  className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                  style={{ fontFamily: "Consolas, monospace" }}
                />
              </div>
              <div>
                <span className="text-xs text-transparent uppercase tracking-wide select-none">Guardar</span>
                {hasPendingChanges ? (
                  <button
                    onClick={saveDetalle}
                    disabled={updProyecto.isPending}
                    className="w-1/2 mx-auto block mt-0.5 h-[38px] bg-[#dc143c] text-white rounded px-2 py-1.5 hover:bg-[#9c0720] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updProyecto.isPending ? "Guardando..." : "Guardar"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Estatus</span>
            </div>
            <textarea
              value={estatus}
              onChange={(e) => setEstatus(e.target.value)}
              rows={3}
              className="w-full mt-0.5 text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50 transition-colors"
              style={{ fontFamily: "Consolas, monospace" }}
              placeholder="Descripcion del estatus del proyecto..."
            />
          </div>
        </div>
      )}

      {proyecto && (
        <>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-[#610000] tracking-tight">Responsables</h2>
          {responsiblesDirty ? (
            <button
              onClick={saveResponsables}
              disabled={updProyecto.isPending}
              className="h-[30px] min-w-[88px] bg-[#dc143c] text-white text-xs rounded-md px-2.5 py-1 hover:bg-[#9c0720] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updProyecto.isPending ? "Guardando..." : "Guardar"}
            </button>
          ) : null}
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Area</span>
              <input
                value={info.area_nombre}
                onChange={(e) => setInfo((prev) => ({ ...prev, area_nombre: e.target.value }))}
                className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                style={{ fontFamily: "Consolas, monospace" }}
              />
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">Lider cliente</span>
              <input
                value={info.lider_cliente_nombre}
                onChange={(e) => setInfo((prev) => ({ ...prev, lider_cliente_nombre: e.target.value }))}
                className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                style={{ fontFamily: "Consolas, monospace" }}
              />
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">ERN</span>
              <input
                value={info.ern}
                onChange={(e) => setInfo((prev) => ({ ...prev, ern: e.target.value }))}
                className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                style={{ fontFamily: "Consolas, monospace" }}
              />
            </div>
            <div>
              <span className="text-xs text-gray-400 uppercase tracking-wide">LE</span>
              <input
                value={info.le}
                onChange={(e) => setInfo((prev) => ({ ...prev, le: e.target.value }))}
                className="w-full font-medium mt-0.5 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#dc143c]/30 focus:border-[#dc143c]/50"
                style={{ fontFamily: "Consolas, monospace" }}
              />
            </div>
          </div>
        </div>
        </>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#610000] mb-3 tracking-tight">Etapas</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="w-full table-fixed text-center" style={{ fontFamily: "Consolas, monospace" }}>
            <thead>
              <tr className="bg-[#f8f9fa] border-b-2 border-gray-200">
                {ETAPAS_FIJAS.map((e) => (
                  <th
                    key={e}
                    className="w-[12.5%] px-2 py-1.5 text-gray-500 text-[0.7rem] font-semibold tracking-widest uppercase whitespace-nowrap border-r border-gray-200 last:border-r-0"
                  >
                    {e.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {ETAPAS_FIJAS.map((nombre) => {
                  const e = etapaMap[nombre];
                  const estado = String(e?.estatus || "").toUpperCase();
                  const completado = estado === "COMPLETADO";
                  const enCurso = estado === "EN_CURSO";
                  const tooltip = !estado
                    ? "Sin icono. Clic para En curso"
                    : enCurso
                      ? "En curso. Clic para Completo"
                      : "Completo. Clic para dejar sin icono";
                  return (
                    <td key={nombre} className="px-3 py-2 border-r border-gray-100 last:border-r-0">
                      <Tooltip title={tooltip}>
                        <IconButton size="small" onClick={() => toggleEtapa(nombre)} sx={{ transition: "transform 0.15s" }}>
                          {completado ? (
                            <CheckCircleIcon sx={{ fontSize: 28, color: "#16a34a" }} />
                          ) : enCurso ? (
                            <SettingsIcon sx={{ fontSize: 28, color: "#94a3b8" }} />
                          ) : (
                            <span style={{ width: 28, height: 28, display: "inline-block" }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#610000] mb-3 tracking-tight">Actividades</h2>
        <div>
          <DataTable
            columns={colsAct}
            data={tableActividades}
            isLoading={loadAct}
            getRowId={(row) => row.id}
            pageSize={7}
            onEditSave={async (original, values) => {
              const payload = { ...values } as Record<string, unknown>;
              if ("avance" in payload) {
                payload.avance = toDbPercent(payload.avance);
              }
              await updAct.mutateAsync({ id: original.id, data: payload });
            }}
            renderRowActions={(row, { startEdit }) => (
              <div className="flex gap-1">
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={startEdit}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={async () => {
                      if (await confirm({ title: "Eliminar actividad", message: "¿Confirmar eliminación de esta actividad?", confirmLabel: "Eliminar" }))
                        delAct.mutate(row.original.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            )}
          />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#610000] mb-3 tracking-tight">Riesgos</h2>
        <div>
          <DataTable
            columns={colsRi}
            data={riesgos}
            isLoading={loadRi}
            getRowId={(row) => row.id}
            onEditSave={async (original, values) => {
              await updRi.mutateAsync({ id: original.id, data: values });
            }}
            renderRowActions={(row, { startEdit }) => (
              <div className="flex gap-1">
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={startEdit}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={async () => {
                      if (await confirm({ title: "Eliminar riesgo", message: "¿Confirmar eliminación de este riesgo?", confirmLabel: "Eliminar" }))
                        delRi.mutate(row.original.id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            )}
            topToolbar={(
              <button
                className="flex items-center gap-1 px-3 py-1.5 bg-[#dc143c] text-white text-sm rounded hover:bg-[#9c0720]"
                onClick={() => { setRiesgoInput(""); setRiesgoModalOpen(true); }}
              >
                <AddIcon fontSize="small" /> Agregar
              </button>
            )}
          />
        </div>
      </div>

      {historial.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#610000] mb-3 tracking-tight">Historial de cambios</h2>
          <div className="bg-white rounded-xl shadow-sm border divide-y text-sm">
            {historial.map((h: any) => (
              <div key={h.id} className="px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-gray-400 text-xs w-full sm:w-36 flex-shrink-0">{new Date(h.fecha).toLocaleString("es-MX")}</span>
                <span className="font-medium text-gray-700">{h.campo}</span>
                {h.referencia && <span className="text-gray-400 text-xs">({h.referencia})</span>}
                <span className="text-gray-300">-&gt;</span>
                <span className="text-green-600 font-medium">{h.valor_nuevo}</span>
                <span className="text-gray-300 text-xs sm:ml-auto">antes: {h.valor_anterior}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal Agregar Riesgo ── */}
      {riesgoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-xl bg-white border border-gray-200 shadow-xl p-6"
            style={{ fontFamily: "Consolas, monospace" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#610000]">Agregar riesgo</h2>
              <button
                className="text-sm text-gray-400 hover:text-gray-600"
                onClick={() => setRiesgoModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Descripción del riesgo</label>
              <textarea
                rows={3}
                value={riesgoInput}
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
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const desc = riesgoInput.trim();
                  if (!desc) return;
                  createRi.mutate({ folio_ppm: folio, riesgo: desc });
                }}
                disabled={!riesgoInput.trim() || createRi.isPending}
                className="px-4 py-1.5 text-sm rounded bg-[#dc143c] text-white hover:bg-[#9c0720] disabled:opacity-50 transition-colors"
              >
                {createRi.isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
