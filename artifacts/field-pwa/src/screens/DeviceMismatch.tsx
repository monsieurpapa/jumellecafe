export default function DeviceMismatch() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold mb-2">Cet appareil n'est pas autorisé</h2>
        <p className="text-neutral-500">
          Votre compte est déjà lié à un autre appareil. Contactez votre administrateur de coopérative pour
          transférer l'accès vers cet appareil.
        </p>
      </div>
    </div>
  );
}
