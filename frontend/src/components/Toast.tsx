import { createContext, useCallback, useContext, useEffect, useState } from "react";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type ToastFn = (type: ToastType, message: string) => void;

const ToastContext = createContext<ToastFn>(() => {});

let _counter = 0;

const TYPE_CONFIG = {
  success: {
    Icon: CheckCircleOutlineIcon,
    bg: "bg-green-50 border-green-200",
    text: "text-green-800",
    icon: "text-green-500",
    duration: 3500,
  },
  error: {
    Icon: ErrorOutlineIcon,
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
    icon: "text-red-500",
    duration: 6000,
  },
  warning: {
    Icon: WarningAmberIcon,
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    icon: "text-amber-500",
    duration: 5000,
  },
  info: {
    Icon: InfoOutlinedIcon,
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    icon: "text-blue-500",
    duration: 3500,
  },
};

function SingleToast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const { Icon, bg, text, icon } = TYPE_CONFIG[item.type];

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-sm
        px-4 py-3 rounded-xl border shadow-lg
        transition-all duration-300 ease-out
        ${bg}
        ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"}
      `}
      style={{ fontFamily: "Consolas, monospace" }}
    >
      <Icon className={`flex-shrink-0 mt-0.5 ${icon}`} style={{ fontSize: 18 }} />
      <p className={`flex-1 text-sm leading-snug ${text}`}>{item.message}</p>
      <button
        onClick={onClose}
        className={`flex-shrink-0 ${text} opacity-50 hover:opacity-100 transition-opacity`}
        aria-label="Cerrar"
      >
        <CloseIcon style={{ fontSize: 15 }} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++_counter;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => remove(id), TYPE_CONFIG[type].duration);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <SingleToast key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
