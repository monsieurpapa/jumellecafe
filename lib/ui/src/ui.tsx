import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export const formInputClass = "border rounded px-2 py-1 text-sm w-full";

export function Button({
  size = "sm",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "md" }) {
  const padding = size === "md" ? "px-4 py-1.5" : "px-3 py-1.5";
  return (
    <button
      className={`bg-emerald-700 text-white text-sm ${padding} rounded disabled:opacity-50 ${className}`}
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
    <p className="text-red-600 mb-3" role="alert" aria-live="polite">
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
    <p className="text-emerald-700 mb-3" role="status" aria-live="polite">
      {message}
    </p>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-neutral-500">{message}</p>;
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
  className = "text-neutral-600 underline",
  confirmClassName = "text-red-600 underline",
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

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button className={`${confirmClassName} disabled:opacity-50`} disabled={pending} onClick={handleConfirm}>
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button className="text-neutral-500 underline" onClick={() => setConfirming(false)}>
          {cancelLabel}
        </button>
      </span>
    );
  }

  return (
    <button className={`${className} disabled:opacity-50`} disabled={disabled} onClick={askConfirm}>
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
    <div className="border rounded p-4 mt-6 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        <button className="text-neutral-500" onClick={onClose}>
          ✕ Fermer
        </button>
      </div>
      {subtitle && <p className="text-sm text-neutral-600 mb-3">{subtitle}</p>}
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
    <input
      type="search"
      className={`${formInputClass} max-w-xs ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
