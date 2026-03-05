export interface Area {
  id: number;
  nombre: string;
  descripcion?: string;
}

export interface Responsable {
  id: number;
  nombre: string;
  email?: string;
  tipo: "interno" | "externo" | "cliente";
}

export interface Proyecto {
  folio_ppm: string;
  nombre_proyecto: string;
  objetivo?: string;
  activo: number;
  area_id?: number;
  area_nombre?: string;
  lider_cliente_id?: number;
  lider_cliente_nombre?: string;
  ern?: string;
  le?: string;
  ppm?: string;
  horas_internas?: number;
  horas_externas?: number;
  horas_totales?: number;
  costo_total?: number;
  fecha_inicio?: string;
  fecha_fin_liberacion?: string;
  fecha_fin_garantia?: string;
  avance_planeado: number;
  avance_real: number;
  descripcion_estatus?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface Actividad {
  id: number;
  folio_ppm: string;
  actividad: string;
  responsable_id?: number;
  responsable_nombre?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  avance: number;
  estatus_etapa?: string;
  orden: number;
}

export interface Riesgo {
  id: number;
  folio_ppm: string;
  riesgo: string;
  responsable_id?: number;
  responsable_nombre?: string;
  mitigacion?: string;
  fecha_materializacion?: string;
  activo: number;
}

export interface HistorialItem {
  id: number;
  tipo: string;
  referencia?: string;
  campo: string;
  valor_anterior?: string;
  valor_nuevo?: string;
  fecha: string;
}

export interface Estadisticas {
  total: number;
  activos: number;
  inactivos: number;
  retrasados: number;
  al_dia: number;
  promedio_avance_real: number;
  promedio_avance_planeado: number;
}
