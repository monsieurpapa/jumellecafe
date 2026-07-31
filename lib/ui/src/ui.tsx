import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export const formInputClass =
  "border border-stone-300 rounded-md px-2.5 py-1.5 text-sm w-full transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 focus:border-emerald-600";

export function Button({
  size = "sm",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "md" }) {
  const padding = size === "md" ? "px-5 py-2.5" : "px-3 py-1.5";
  return (
    <button
      className={`bg-emerald-700 text-white text-sm ${padding} rounded-md disabled:opacity-50 transition-colors hover:enabled:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${className}`}
      {...props}
    />
  );
}

/**
 * Structural check for the ApiError shape (`status`/`body`) instead of an
 * `instanceof` check — web-admin and field-pwa each define their own
 * ApiError class in their local lib/api.ts, and this package (shared by
 * both) can't depend on either without a circular reference.
 */
function isApiErrorLike(error: unknown): error is { status: number; body: unknown; message: string } {
  return typeof error === "object" && error !== null && "status" in error && "body" in error;
}

/**
 * Surfaces the server's zod field-level validation details when present,
 * instead of a generic message. `messages` optionally translates known
 * `{ error: "..." }` codes/strings to friendlier French copy.
 */
export function ErrorBanner({ error, messages }: { error: unknown; messages?: Record<string, string> }) {
  if (!error) return null;

  let message: string;
  if (isApiErrorLike(error)) {
    const body = error.body as { error?: string; details?: { fieldErrors?: Record<string, string[]> } } | null;
    const fieldErrors = body?.details?.fieldErrors;
    const fieldMessages = fieldErrors
      ? Object.entries(fieldErrors)
          .filter(([, msgs]) => msgs.length > 0)
          .map(([field, msgs]) => `${field} : ${msgs.join(", ")}`)
      : [];
    const translated = body?.error ? messages?.[body.error] : undefined;
    message = fieldMessages.length > 0 ? fieldMessages.join(" · ") : (translated ?? body?.error ?? error.message);
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }

  return (
    <p className="text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3 text-sm" role="alert" aria-live="polite">
      {message}
    </p>
  );
}

export function SuccessBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <p
      className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-3 text-sm"
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  );
}

/**
 * Empty-state placeholder — icon + message + optional description/action,
 * so an empty screen reads as "here's what to do", not just "nothing here".
 * `description`/`action`/`icon` are optional so existing single-prop call
 * sites keep working unchanged.
 */
export function EmptyState({
  message,
  description,
  action,
  icon = "info",
}: {
  message: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-4 border border-dashed border-stone-300 rounded-lg bg-stone-50">
      <div className="text-stone-400">
        <Icon name={icon} size={28} />
      </div>
      <p className="text-sm font-medium text-stone-600">{message}</p>
      {description && <p className="text-xs text-stone-500 max-w-sm">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * Standard 2-step confirm-then-commit affordance for destructive/meaningful
 * actions (revoke, statut change, etc.). Clicking `label` reveals a
 * confirm/cancel pair that auto-cancels after `timeoutMs` if left idle.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Confirmer ?",
  cancelLabel = "Annuler",
  pendingLabel = "…",
  onConfirm,
  className = "text-stone-600 underline decoration-stone-300 hover:text-stone-900",
  confirmClassName = "text-red-600 underline decoration-red-300 hover:text-red-800",
  timeoutMs = 4000,
  disabled = false,
}: {
  label: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pendingLabel?: string;
  onConfirm: () => Promise<void> | void;
  className?: string;
  confirmClassName?: string;
  timeoutMs?: number;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  function askConfirm() {
    setConfirming(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setConfirming(false), timeoutMs);
  }

  async function handleConfirm() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setConfirming(false);
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  const focusRing =
    "rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1";

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          className={`${confirmClassName} ${focusRing} disabled:opacity-50`}
          disabled={pending}
          onClick={handleConfirm}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button className={`text-stone-500 underline ${focusRing}`} onClick={() => setConfirming(false)}>
          {cancelLabel}
        </button>
      </span>
    );
  }

  return (
    <button className={`${className} ${focusRing} disabled:opacity-50`} disabled={disabled} onClick={askConfirm}>
      {label}
    </button>
  );
}

/** Standard "view details" panel used consistently for row-detail views. */
export function DetailPanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-stone-200 shadow-sm rounded-lg p-4 mt-6 max-w-4xl bg-white">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-stone-900">{title}</h2>
        <button
          className="text-stone-400 hover:text-stone-700 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          onClick={onClose}
          aria-label="Fermer"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      {subtitle && <p className="text-sm text-stone-600 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative max-w-xs ${className}`}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400">
        <Icon name="search" size={15} />
      </span>
      <input
        type="search"
        className={`${formInputClass} pl-8`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Pulse-animated placeholder — shape-matched loading state instead of bare "Chargement…" text. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-stone-200 rounded-md ${className}`} />;
}

/** A block of skeleton rows matching a table's shape, for list-screen loading states. */
export function SkeletonRows({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton matching the Dashboard's stat-tile grid. */
export function SkeletonTiles({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-stone-200 rounded-lg p-3">
          <Skeleton className="h-3 w-2/3 mb-2" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

const BADGE_VARIANTS = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  neutral: "bg-stone-100 text-stone-600",
} as const;

/** Pill-shaped status indicator — replaces ad-hoc colored text for statut/conforme fields. */
export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: keyof typeof BADGE_VARIANTS;
}) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_VARIANTS[variant]}`}>
      {children}
    </span>
  );
}

/** Standard screen header — title + optional subtitle + optional right-aligned primary action. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="text-stone-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const ICON_PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  producteur: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </>
  ),
  parcelle: (
    <>
      <path d="M12 21s-7-6.2-7-11.2a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </>
  ),
  station: <path d="M12 3s6 6.5 6 10.5a6 6 0 1 1-12 0C6 9.5 12 3 12 3Z" />,
  livraison: (
    <>
      <rect x="3" y="7" width="12" height="10" rx="1" />
      <path d="M15 10h3.5l2.5 3v4h-6" />
      <circle cx="7" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </>
  ),
  lot: (
    <>
      <path d="M11 3 3 11l9 9 9-9-9-8Z" />
      <circle cx="8.3" cy="7.3" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  inspection: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6v2H9z" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  finance: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 15.2c.4.9 1.3 1.4 2.5 1.4 1.6 0 2.7-.8 2.7-2s-1-1.7-2.7-2c-1.7-.3-2.7-.8-2.7-2s1.1-2 2.7-2c1.2 0 2.1.5 2.5 1.4" />
      <path d="M12 6.5v11" />
    </>
  ),
  appareil: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </>
  ),
  cooperative: (
    <>
      <circle cx="8.5" cy="9" r="2.8" />
      <circle cx="16" cy="9.5" r="2.3" />
      <path d="M3.5 19c0-3 2.3-5 5-5s5 2 5 5" />
      <path d="M13.8 14.3c2.3.2 4.2 2 4.2 4.7" />
    </>
  ),
  edit: <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />,
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  close: (
    <>
      <path d="m5 5 14 14" />
      <path d="m19 5-14 14" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.7" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Small hand-authored inline-SVG icon set — no icon-font/CDN dependency, so it works fully offline in field-pwa. */
export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
