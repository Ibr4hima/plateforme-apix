"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
// Métadonnées complètes (/max) : contrairement au bundle par défaut (« min »)
// qui ne vérifie que les longueurs plausibles, /max valide aussi les motifs de
// préfixes par opérateur — indispensable pour rejeter p.ex. un mobile sénégalais
// commençant par 80 ou un numéro trop long accepté à tort.
import { parsePhoneNumberWithError, isValidPhoneNumber, validatePhoneNumberLength, AsYouType, CountryCode, getExampleNumber } from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Indicatifs depuis libphonenumber-js (on importe getCountryCallingCode)
function getIndicatif(iso2: string): string {
  try {
    const { getCountryCallingCode } = require("libphonenumber-js/max");
    return `+${getCountryCallingCode(iso2 as CountryCode)}`;
  } catch { return "+"; }
}

interface Pays { id: number; code_iso2: string; code_iso3?: string; nom_fr: string; }

// ── Helpers partagés : un contact ne peut être ajouté que si le précédent est complet ──
// Un numéro stocké est complet s'il est valide en E.164 (PhoneInput ne produit
// l'E.164 que pour un numéro valide ; sinon la valeur brute échoue ici).
export function isPhoneComplete(v: string): boolean {
  try { return !!v && isValidPhoneNumber(v); } catch { return false; }
}
// Validation email pragmatique alignée sur RFC 5322 / normes des registres :
// partie locale ≤ 64 car., sans point en bord ni points consécutifs ; domaine en
// labels alphanumériques (tirets internes seulement) ; TLD alphabétique ≥ 2 lettres
// (rejette « cash », « x@y », « a@b. », « a@b.12 », « a..b@c.sn », etc.)
export function isEmailComplete(v: string): boolean {
  const s = (v || "").trim();
  if (!s || s.length > 254) return false;
  const at = s.lastIndexOf("@");
  if (at <= 0 || at === s.length - 1) return false;
  const local = s.slice(0, at);
  if (local.length > 64) return false;
  return /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(s);
}
// Normalisations pour la détection de doublons (comparaison insensible au format)
export const normPhone = (v: string) => (v || "").replace(/\D/g, "");
export const normEmail = (v: string) => (v || "").trim().toLowerCase();

// Valeurs en double dans une liste (les entrées vides sont ignorées)
export function doublonsDans(values: string[], norm: (v: string) => string): string[] {
  const seen = new Set<string>(); const dups: string[] = [];
  for (const v of values) {
    const n = norm(v); if (!n) continue;
    if (seen.has(n)) dups.push(v); else seen.add(n);
  }
  return dups;
}

// Une liste de contacts autorise un nouvel ajout : toutes les entrées valides ET uniques
export function listePreteAjout(values: string[], check: (v: string) => boolean, norm: (v: string) => string): boolean {
  return values.every(check) && doublonsDans(values, norm).length === 0;
}

// Téléphones / emails partagés entre plusieurs contacts (points focaux, porteurs…)
// — détecte aussi les doublons internes à un même contact.
export function contactsPartages(contacts: { telephones?: string[]; mails?: string[] }[]): string[] {
  const tels  = contacts.flatMap(c => (c.telephones || []).filter(Boolean));
  const mails = contacts.flatMap(c => (c.mails || []).filter(Boolean));
  return [...doublonsDans(tels, normPhone), ...doublonsDans(mails, normEmail)];
}

// Un contact structuré (point focal, porteur de projet…) est complet quand ses
// champs texte requis sont remplis et qu'il a au moins un téléphone et un email,
// tous valides et sans doublon interne. Sert à verrouiller l'ajout d'un contact suivant.
export function isContactComplete(obj: any, champsRequis: string[] = []): boolean {
  if (champsRequis.some(c => !String(obj?.[c] ?? "").trim())) return false;
  const tels  = (obj?.telephones || []).filter((t: string) => (t || "").trim());
  const mails = (obj?.mails || []).filter((m: string) => (m || "").trim());
  return tels.length > 0 && tels.every(isPhoneComplete) && doublonsDans(tels, normPhone).length === 0
      && mails.length > 0 && mails.every(isEmailComplete) && doublonsDans(mails, normEmail).length === 0;
}

