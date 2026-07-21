import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { Button, formInputClass } from "@jumelle/ui";

interface LoginProps {
  onSignedIn: () => void;
}

export default function Login({ onSignedIn }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onSignedIn();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Jumelle Café — Connexion agronome</h2>
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
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button size="md" type="submit" disabled={submitting}>
          {submitting ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </div>
  );
}
