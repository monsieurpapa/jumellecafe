import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L, { type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchParcelles, type ParcelleWithProducteur } from "../lib/api.js";
import { DetailPanel, ErrorBanner, EmptyState, PageHeader, Skeleton } from "@jumelle/ui";

// Free, no-API-key satellite basemap — Esri World Imagery.
const TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTRIBUTION = "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics";

// Roughly centers on Sud-Kivu, DRC — used only until real parcelles fit-bound.
const DEFAULT_CENTER: [number, number] = [-2.5, 28.85];
const DEFAULT_ZOOM = 8;

function markerIcon(selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="parcelle-marker${selected ? " parcelle-marker--selected" : ""}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function FitToParcelles({ parcelles }: { parcelles: ParcelleWithProducteur[] }) {
  const map = useMap();
  useEffect(() => {
    if (parcelles.length === 0) return;
    const bounds: LatLngBoundsExpression = parcelles.map((p) => [p.parcelle.latitude, p.parcelle.longitude]);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, [parcelles, map]);
  return null;
}

export default function ParcellesMap() {
  const [parcelles, setParcelles] = useState<ParcelleWithProducteur[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchParcelles()
      .then(setParcelles)
      .catch(setError);
  }, []);

  const selected = useMemo(
    () => parcelles?.find((p) => p.parcelle.id === selectedId) ?? null,
    [parcelles, selectedId],
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Parcelles GPS"
        subtitle={parcelles ? `${parcelles.length} parcelle(s) géolocalisée(s)` : undefined}
      />
      <ErrorBanner error={error} />

      {!parcelles && <Skeleton className="h-[70vh] w-full" />}

      {parcelles && parcelles.length === 0 && (
        <EmptyState
          icon="parcelle"
          message="Aucune parcelle géolocalisée pour le moment"
          description="Les agronomes capturent la position GPS lors de l'enregistrement d'un producteur, depuis l'application terrain."
        />
      )}

      {parcelles && parcelles.length > 0 && (
        <div className="h-[70vh] rounded-lg overflow-hidden border border-stone-200 shadow-sm bg-stone-900">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <FitToParcelles parcelles={parcelles} />
            {parcelles.map(({ parcelle, producteur }) => (
              <Marker
                key={parcelle.id}
                position={[parcelle.latitude, parcelle.longitude]}
                icon={markerIcon(parcelle.id === selectedId)}
                eventHandlers={{ click: () => setSelectedId(parcelle.id) }}
                alt={`${producteur.nom} ${producteur.prenom}`}
              />
            ))}
          </MapContainer>
        </div>
      )}

      {selected && (
        <DetailPanel
          title={
            <>
              {selected.producteur.nom} {selected.producteur.prenom} —{" "}
              <span className="font-mono text-sm">{selected.producteur.producerCode}</span>
            </>
          }
          onClose={() => setSelectedId(null)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 max-w-2xl text-sm">
            <span>Culture : {selected.producteur.culturePrincipale === "cafe" ? "Café" : "Cacao"}</span>
            <span>Village : {selected.producteur.village}</span>
            <span>
              Coordonnées : {selected.parcelle.latitude.toFixed(6)}, {selected.parcelle.longitude.toFixed(6)}
            </span>
            <span>Altitude : {selected.parcelle.altitudeM != null ? `${selected.parcelle.altitudeM} m` : "—"}</span>
            <span>
              Superficie : {selected.parcelle.superficieHa != null ? `${selected.parcelle.superficieHa} ha` : "—"}
            </span>
            <span>Statut ICS : {selected.producteur.statutIcs}</span>
          </div>
        </DetailPanel>
      )}
    </div>
  );
}
