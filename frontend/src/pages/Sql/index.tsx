import { useMemo, useRef, useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CloseIcon from "@mui/icons-material/Close";
import { executeSql } from "../../api/client";

type SqlTab = {
  id: number;
  title: string;
  sql: string;
  result: any;
};

type StatementRange = {
  start: number;
  end: number;
  text: string;
};

const STORAGE_KEY = "ppm-sql-tabs-v1";
const DEFAULT_SQL = "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;";

function defaultTabsState() {
  return {
    tabs: [{ id: 1, title: "Query 1", sql: DEFAULT_SQL, result: null } as SqlTab],
    activeTabId: 1,
    nextTabId: 2,
  };
}

function loadTabsState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultTabsState();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.tabs) || parsed.tabs.length === 0) return defaultTabsState();
    const tabs = parsed.tabs
      .map((t: any, idx: number) => ({
        id: Number(t?.id) || idx + 1,
        title: String(t?.title || `Query ${idx + 1}`),
        sql: String(t?.sql || ""),
        result: t?.result ?? null,
      }))
      .filter((t: SqlTab) => Number.isFinite(t.id));
    if (tabs.length === 0) return defaultTabsState();
    const activeTabId = tabs.some((t: SqlTab) => t.id === Number(parsed?.activeTabId))
      ? Number(parsed?.activeTabId)
      : tabs[0].id;
    const nextTabId = Math.max(Number(parsed?.nextTabId) || 2, ...tabs.map((t: SqlTab) => t.id + 1));
    return { tabs, activeTabId, nextTabId };
  } catch {
    return defaultTabsState();
  }
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightSql(sql: string) {
  const keywords = [
    "select", "from", "where", "and", "or", "insert", "into", "values", "update",
    "set", "delete", "create", "table", "drop", "alter", "join", "left", "right",
    "inner", "outer", "on", "group", "by", "order", "limit", "offset", "having",
    "as", "distinct", "null", "is", "not", "in", "like", "between", "case", "when",
    "then", "else", "end", "pragma",
  ];

  let html = escapeHtml(sql);
  html = html.replace(/(--.*)$/gm, '<span style="color:#6b7280">$1</span>');
  html = html.replace(/('(?:''|[^'])*')/g, '<span style="color:#22c55e">$1</span>');
  html = html.replace(/\b(\d+(\.\d+)?)\b/g, '<span style="color:#f59e0b">$1</span>');
  const kw = new RegExp(`\\b(${keywords.join("|")})\\b`, "gi");
  html = html.replace(kw, (_m, g1) => `<span style="color:#60a5fa;font-weight:700">${String(g1).toUpperCase()}</span>`);
  return html;
}

function splitSqlStatements(text: string): StatementRange[] {
  const out: StatementRange[] = [];
  let start = 0;
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < text.length) {
    const c = text[i];
    const n = i + 1 < text.length ? text[i + 1] : "";

    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && n === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (!inSingle && !inDouble && c === "-" && n === "-") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (!inSingle && !inDouble && c === "/" && n === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (!inDouble && c === "'") {
      inSingle = !inSingle;
      i += 1;
      continue;
    }
    if (!inSingle && c === "\"") {
      inDouble = !inDouble;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && c === ";") {
      const raw = text.slice(start, i + 1);
      const trimmed = raw.trim();
      if (trimmed) out.push({ start, end: i + 1, text: trimmed });
      start = i + 1;
    }

    i += 1;
  }

  if (start < text.length) {
    const raw = text.slice(start);
    const trimmed = raw.trim();
    if (trimmed) out.push({ start, end: text.length, text: trimmed });
  }
  return out;
}

function statementAtCursor(text: string, cursor: number): string | null {
  const statements = splitSqlStatements(text);
  if (statements.length === 0) return null;
  const found = statements.find((s) => cursor >= s.start && cursor <= s.end);
  if (found) return found.text;
  const next = statements.find((s) => cursor < s.start);
  if (next) return next.text;
  return statements[statements.length - 1].text;
}

