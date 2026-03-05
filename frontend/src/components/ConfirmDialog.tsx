import { createContext, useCallback, useContext, useRef, useState } from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // Prevent stale closure issues when confirm is called rapidly
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setDialog({ ...opts, resolve });
    });
  }, []);

  function answer(value: boolean) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setDialog(null);
  }

  const isDanger = dialog?.danger !== false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-xl bg-white border border-gray-200 shadow-2xl p-6 animate-[fadeIn_150ms_ease-out]"
            style={{ fontFamily: "Consolas, monospace" }}
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                <WarningAmberIcon className="text-amber-500" style={{ fontSize: 20 }} />
              </div>
              <div className="pt-0.5">
                {dialog.title && (
                  <p className="font-semibold text-gray-900 text-sm mb-1">{dialog.title}</p>
                )}
                <p className="text-sm text-gray-600 leading-relaxed">{dialog.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => answer(false)}
                className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {dialog.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => answer(true)}
                className={`px-4 py-1.5 text-sm rounded-lg text-white font-medium transition-colors ${
                  isDanger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#610000] hover:bg-[#4a0000]"
                }`}
              >
                {dialog.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
