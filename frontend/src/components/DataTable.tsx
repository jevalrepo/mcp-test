import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DataGrid, type Column, type Row } from "react-open-source-grid";
import "./DataTableOverrides.css";

export interface DataTableRow<T extends object> {
  original: T;
}

export interface DataTableColumn<T extends object> {
  accessorKey: keyof T | string;
  header: string;
  size?: number;
  meta?: { editable?: boolean };
  cell?: (ctx: { cell: { getValue: () => unknown }; row: DataTableRow<T> }) => ReactNode;
  editor?: (props: any) => ReactNode;
  editorParams?: Record<string, unknown>;
}

interface DataTableProps<T extends object> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  getRowId: (row: T) => string | number;
  pageSize?: number;
  showFooter?: boolean;
  onEditSave?: (original: T, values: Record<string, unknown>) => Promise<void>;
  renderRowActions?: (row: DataTableRow<T>, actions: { startEdit: () => void }) => ReactNode;
  onContextView?: (original: T) => void;
  onContextDelete?: (original: T) => void;
  topToolbar?: ReactNode;
}

type GridRow<T extends object> = Row & {
  __original: T;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export default function DataTable<T extends object>({
  columns,
  data,
  isLoading,
  getRowId,
  pageSize = 20,
  showFooter = true,
  onEditSave,
  onContextView,
  onContextDelete,
  topToolbar,
}: DataTableProps<T>) {
  const [gridRows, setGridRows] = useState<GridRow<T>[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const mapped = data.map((item) => ({
      id: getRowId(item),
      ...asRecord(item),
      __original: item,
    }));
    setGridRows(mapped);
  }, [data, getRowId]);

  useEffect(() => {
    const updateWidth = () => {
      const width = containerRef.current?.clientWidth ?? 0;
      setContainerWidth(width);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const gridColumns = useMemo<Column[]>(() => {
    const baseWidths = columns.map((column) => column.size ?? 160);
    const totalBase = baseWidths.reduce((acc, width) => acc + width, 0);
    const scale = containerWidth > 0 && totalBase > 0 ? Math.max(1, containerWidth / totalBase) : 1;

    return columns.map((column) => {
      const key = String(column.accessorKey);
      const width = Math.round((column.size ?? 160) * scale);
      return {
        field: key,
        headerName: column.header,
        width,
        editable: column.meta?.editable !== false,
        sortable: false,
        filterable: false,
        pinnable: false,
        editor: column.editor,
        editorParams: column.editorParams,
        renderCell: column.cell
          ? (row) => {
              const r = row as GridRow<T>;
              const record = asRecord(r.__original);
              return column.cell({
                cell: { getValue: () => record[key] },
                row: { original: r.__original },
              });
            }
          : undefined,
      } as Column;
    });
  }, [columns, containerWidth]);

  return (
    <div className={`data-table-headers-consolas w-full overflow-hidden ${showFooter ? "" : "data-table-no-footer"}`}>
      {topToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 border-b border-gray-200">
          {topToolbar}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="h-[540px] w-full"
        style={
          {
            fontFamily: "Consolas, monospace",
            "--grid-font-family": "Consolas, monospace",
          } as CSSProperties
        }
      >
        {isLoading ? (
          <div className="text-center py-12 text-sm text-gray-400">Cargando...</div>
        ) : gridRows.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">Sin registros</div>
        ) : (
          <DataGrid
            style={{ width: "100%", height: "100%" }}
            columns={gridColumns}
            rows={gridRows}
            pageSize={pageSize}
            footerConfig={{ show: showFooter }}
            hideToolbar={true}
            showColumnPinning={false}
            theme="material"
            densityMode="compact"
            contextMenuConfig={{
              enabled: true,
              showCopy: false,
              showExport: false,
              showColumnOptions: false,
              showFilterByValue: false,
              showChartOptions: false,
              onBeforeShow: (event) => {
                const row = event.row as GridRow<T> | undefined;
                if (!row?.__original || (event.type !== "row" && event.type !== "cell")) {
                  return [];
                }
                return [
                  {
                    id: "view-detail",
                    label: "Ver detalle",
                    onClick: () => onContextView?.(row.__original),
                  },
                  {
                    id: "delete-row",
                    label: "Eliminar fila",
                    danger: true,
                    onClick: () => onContextDelete?.(row.__original),
                  },
                ];
              },
            }}
            onCellEdit={async (rowIndex, field, value) => {
              const targetRow = gridRows[rowIndex] as GridRow<T> | undefined;
              if (!targetRow) {
                return;
              }

              setGridRows((prev) => {
                const updated = [...prev];
                const row = updated[rowIndex];
                if (!row) return prev;

                const nextOriginal = {
                  ...asRecord(row.__original),
                  [field]: value,
                } as T;

                updated[rowIndex] = {
                  ...row,
                  [field]: value,
                  __original: nextOriginal,
                };

                return updated;
              });

              if (onEditSave) {
                await onEditSave(targetRow.__original, { [field]: value });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
