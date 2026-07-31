import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { Button, ErrorBanner, formInputClass } from "@jumelle/ui";

interface LoginProps {
  onSignedIn: () => void;
}

export default function Login({ onSignedIn }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    onSignedIn();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3 bg-white border border-stone-200 shadow-sm rounded-lg p-6">
        <h2 className="text-lg font-semibold tracking-tight text-stone-900 mb-1">Jumelle Café — Administration</h2>
        <input
          className={formInputClass}
          type="email"
          placeholder="Adresse e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={formInputClass}
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <ErrorBanner error={error} />
        <Button size="md" type="submit" disabled={submitting}>
          {submitting ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </div>
  );
}