export default function SqlPage() {
  const navigate = useNavigate();
  const initial = useMemo(() => loadTabsState(), []);
  const [tabs, setTabs] = useState<SqlTab[]>(initial.tabs);
  const [activeTabId, setActiveTabId] = useState<number>(initial.activeTabId);
  const [nextTabId, setNextTabId] = useState<number>(initial.nextTabId);
  const [editingTabId, setEditingTabId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [selStart, setSelStart] = useState(0);
  const [selEnd, setSelEnd] = useState(0);
  const preRef = useRef<HTMLPreElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const sql = activeTab?.sql ?? "";
  const result = activeTab?.result ?? null;

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tabs, activeTabId, nextTabId }),
    );
  }, [tabs, activeTabId, nextTabId]);

  const runMut = useMutation({
    mutationFn: async ({ statements }: { tabId: number; statements: string[] }) => {
      let lastResult: any = null;
      let totalMs = 0;
      for (const stmt of statements) {
        const res = await executeSql(stmt);
        totalMs += Number(res?.execution_ms ?? 0);
        lastResult = res;
      }
      if (statements.length <= 1) return lastResult;
      return {
        ...(lastResult ?? {}),
        type: "batch",
        ok: true,
        execution_ms: Math.round(totalMs * 100) / 100,
        message: `${statements.length} sentencias ejecutadas correctamente`,
      };
    },
    onSuccess: (res, vars) => {
      setTabs((prev) => prev.map((t) => (t.id === vars.tabId ? { ...t, result: res } : t)));
    },
    onError: (err: any, vars) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === vars.tabId
            ? { ...t, result: { ok: false, error: err?.message || "Error al ejecutar SQL" } }
            : t,
        ),
      );
    },
  });

  const selectedSql = useMemo(() => {
    if (!sql || selEnd <= selStart) return "";
    return sql.slice(selStart, selEnd);
  }, [sql, selStart, selEnd]);
  const selectedStatements = useMemo(
    () => splitSqlStatements(selectedSql).map((s) => s.text),
    [selectedSql],
  );
  const hasMultiSelection = selectedStatements.length > 1;

  const resultColumns: string[] = useMemo(() => result?.columns ?? [], [result]);
  const resultRows: any[] = useMemo(() => result?.rows ?? [], [result]);

  function updateActiveSql(nextSql: string) {
    setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, sql: nextSql } : t)));
  }

  function addTab() {
    const id = nextTabId;
    setTabs((prev) => [...prev, { id, title: `Query ${id}`, sql: "", result: null }]);
    setActiveTabId(id);
    setNextTabId((prev) => prev + 1);
    setSelStart(0);
    setSelEnd(0);
  }

  function closeTab(tabId: number) {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === tabId);
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      const fallback = nextTabs[Math.max(0, idx - 1)] ?? nextTabs[0];
      setActiveTabId(fallback.id);
    }
    if (editingTabId === tabId) {
      setEditingTabId(null);
      setRenameDraft("");
    }
    setSelStart(0);
    setSelEnd(0);
  }

  function startRename(tab: SqlTab) {
    setEditingTabId(tab.id);
    setRenameDraft(tab.title);
  }

  function commitRename() {
    if (editingTabId == null) return;
    const name = renameDraft.trim() || "Query";
    setTabs((prev) => prev.map((t) => (t.id === editingTabId ? { ...t, title: name } : t)));
    setEditingTabId(null);
    setRenameDraft("");
  }

  function runStatements(statements: string[]) {
    if (!activeTab || runMut.isPending) return;
    const clean = statements.map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) return;
    runMut.mutate({ tabId: activeTab.id, statements: clean });
  }

  function runButtonAction() {
    if (selectedStatements.length > 0) {
      runStatements(selectedStatements);
      return;
    }
    runStatements(splitSqlStatements(sql).map((s) => s.text));
  }

  function runCtrlEnter() {
    if (!activeTab) return;
    if (selectedStatements.length > 0) {
      runStatements(selectedStatements);
      return;
    }
    const cursor = textareaRef.current?.selectionStart ?? 0;
    const stmt = statementAtCursor(sql, cursor);
    if (stmt) runStatements([stmt]);
  }

  function syncSelectionFromTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    setSelStart(el.selectionStart ?? 0);
    setSelEnd(el.selectionEnd ?? 0);
  }

  const summary = useMemo(() => {
    if (!result) return "Sin ejecuciones";
    if (!result.ok) return "Error";
    if (result.type === "mutation") return `OK - ${result.message ?? "Sentencia ejecutada correctamente"}`;
    if (result.type === "batch") return `OK - ${result.message ?? "Ejecucion por lote completada"}`;
    return `OK - ${result.row_count ?? 0} filas retornadas`;
  }, [result]);

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
      <button
        onClick={() => navigate("/ppm")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#610000] mb-4 transition-colors"
        style={{ fontFamily: "Consolas, monospace" }}
      >
        <ArrowBackIcon fontSize="small" /> Volver a PPM
      </button>

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#610000]" style={{ fontFamily: "Consolas, monospace" }}>SQL Console</h1>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-gray-300 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#f3f4f6] border-b border-gray-300 px-2 pt-2">
            <div className="flex items-end justify-between gap-2">
              <div className="flex items-end gap-1 overflow-x-auto">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-1 rounded-t-sm border px-3 py-1.5 -mb-[1px] transition-colors ${
                      tab.id === activeTabId
                        ? "bg-white text-[#111827] border-gray-300 border-b-white border-t-[#3b82f6] border-t-2 shadow-[0_-1px_4px_rgba(15,23,42,0.12)]"
                        : "bg-[#e5e7eb] text-[#4b5563] border-[#d1d5db] hover:bg-[#eceff3]"
                    }`}
                  >
                    {editingTabId === tab.id ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") {
                            setEditingTabId(null);
                            setRenameDraft("");
                          }
                        }}
                        className="w-24 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-sm"
                        style={{ fontFamily: "Consolas, monospace" }}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setActiveTabId(tab.id);
                          setSelStart(0);
                          setSelEnd(0);
                        }}
                        onDoubleClick={() => startRename(tab)}
                        className="text-sm whitespace-nowrap"
                        style={{ fontFamily: "Consolas, monospace" }}
                      >
                        {tab.title}
                      </button>
                    )}
                    {tabs.length > 1 && (
                      <button
                        onClick={() => closeTab(tab.id)}
                        className="inline-flex items-center justify-center rounded text-[#9ca3af] hover:text-[#4b5563] hover:bg-[#dbe0e6]"
                        title="Cerrar tab"
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addTab}
                  className="px-3 py-1.5 rounded-t-sm text-sm border border-[#d1d5db] bg-[#e5e7eb] text-[#4b5563] hover:bg-[#eceff3] whitespace-nowrap"
                  style={{ fontFamily: "Consolas, monospace" }}
                >
                  + Nueva pestana
                </button>
              </div>
              <button
                onClick={runButtonAction}
                disabled={runMut.isPending || !sql.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-1 rounded bg-[#16a34a] text-white text-sm hover:bg-[#15803d] disabled:opacity-60 whitespace-nowrap"
                style={{ fontFamily: "Consolas, monospace" }}
              >
                <PlayArrowIcon fontSize="small" />
                {runMut.isPending ? "Ejecutando..." : hasMultiSelection ? "Ejecutar seleccion" : "Ejecutar"}
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="relative rounded-lg border border-gray-300 bg-[#f8fafc] overflow-hidden">
            <pre
              ref={preRef}
              className="m-0 p-3 min-h-[220px] max-h-[420px] overflow-auto text-sm leading-6 pointer-events-none whitespace-pre-wrap break-words"
              style={{ fontFamily: "Consolas, monospace" }}
              dangerouslySetInnerHTML={{ __html: `${highlightSql(sql)}\n` }}
            />
            <textarea
              ref={textareaRef}
              value={sql}
              onChange={(e) => updateActiveSql(e.target.value)}
              onSelect={syncSelectionFromTextarea}
              onKeyUp={syncSelectionFromTextarea}
              onMouseUp={syncSelectionFromTextarea}
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === "Enter") {
                  e.preventDefault();
                  runCtrlEnter();
                }
              }}
              onScroll={(e) => {
                if (preRef.current) {
                  preRef.current.scrollTop = e.currentTarget.scrollTop;
                  preRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }
              }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              className="absolute inset-0 w-full h-full p-3 bg-transparent text-transparent caret-gray-900 resize-none outline-none text-sm leading-6"
              style={{ fontFamily: "Consolas, monospace" }}
            />
          </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <h2 className="text-sm font-semibold text-[#610000] mb-2" style={{ fontFamily: "Consolas, monospace" }}>Resultado</h2>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-3" style={{ fontFamily: "Consolas, monospace" }}>
            <div className="text-sm font-semibold text-gray-700">{summary}</div>
            {result?.execution_ms !== undefined && (
              <div className="text-xs text-gray-500 mt-1">Tiempo: {result.execution_ms} ms</div>
            )}
            {result?.ok === false && (
              <div className="text-sm text-red-600 mt-2">{result.error}</div>
            )}
          </div>

          {resultColumns.length > 0 ? (
            <div className="overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm" style={{ fontFamily: "Consolas, monospace" }}>
                <thead className="bg-gray-100">
                  <tr>
                    {resultColumns.map((c) => (
                      <th key={c} className="text-left px-3 py-2 border-b border-gray-200 font-bold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultRows.map((row, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      {resultColumns.map((c) => (
                        <td key={`${i}-${c}`} className="px-3 py-1.5 border-b border-gray-100 align-top">
                          {row[c] === null || row[c] === undefined ? <span className="text-gray-400">NULL</span> : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
