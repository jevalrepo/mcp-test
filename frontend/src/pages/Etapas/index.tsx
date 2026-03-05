import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconButton, Tooltip, Chip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DataTable, { type DataTableColumn } from "../../components/DataTable";
import { getEtapas, createEtapa, updateEtapa, deleteEtapa } from "../../api/client";
import { useToast } from "../../components/Toast";
import { useConfirm } from "../../components/ConfirmDialog";

const ESTATUS_COLORS: Record<string, "success" | "warning" | "error" | "default"> = {
  COMPLETADO: "success",
  VERDE: "success",
  AMARILLO: "warning",
  ROJO: "error",
};

const ESTATUS_OPTIONS = ["VERDE", "AMARILLO", "ROJO", "COMPLETADO"];

const EMPTY_FORM = { folio_ppm: "", nombre: "", estatus: "VERDE" };

export default function Etapas() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");

  const { data: etapas = [], isLoading } = useQuery({
    queryKey: ["etapas"],
    queryFn: () => getEtapas(),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateEtapa(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["etapas"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteEtapa(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etapas"] });
      toast("success", "Etapa eliminada");
    },
    onError: () => toast("error", "No se pudo eliminar la etapa"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => createEtapa(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etapas"] });
      setFormOpen(false);
      setForm({ ...EMPTY_FORM });
      setFormError("");
      toast("success", "Etapa creada");
    },
    onError: () => toast("error", "No se pudo crear la etapa"),
  });

  function openForm() {
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setFormOpen(true);
  }

  function submitForm() {
    const folio = form.folio_ppm.trim();
    const nombre = form.nombre.trim();
    if (!folio || !nombre) {
      setFormError("Folio y Nombre son obligatorios.");
      return;
    }
    createMut.mutate({
      folio_ppm: folio,
      nombre,
      estatus: form.estatus,
    });
  }

  const columns = useMemo<DataTableColumn<any>[]>(
    () => [
      { accessorKey: "folio_ppm", header: "Folio", size: 110, meta: { editable: false } },
      { accessorKey: "nombre", header: "Etapa", size: 200 },
      {
        accessorKey: "estatus",
        header: "Estatus",
        size: 120,
        cell: ({ cell }) => {
          const val: string = String(cell.getValue() ?? "VERDE");
          return (
            <Chip
              label={val}
              size="small"
              color={ESTATUS_COLORS[val] ?? "default"}
              sx={{ fontSize: "0.7rem", fontWeight: 600 }}
            />
          );
        },
      },
      { accessorKey: "orden", header: "Orden", size: 80 },
      { accessorKey: "fecha_inicio", header: "Inicio", size: 110 },
      { accessorKey: "fecha_fin", header: "Fin", size: 110 },
    ],
    [],
  );

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#610000] tracking-tight">Etapas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fases de avance por proyecto</p>
      </div>
      <div>
        <DataTable
          columns={columns}
          data={etapas}
          isLoading={isLoading}
          getRowId={(row) => row.id}
          onEditSave={async (original, values) => {
            await updateMut.mutateAsync({ id: original.id, data: values });
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
                    if (await confirm({ title: "Eliminar etapa", message: `¿Eliminar la etapa "${row.original.nombre}"?`, confirmLabel: "Eliminar" }))
                      deleteMut.mutate(row.original.id);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          )}
          topToolbar={(
            <button
              className="flex items-center gap-1 px-3 py-1.5 bg-[#dc143c] text-white text-sm rounded hover:bg-[#9c0720] transition-colors"
              onClick={openForm}
            >
              <AddIcon fontSize="small" /> Nueva etapa
            </button>
          )}
        />
      </div>

      {/* ── Modal Nueva Etapa ── */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-xl bg-white border border-gray-200 shadow-xl p-6"
            style={{ fontFamily: "Consolas, monospace" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#610000]">Nueva etapa</h2>
              <button
                className="text-sm text-gray-400 hover:text-gray-600"
                onClick={() => setFormOpen(false)}
                disabled={createMut.isPending}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Folio del proyecto *</label>
                <input
                  value={form.folio_ppm}
                  onChange={(e) => setForm((p) => ({ ...p, folio_ppm: e.target.value }))}
                  placeholder="ej. F-200900"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre de la etapa *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  placeholder="ej. Análisis, Diseño..."
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estatus</label>
                <select
                  value={form.estatus}
                  onChange={(e) => setForm((p) => ({ ...p, estatus: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#dc143c]/25 focus:border-[#dc143c] bg-white"
                >
                  {ESTATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFormOpen(false)}
                disabled={createMut.isPending}
                className="px-4 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitForm}
                disabled={createMut.isPending}
                className="px-4 py-1.5 text-sm rounded bg-[#dc143c] text-white hover:bg-[#9c0720] disabled:opacity-50 transition-colors"
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
