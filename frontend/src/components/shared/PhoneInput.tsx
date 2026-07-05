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

interface Pays { id: number; code_iso2: string; nom_fr: string; }

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
  const [numType, setNumType] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  // Charger les pays
  useEffect(() => {
    fetch(`${API_BASE}/ref-pays`).then(r => r.json()).then(setPays).catch(() => {});
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

  const handleSelectPays = (p: Pays) => {
    setIso2(p.code_iso2);
    setOpen(false); setSearch("");
    // Reformater le numéro existant avec le nouveau pays
    if (display) {
      try {
        const formatter = new AsYouType(p.code_iso2 as CountryCode);
        const ind = getIndicatif(p.code_iso2);
        const raw = display.replace(/\D/g, "");
        const formatted = formatter.input(raw);
        setDisplay(formatted);
        const full = `${ind}${raw}`;
        try {
          if (isValidPhoneNumber(full, p.code_iso2 as CountryCode)) {
            const parsed = parsePhoneNumberWithError(full, p.code_iso2 as CountryCode);
            onChange(parsed.format("E.164"));
          } else {
            onChange(full);
          }
        } catch { onChange(full); }
      } catch { /* ignore */ }
    } else {
      onChange("");
    }
  };

  const handleNumberChange = (val: string) => {
    setTouched(true);
    if (iso2) {
      const formatter = new AsYouType(iso2 as CountryCode);
      const formatted = formatter.input(val);
      setDisplay(formatted);
      const raw = val.replace(/\D/g, "");
      const full = `${indicatif}${raw}`;
      try {
        if (isValidPhoneNumber(full, iso2 as CountryCode)) {
          const parsed = parsePhoneNumberWithError(full, iso2 as CountryCode);
          onChange(parsed.format("E.164"));
          // Détecter le type
          const type = parsed.getType();
          const typeLabels: Record<string, string> = {
            MOBILE: "Mobile", FIXED_LINE: "Fixe", FIXED_LINE_OR_MOBILE: "Mobile / Fixe",
            TOLL_FREE: "Numéro vert", VOIP: "VoIP", PREMIUM_RATE: "Surtaxé",
          };
          setNumType(typeLabels[type as string] || "");
        } else {
          onChange(full);
          setNumType("");
        }
      } catch { onChange(full); setNumType(""); }
    } else {
      setDisplay(val);
      onChange(val);
      setNumType("");
    }
  };

  // Exemple de numéro pour le placeholder
  const examplePlaceholder = (() => {
    if (!iso2) return placeholder;
    try {
      const ex = getExampleNumber(iso2 as CountryCode, examples);
      return ex ? `ex: ${ex.formatNational()}` : placeholder;
    } catch { return placeholder; }
  })();

  // Validation
  const isValid: boolean | null = !touched || !display ? null : (() => {
    if (!iso2) return display.length >= 6;
    try {
      const raw = display.replace(/\D/g, "");
      return isValidPhoneNumber(`${indicatif}${raw}`, iso2 as CountryCode);
    } catch { return false; }
  })();

  // Message d'erreur précis : longueur d'abord, sinon préfixe/format
  const invalidMsg: string = (() => {
    if (isValid !== false || !iso2) return `Numéro invalide pour ${selectedPaysNom() || "ce pays"}`;
    try {
      const raw = display.replace(/\D/g, "");
      const lenIssue = validatePhoneNumberLength(`${indicatif}${raw}`, iso2 as CountryCode);
      if (lenIssue === "TOO_SHORT" || lenIssue === "NOT_A_NUMBER") return "Numéro trop court";
      if (lenIssue === "TOO_LONG") return "Numéro trop long";
      return `Numéro invalide pour ${selectedPaysNom() || "ce pays"} — vérifiez le début du numéro`;
    } catch { return `Numéro invalide pour ${selectedPaysNom() || "ce pays"}`; }
  })();
  function selectedPaysNom() { return pays.find(p => p.code_iso2 === iso2)?.nom_fr; }

  const filtered = pays.filter(p =>
    p.nom_fr.toLowerCase().includes(search.toLowerCase()) ||
    p.code_iso2.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPays = pays.find(p => p.code_iso2 === iso2);

  const IS: React.CSSProperties = {
    background: "#fff", border: "1px solid #E4E1DE", borderRadius: 10,
    padding: "9px 12px", fontSize: 13, color: "#1a1a2e", outline: "none",
    fontFamily: "var(--font-google-sans)", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>

      {/* Sélecteur pays */}
      <div ref={ref} style={{ position:"relative", flexShrink:0, width:180 }}>
        <div onClick={() => setOpen(o => !o)}
          style={{ ...IS, display:"flex", alignItems:"center", gap:8, cursor:"pointer",
            border:`1px solid ${open?"#004f91":"#E4E1DE"}`, boxShadow: open?"0 0 0 3px rgba(0,79,145,0.10)":"none", paddingRight:32, height:42, transition:"border-color 0.15s, box-shadow 0.15s" }}>
          {selectedPays ? (
            <span style={{ fontSize:13, color:"#1a1a2e", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{selectedPays.nom_fr}</span>
          ) : (
            <span style={{ fontSize:13, color:"#9aa5b4" }}>Pays</span>
          )}
          <ChevronDown size={13} style={{ position:"absolute", right:10, top:"50%",
            transform:`translateY(-50%) rotate(${open?180:0}deg)`,
            color:"#9aa5b4", transition:"transform 0.2s", pointerEvents:"none" }} />
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

      {/* Champ numéro */}
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", background:"#fff", height:42,
          border:`1px solid ${isValid===false?"#dc2626":isValid===true?"#188038":"#E4E1DE"}`,
          borderRadius:10, overflow:"hidden", transition:"border-color 0.2s" }}>
          {indicatif && indicatif !== "+" && (
            <span style={{ padding:"0 10px 0 12px", fontSize:13, fontWeight:700, color:"#004f91",
              background:"rgba(0,79,145,0.07)", borderRight:"1px solid rgba(0,79,145,0.15)",
              whiteSpace:"nowrap", flexShrink:0, height:"100%", display:"flex", alignItems:"center" }}>
              {indicatif}
            </span>
          )}
          <input value={display} onChange={e => handleNumberChange(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={iso2 ? examplePlaceholder : "Sélectionner un pays d'abord"}
            disabled={!iso2}
            style={{ flex:1, background:"transparent", border:"none", outline:"none",
              padding: "0 12px 0 8px", fontSize:13, color:"#1a1a2e",
              fontFamily:"var(--font-google-sans)", height:"100%",
              cursor: iso2 ? "text" : "not-allowed", opacity: iso2 ? 1 : 0.5 }} />
          {isValid === true  && <span style={{ paddingRight:10, color:"#188038", fontSize:15, lineHeight:1 }}>✓</span>}
          {isValid === false && <span style={{ paddingRight:10, color:"#dc2626", fontSize:15, lineHeight:1 }}>✗</span>}
        </div>
        {isValid === true && numType && (
          <p style={{ fontSize:11, color:"#188038", marginTop:3 }}>{numType}</p>
        )}
        {isValid === false && (
          <p style={{ fontSize:11, color:"#dc2626", marginTop:3 }}>
            {invalidMsg}
          </p>
        )}
      </div>
    </div>
  );
}