interface Props {
  value:        string;
  onChange:     (val: string) => void;  // toujours en format E.164 : +XXXXXXXXXXX
  placeholder?: string;
}

export default function PhoneInput({ value, onChange, placeholder = "Numéro" }: Props) {
  const [pays,    setPays]    = useState<Pays[]>([]);
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState("");
  const [iso2,    setIso2]    = useState<string>("");
  const [display, setDisplay] = useState("");
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [numType, setNumType] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  // Charger les pays — les entrées sans code ISO2 (pseudo-pays créés par les
  // imports IDE, ex. « Multi-National ») n'ont pas d'indicatif téléphonique
  useEffect(() => {
    fetch(`${API_BASE}/ref-pays`).then(r => r.json())
      .then((d: Pays[]) => setPays((d || []).filter(p => p.code_iso2)))
      .catch(() => {});
  }, []);

  // Parser valeur initiale (E.164)
  useEffect(() => {
    if (!value) return;
    try {
      const parsed = parsePhoneNumberWithError(value);
      if (parsed?.country) {
        setIso2(parsed.country);
        setDisplay(parsed.formatNational());
      }
    } catch {
      setDisplay(value.replace(/^\+\d+\s?/, ""));
    }
  }, []);

  // Réinitialiser quand la valeur devient vide (ex: réouverture d'un formulaire vierge)
  useEffect(() => {
    if (!value) { setIso2(""); setDisplay(""); setTouched(false); setNumType(""); }
  }, [value]);

  // Fermer dropdown au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const indicatif = iso2 ? getIndicatif(iso2) : "";

  const TYPE_LABELS: Record<string, string> = {
    MOBILE: "Mobile", FIXED_LINE: "Fixe", FIXED_LINE_OR_MOBILE: "Mobile / Fixe",
    TOLL_FREE: "Numéro vert", VOIP: "VoIP", PREMIUM_RATE: "Surtaxé",
  };
  const typeLabel = (t?: string) => (t && TYPE_LABELS[t]) || "";

  // Valide en forme nationale (gère le 0 initial : « 06 12 … » en France, etc.)
  // et remonte l'E.164 canonique au parent quand le numéro est valide.
  const propagate = (raw: string, country: string) => {
    if (!raw) { onChange(""); setNumType(""); return; }
    try {
      if (isValidPhoneNumber(raw, country as CountryCode)) {
        const parsed = parsePhoneNumberWithError(raw, country as CountryCode);
        onChange(parsed.format("E.164"));
        setNumType(typeLabel(parsed.getType()));
        return;
      }
    } catch { /* tombe sur le brut ci-dessous */ }
    onChange(`${getIndicatif(country)}${raw}`);
    setNumType("");
  };

  const handleSelectPays = (p: Pays) => {
    setIso2(p.code_iso2);
    setOpen(false); setSearch("");
    // Reformater le numéro existant avec le nouveau pays
    if (display) {
      const raw = display.replace(/\D/g, "");
      setDisplay(new AsYouType(p.code_iso2 as CountryCode).input(raw));
      propagate(raw, p.code_iso2);
    } else {
      onChange("");
    }
  };

  const handleNumberChange = (val: string) => {
    setTouched(true);
    if (!iso2) { setDisplay(val); onChange(val); setNumType(""); return; }

    // Collage d'un numéro international complet : bascule automatiquement le pays
    if (val.trim().startsWith("+")) {
      try {
        const parsed = parsePhoneNumberWithError(val.trim());
        if (parsed?.country) {
          setIso2(parsed.country);
          setDisplay(parsed.formatNational());
          onChange(parsed.format("E.164"));
          setNumType(parsed.isValid() ? typeLabel(parsed.getType()) : "");
          return;
        }
      } catch { /* on retombe sur la saisie nationale */ }
    }

    // Seuls les chiffres comptent : lettres et symboles sont ignorés
    const raw = val.replace(/\D/g, "");
    const prevRaw = display.replace(/\D/g, "");

    // Longueur maximale du pays atteinte : la saisie de chiffres est bloquée
    if (raw.length > prevRaw.length) {
      try {
        if (validatePhoneNumberLength(raw, iso2 as CountryCode) === "TOO_LONG") return;
      } catch { /* ignore */ }
    }

    setDisplay(raw ? new AsYouType(iso2 as CountryCode).input(raw) : "");
    propagate(raw, iso2);
  };

  // Validation en forme nationale (cohérente avec la saisie)
  const isValid: boolean | null = !touched || !display ? null : (() => {
    if (!iso2) return display.length >= 6;
    try {
      const raw = display.replace(/\D/g, "");
      return raw.length > 0 && isValidPhoneNumber(raw, iso2 as CountryCode);
    } catch { return false; }
  })();

  // Message d'erreur précis : longueur d'abord, sinon préfixe/format
  const invalidMsg: string = (() => {
    if (isValid !== false || !iso2) return `Numéro invalide pour ${selectedPaysNom() || "ce pays"}`;
    try {
      const raw = display.replace(/\D/g, "");
      const lenIssue = validatePhoneNumberLength(raw, iso2 as CountryCode);
      if (lenIssue === "TOO_SHORT" || lenIssue === "NOT_A_NUMBER") return "Numéro trop court";
      if (lenIssue === "TOO_LONG") return "Numéro trop long";
      return `Numéro invalide pour ${selectedPaysNom() || "ce pays"} — vérifiez le début du numéro`;
    } catch { return `Numéro invalide pour ${selectedPaysNom() || "ce pays"}`; }
  })();
  function selectedPaysNom() { return pays.find(p => p.code_iso2 === iso2)?.nom_fr; }

  const filtered = pays.filter(p =>
    (p.nom_fr || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.code_iso2 || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectedPays = pays.find(p => p.code_iso2 === iso2);

  const IS: React.CSSProperties = {
    background: "#fff", border: "1px solid #E4E1DE", borderRadius: 10,
    padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none",
    fontFamily: "var(--font-google-sans)", width: "100%", boxSizing: "border-box",
  };

  // Bordure et halo du bloc unique selon l'état
  const borderColor = isValid === false ? "#dc2626" : isValid === true ? "#188038" : (open || focused) ? "rgba(0,79,145,0.45)" : "#E4E1DE";
  const halo = (open || focused)
    ? (isValid === false ? "0 0 0 3px rgba(220,38,38,0.08)" : isValid === true ? "0 0 0 3px rgba(24,128,56,0.08)" : "0 0 0 3px rgba(0,79,145,0.10)")
    : "none";

  // Largeur du champ calée sur l'exemple national du pays (le bloc s'ajuste au numéro attendu)
  const exempleNational = (() => {
    if (!iso2) return "";
    try { const ex = getExampleNumber(iso2 as CountryCode, examples); return ex ? ex.formatNational() : ""; } catch { return ""; }
  })();
  const inputCh = Math.max(exempleNational.length || 14, 10);

  return (
    <div style={{ maxWidth:"100%" }}>
      <div ref={ref} style={{ position:"relative", width:"fit-content", maxWidth:"100%" }}>

        {/* ── Bloc unique : pays (ISO3) · indicatif · numéro ── */}
        <div style={{ display:"flex", alignItems:"center", height:42, background:"#fff",
          border:`1px solid ${borderColor}`, borderRadius:10, overflow:"hidden",
          boxShadow:halo, transition:"border-color 0.18s, box-shadow 0.18s" }}>

          {/* Segment pays */}
          <button type="button" onClick={() => setOpen(o => !o)} title={selectedPays?.nom_fr || "Choisir le pays"}
            style={{ display:"flex", alignItems:"center", gap:7, height:"100%", border:"none", cursor:"pointer",
              padding: iso2 ? "0 11px" : "0 14px", fontFamily:"var(--font-google-sans)",
              background: iso2 ? "rgba(0,79,145,0.07)" : "transparent",
              borderRight: iso2 ? "1px solid rgba(0,79,145,0.15)" : "none",
              flexShrink:0, transition:"background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = iso2 ? "rgba(0,79,145,0.12)" : "#F8F7F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = iso2 ? "rgba(0,79,145,0.07)" : "transparent"; }}>
            {iso2 ? (
              <span style={{ fontSize:12.5, fontWeight:800, color:"#004f91", letterSpacing:"0.05em" }}>
                {selectedPays?.code_iso3 || iso2}
              </span>
            ) : (
              <span style={{ fontSize:13, color:"#9aa5b4" }}>Sélectionner un pays</span>
            )}
            <ChevronDown size={12} style={{ color: iso2 ? "#004f91" : "#9aa5b4",
              transform:`rotate(${open?180:0}deg)`, transition:"transform 0.2s", flexShrink:0 }} />
          </button>

          {/* Indicatif */}
          {iso2 && indicatif !== "+" && (
            <span style={{ paddingLeft:11, fontSize:13, fontWeight:700, color:"#004f91", whiteSpace:"nowrap", flexShrink:0 }}>
              {indicatif}
            </span>
          )}

          {/* Champ numéro, dimensionné sur le format du pays */}
          {iso2 && (
            <input value={display} onChange={e => handleNumberChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => { setFocused(false); setTouched(true); }}
              placeholder={exempleNational || placeholder}
              style={{ width:`${inputCh + 2}ch`, minWidth:110, background:"transparent", border:"none", outline:"none",
                padding:"0 10px 0 8px", fontSize:13, color:"#1a1a2e",
                fontFamily:"var(--font-google-sans)", height:"100%" }} />
          )}
          {iso2 && isValid === true  && <span style={{ paddingRight:11, color:"#188038", fontSize:15, lineHeight:1 }}>✓</span>}
          {iso2 && isValid === false && <span style={{ paddingRight:11, color:"#dc2626", fontSize:15, lineHeight:1 }}>✗</span>}
        </div>

        {open && (
          <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, width:280, zIndex:500,
            background:"#fff", border:"1px solid #E4E1DE", borderRadius:12,
            boxShadow:"0 12px 40px rgba(0,30,60,0.16)", maxHeight:280, display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"8px 10px", borderBottom:"1px solid #F2F0EF", flexShrink:0 }}>
              <div style={{ position:"relative" }}>
                <Search size={12} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"#9aa5b4" }} />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{ ...IS, paddingLeft:28, fontSize:12 }} />
              </div>
            </div>
            <div style={{ overflowY:"auto", flex:1 }}>
              {filtered.map(p => {
                const ind = getIndicatif(p.code_iso2);
                return (
                  <div key={p.id} onMouseDown={e => { e.preventDefault(); handleSelectPays(p); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                      cursor:"pointer", fontSize:13,
                      background: p.code_iso2===iso2 ? "rgba(0,79,145,0.06)" : "transparent",
                      color: p.code_iso2===iso2 ? "#004f91" : "#1a1a2e",
                      fontWeight: p.code_iso2===iso2 ? 600 : 400 }}
                    onMouseEnter={e => { if(p.code_iso2!==iso2) e.currentTarget.style.background="#F8F7F6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = p.code_iso2===iso2?"rgba(0,79,145,0.06)":"transparent"; }}>
                    <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.nom_fr}</span>
                    {ind !== "+" && <span style={{ fontSize:11, fontWeight:600, color:"#9aa5b4", flexShrink:0 }}>{ind}</span>}
                  </div>
                );
              })}
              {filtered.length === 0 && <p style={{ padding:"12px", fontSize:13, color:"#9aa5b4", textAlign:"center" }}>Aucun résultat</p>}
            </div>
          </div>
        )}
      </div>

      {/* Messages sous le bloc */}
      {isValid === true && numType && (
        <p style={{ fontSize:11, color:"#188038", marginTop:3 }}>{numType}</p>
      )}
      {isValid === false && (
        <p style={{ fontSize:11, color:"#dc2626", marginTop:3 }}>
          {invalidMsg}
        </p>
      )}
    </div>
  );
}
