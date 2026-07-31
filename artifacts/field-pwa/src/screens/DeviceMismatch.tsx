import { Icon } from "@jumelle/ui";

export default function DeviceMismatch() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-stone-50">
      <div className="max-w-sm text-center flex flex-col items-center gap-3">
        <div className="text-amber-500">
          <Icon name="appareil" size={32} />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-stone-900">Cet appareil n'est pas autorisé</h2>
        <p className="text-stone-500 text-sm">
          Votre compte est déjà lié à un autre appareil. Contactez votre administrateur de coopérative pour
          transférer l'accès vers cet appareil.
        </p>
      </div>
    </div>
  );
}
