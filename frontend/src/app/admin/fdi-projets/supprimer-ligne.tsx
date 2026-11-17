"use client";

// Supprimer une ligne fDi — projet ou signal — depuis les tableaux, et la
// rétablir.
//
// DEUX GESTES, PAS UN : « Supprimer », puis la confirmation sur place, dans la
// ligne même — une suppression se décide la ligne sous les yeux, pas dans une
// fenêtre qui la cache. Et juste après, « Rétablir » : la ligne revient telle
// qu'elle était, valeurs rattachées et travail humain compris.
//
// LA SUPPRESSION TIENT. Une ligne du relevé ou d'une capture laisse une trace
// côté serveur (app/services/fdi_suppressions.py) : le réimport la saute, et
// la capture suivante de sa page la montre « Supprimée » — décochée ; cochée,
// elle est rétablie, c'est le moyen d'y revenir passé le « Rétablir » immédiat.

import { useState } from "react";

import { API_BASE } from "@/lib/api";
import { authHeaders } from "@/lib/authHeaders";
import { Avis, btnDanger, btnSecondaire } from "@/components/admin/UIAdmin";

export type Base = "projets" | "signaux";

/** Ce que l'écran garde d'une suppression : de quoi la rétablir, et la dire. */
export type Suppression = { trace: number; quoi: string };

const ROUTE: Record<Base, string> = {
  projets: "fdi/projets",
  signaux: "fdi/signaux-investisseurs",
};

/** Supprime la ligne ; rend l'identifiant de sa trace, qui sert à la rétablir. */
export async function supprimerLigne(base: Base, id: number): Promise<number> {
  const r = await fetch(`${API_BASE}/${ROUTE[base]}/${id}`, {
    method: "DELETE", headers: await authHeaders(),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || "Suppression impossible.");
  return d.trace as number;
}

/** Le bouton d'une ligne. Discret tant que la ligne n'est pas survolée — un
    bouton rouge sur chacune des quinze lignes ferait un tableau d'alarme. */
export function SupprimerLigne({ visible, occupe, onConfirmer }: {
  visible: boolean; occupe: boolean; onConfirmer: () => void;
}) {
  const [confirmer, setConfirmer] = useState(false);
  const petit = { padding: "4px 10px", fontSize: 11.5, height: "auto", borderRadius: 7 };
  if (confirmer) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        onKeyDown={e => { if (e.key === "Escape") setConfirmer(false); }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--danger)" }}>Supprimer la ligne ?</span>
        <button type="button" autoFocus disabled={occupe}
          onClick={() => { setConfirmer(false); onConfirmer(); }}
          style={{ ...btnDanger, ...petit }}>Supprimer</button>
        <button type="button" onClick={() => setConfirmer(false)}
          style={{ ...btnSecondaire, ...petit }}>Annuler</button>
      </span>
    );
  }
  return (
    <button type="button" disabled={occupe} onClick={() => setConfirmer(true)}
      title="Supprimer cette ligne"
      style={{ ...btnSecondaire, ...petit, color: "var(--danger)",
        // Toujours dans le document, seulement rendu visible au survol : le
        // faire apparaître ferait sauter la largeur de la colonne.
        opacity: visible ? 1 : 0, transition: "opacity 0.12s" }}>
      Supprimer
    </button>
  );
}

/** Ce qui vient d'être supprimé, et de quoi le rétablir. */
export function AvisSuppression({ suppression, onRetablie, onErreur }: {
  suppression: Suppression;
  onRetablie: () => void;
  onErreur: (texte: string) => void;
}) {
  const [occupe, setOccupe] = useState(false);
  const retablir = async () => {
    setOccupe(true);
    try {
      const r = await fetch(`${API_BASE}/fdi/lignes-supprimees/${suppression.trace}/retablir`, {
        method: "POST", headers: await authHeaders(),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "Rétablissement impossible.");
      onRetablie();
    } catch (e: unknown) {
      onErreur(e instanceof Error ? e.message : "Rétablissement impossible.");
    } finally { setOccupe(false); }
  };
  return (
    <Avis ton="ok">
      <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ flex: 1, minWidth: 220 }}>
          Ligne supprimée : {suppression.quoi}. Le réimport ne la ramènera pas, et une capture
          la signalera comme supprimée.
        </span>
        <button type="button" onClick={retablir} disabled={occupe}
          style={{ ...btnSecondaire, padding: "5px 12px", fontSize: 12, height: "auto",
            opacity: occupe ? 0.5 : 1 }}>
          Rétablir
        </button>
      </span>
    </Avis>
  );
}
