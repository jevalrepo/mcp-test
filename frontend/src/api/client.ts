const BASE = "/api/ppm";

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Proyectos
export const getProyectos = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params) : "";
  return req<any[]>(`/proyectos${qs}`);
};
export const getProyecto = (folio: string) => req<any>(`/proyectos/${folio}`);
export const createProyecto = (data: any) => req<any>("/proyectos", { method: "POST", body: JSON.stringify(data) });
export const updateProyecto = (folio: string, data: any) => req<any>(`/proyectos/${folio}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteProyecto = (folio: string) => req<any>(`/proyectos/${folio}`, { method: "DELETE" });
export const getHistorial = (folio: string) => req<any[]>(`/historial/${folio}`);
export const getEstadisticas = () => req<any>("/estadisticas");

// Actividades
export const getActividades = (folio_ppm: string) => req<any[]>(`/actividades?folio_ppm=${folio_ppm}`);
export const createActividad = (data: any) => req<any>("/actividades", { method: "POST", body: JSON.stringify(data) });
export const updateActividad = (id: number, data: any) => req<any>(`/actividades/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteActividad = (id: number) => req<any>(`/actividades/${id}`, { method: "DELETE" });

// Riesgos
export const getRiesgos = (folio_ppm: string) => req<any[]>(`/riesgos?folio_ppm=${folio_ppm}`);
export const createRiesgo = (data: any) => req<any>("/riesgos", { method: "POST", body: JSON.stringify(data) });
export const updateRiesgo = (id: number, data: any) => req<any>(`/riesgos/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteRiesgo = (id: number) => req<any>(`/riesgos/${id}`, { method: "DELETE" });

// Presentaciones PPTX
export const getPresentaciones = () => req<any[]>("/presentaciones");
export const generarPresentacion = (data: { nombre_archivo: string; estatuses: string[] | null }) =>
  req<any>("/presentaciones", { method: "POST", body: JSON.stringify(data) });
export const eliminarPresentacion = (nombre: string) =>
  req<any>(`/presentaciones/${encodeURIComponent(nombre)}`, { method: "DELETE" });

// Etapas
export const getEtapas = (folio_ppm?: string) => {
  const qs = folio_ppm ? `?folio_ppm=${folio_ppm}` : "";
  return req<any[]>(`/etapas${qs}`);
};
export const createEtapa = (data: any) => req<any>("/etapas", { method: "POST", body: JSON.stringify(data) });
export const updateEtapa = (id: number, data: any) => req<any>(`/etapas/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteEtapa = (id: number) => req<any>(`/etapas/${id}`, { method: "DELETE" });
