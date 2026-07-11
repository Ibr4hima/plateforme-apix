"use client";

import Navbar from "@/components/layout/Navbar";
import {
  ArrowRight,
  BarChart2,
  Building2,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Compteur animé ─────────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix="", decimals=0 }: { target:number; suffix?:string; decimals?:number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    const observer = new IntersectionObserver(([entry])=>{
      if (!entry.isIntersecting) return;
      let start = 0;
      const step = (ts:number)=>{
        if (!start) start=ts;
        const p = Math.min((ts-start)/1800,1);
        const e = 1-Math.pow(1-p,3);
        setCount(parseFloat((e*target).toFixed(decimals)));
        if (p<1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      observer.disconnect();
    },{threshold:0.3});
    if (ref.current) observer.observe(ref.current);
    return ()=>observer.disconnect();
  },[target,decimals]);
  return <span ref={ref}>{count.toLocaleString("fr-FR")}{suffix}</span>;
}

const MODULES = [
  { num:"01", icon:"finance_mode",           label:"Investissements privés",        href:"/ide",          color:"#ca631f", desc:"Flux d'investissements directs entrants et sortants" },
  { num:"02", icon:"currency_exchange",      label:"Échanges commerciaux",          href:"/statistiques", color:"#004f91", desc:"Flux bilatéraux et indicateurs sociaux-économiques" },
  { num:"03", icon:"frame_inspect",          label:"Prospects",                     href:"/prospects",    color:"#ca631f", desc:"Portefeuille d'entreprises internationales ciblées" },
  { num:"04", icon:"enterprise",             label:"Entreprises installées",        href:"/entreprises",  color:"#004f91", desc:"Cartographie des entreprises formalisées installées" },
  { num:"05", icon:"real_estate_agent",      label:"Zones d'investissement",        href:"/zones",        color:"#ca631f", desc:"ZES, ZAI, ZFI et pôles territoriaux d'investissement" },
  { num:"06", icon:"bookmark_stacks",        label:"Opportunités d'investissement", href:"/opportunites", color:"#004f91", desc:"Potentialités sectorielles à promouvoir auprès des investisseurs" },
  { num:"07", icon:"signature",              label:"Accords & Traités",             href:"/accords",      color:"#ca631f", desc:"Traités bilatéraux et accords de coopération économique" },
  { num:"08", icon:"event",                  label:"Événements",                    href:"/evenements",   color:"#004f91", desc:"Forums, salons, missions de prospection et rencontres B2B" },
];

export default function HomePage() {
  const [stats, setStats] = useState({ entreprises:0, accords_en_vigueur:0, evenements_a_venir:0, zones:0 });

  useEffect(()=>{
    // Source unique et fiable : /dashboard/stats agrège déjà les comptes sur
    // les bonnes tables (entreprises_installees, accords_traites, evenements, zones).
    fetch(`${API_BASE}/dashboard/stats`)
      .then(r=>r.json())
      .then(k=>setStats({
        entreprises:        k?.entreprises_total||0,
        accords_en_vigueur: k?.accords_vigueur||0,
        evenements_a_venir: k?.evenements_a_venir||0,
        zones:              k?.zones_total||0,
      }))
      .catch(()=>{});
  },[]);

  return (
    <main style={{minHeight:"100vh",background:"#F6F5F3",overflowX:"hidden",fontFamily:"var(--font-google-sans)"}}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.8}}
        .hero-tag{animation:fadeUp 0.6s ease both}
        .hero-h1{animation:fadeUp 0.7s 0.1s ease both}
        .hero-p{animation:fadeUp 0.7s 0.2s ease both}
        .hero-cta{animation:fadeUp 0.7s 0.3s ease both}
        .hero-stats{animation:fadeUp 0.7s 0.45s ease both}

        /* ── Responsive page d'accueil ── */
        @media (max-width: 860px){
          .lp-pad { padding-left: 20px !important; padding-right: 20px !important; }
          .lp-quick { display: grid !important; grid-template-columns: 1fr 1fr !important; }
          .lp-quick-item { border-right: none !important; }
          .lp-modules-grid { grid-template-columns: repeat(2,1fr) !important; }
          .lp-cta-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
        @media (max-width: 520px){
          .lp-quick { grid-template-columns: 1fr !important; }
          .lp-modules-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Navbar/>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="lp-pad" style={{minHeight:"88vh",display:"flex",flexDirection:"column" as const,justifyContent:"center",padding:"120px 60px 70px",position:"relative" as const,background:"#004f91",overflow:"hidden"}}>

        {/* Déco fond — même langage que les barres de titre */}
        <div style={{position:"absolute" as const,inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute" as const,inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",backgroundSize:"44px 44px",maskImage:"radial-gradient(ellipse at 75% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)",WebkitMaskImage:"radial-gradient(ellipse at 75% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)"}}/>
          <div style={{position:"absolute" as const,top:"-30%",right:"-8%",width:720,height:720,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 60%)"}}/>
          <div style={{position:"absolute" as const,bottom:"-35%",left:"-10%",width:560,height:560,borderRadius:"50%",background:"radial-gradient(circle,rgba(26,106,176,0.5) 0%,transparent 65%)"}}/>
          <div style={{position:"absolute" as const,left:0,right:0,bottom:0,height:1,background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.30) 50%,transparent 100%)"}}/>
        </div>

        <div style={{maxWidth:1200,margin:"0 auto",width:"100%",position:"relative" as const,zIndex:1}}>

          {/* Tag institutionnel */}
          <div className="hero-tag" style={{display:"inline-flex",alignItems:"center",gap:9,background:"rgba(202,99,31,0.08)",border:"1.5px solid rgba(202,99,31,0.45)",borderRadius:999,padding:"8px 17px",marginBottom:28}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:"#ca631f",animation:"pulse 2s infinite"}}/>
            <span style={{fontSize:11,fontWeight:700,color:"#ca631f",letterSpacing:"0.15em",textTransform:"uppercase"}}>Plateforme de Gestion des Investissements et des Investisseurs</span>
          </div>

          {/* Titre */}
          <h1 className="hero-h1" style={{fontWeight:800,fontSize:"clamp(2.8rem,5.5vw,5rem)",lineHeight:1.05,letterSpacing:"-0.025em",color:"#fff",marginBottom:24,maxWidth:800}}>
            Intelligence<br/>
            <span style={{background:"linear-gradient(135deg,#E8823C 0%,#FFC08A 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Investissement</span>
            <br/>Sénégal
          </h1>

          <p className="hero-p" style={{color:"rgba(255,255,255,0.65)",fontSize:"1.1rem",maxWidth:520,lineHeight:1.75,marginBottom:40}}>
            Plateforme de suivi, d'analyse et de gestion des investissements au Sénégal.
          </p>

          {/* CTAs */}
          <div className="hero-cta" style={{display:"flex",flexWrap:"wrap" as const,gap:12,marginBottom:72}}>
            <Link href="/tableau-de-bord" style={{display:"inline-flex",alignItems:"center",gap:8,background:"#ca631f",color:"#fff",fontWeight:700,fontSize:14,padding:"13px 24px",borderRadius:12,textDecoration:"none",boxShadow:"0 4px 20px rgba(202,99,31,0.4)",letterSpacing:"0.01em",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 32px rgba(202,99,31,0.5)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 4px 20px rgba(202,99,31,0.4)";}}>
              <BarChart2 size={16}/> Tableau de bord <ChevronRight size={15}/>
            </Link>
            <Link href="/ide" style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.10)",backdropFilter:"blur(12px)",color:"#fff",fontWeight:600,fontSize:14,padding:"13px 24px",borderRadius:12,textDecoration:"none",border:"1px solid rgba(255,255,255,0.25)",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.18)";e.currentTarget.style.borderColor="rgba(255,255,255,0.4)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.10)";e.currentTarget.style.borderColor="rgba(255,255,255,0.25)";}}>
              <span className="material-symbols-outlined" style={{fontSize:18,color:"#fff",fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>finance_mode</span> Investissements Privés <ChevronRight size={15}/>
            </Link>
          </div>

        </div>

        </section>

      {/* ── BANDE ACCÈS RAPIDE ────────────────────────────────────────────────── */}
      <section style={{background:"#ca631f",padding:"0"}}>
        <div className="lp-quick" style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"stretch"}}>
          {[
            {icon:BarChart2, label:"Tableau de bord",             href:"/tableau-de-bord", sub:"KPIs & Analyses"},
            {icon:Building2, label:"Entreprises",                  href:"/entreprises",     sub:"Registre complet"},
            {mat:"real_estate_agent", label:"Zones d'investissement",        href:"/zones",        sub:"ZES, ZAI, ZFI & pôles"},
            {mat:"currency_exchange", label:"Échanges commerciaux",           href:"/statistiques", sub:"Flux bilatéraux"},
          ].map((item:any,i)=>{
            const Icon=item.icon;
            return (
              <Link key={i} href={item.href} className="lp-quick-item" style={{flex:1,display:"flex",alignItems:"center",gap:12,padding:"20px 24px",textDecoration:"none",borderRight:i<3?"1px solid rgba(255,255,255,0.2)":"none",transition:"background 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,0,0,0.1)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                <div style={{width:36,height:36,borderRadius:9,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {item.mat
                    ? <span className="material-symbols-outlined" style={{fontSize:18,color:"#fff",fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>{item.mat}</span>
                    : <Icon size={16} style={{color:"#fff"}}/>}
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#fff",whiteSpace:"nowrap"}}>{item.label}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.65)"}}>{item.sub}</div>
                </div>
                <ChevronRight size={14} style={{color:"rgba(255,255,255,0.4)",marginLeft:"auto"}}/>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── MODULES ──────────────────────────────────────────────────────────── */}
      <section className="lp-pad" style={{background:"#F6F5F3",padding:"80px 60px"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:48,flexWrap:"wrap" as const,gap:20}}>
            <div>
              <p style={{fontSize:11,fontWeight:700,color:"#ca631f",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:10}}>Architecture de la plateforme</p>
              <h2 style={{fontWeight:800,fontSize:"clamp(1.8rem,3vw,2.6rem)",color:"#1a1a2e",lineHeight:1.1}}>
                8 modules de données<br/>interconnectés
              </h2>
            </div>
            <p style={{color:"#6b7684",maxWidth:360,lineHeight:1.65,fontSize:14}}>
              Chaque module couvre un aspect du cycle de vie de l'investissement, de la prospection à l'installation définitive.
            </p>
          </div>
          <div className="lp-modules-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#ECEAE7",border:"1px solid #ECEAE7",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.03)"}}>
            {MODULES.map((m,i)=>(
                <Link key={i} href={m.href} className="mod-card" style={{textDecoration:"none",background:"#fff",padding:"28px 24px",display:"flex",flexDirection:"column" as const,gap:16,transition:"background 0.15s",position:"relative" as const}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#FAFAF9";(e.currentTarget.querySelector(".mod-arrow") as HTMLElement)!.style.opacity="1";(e.currentTarget.querySelector(".mod-num") as HTMLElement)!.style.color=m.color;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="#fff";(e.currentTarget.querySelector(".mod-arrow") as HTMLElement)!.style.opacity="0";(e.currentTarget.querySelector(".mod-num") as HTMLElement)!.style.color="#C5BFBB";}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{width:40,height:40,borderRadius:10,background:`${m.color}10`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span className="material-symbols-outlined" style={{fontSize:20,color:m.color,fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",lineHeight:1}}>{m.icon}</span>
                    </div>
                    <span className="mod-num" style={{fontSize:11,fontWeight:700,color:"#C5BFBB",letterSpacing:"0.05em",transition:"color 0.15s"}}>{m.num}</span>
                  </div>
                  <div>
                    <h3 style={{fontWeight:700,fontSize:15,color:"#1a1a2e",marginBottom:6}}>{m.label}</h3>
                    <p style={{fontSize:12,color:"#6b7684",lineHeight:1.6}}>{m.desc}</p>
                  </div>
                  <div className="mod-arrow" style={{marginTop:"auto",display:"flex",alignItems:"center",gap:4,fontSize:12,color:m.color,fontWeight:600,opacity:0,transition:"opacity 0.15s"}}>
                    Accéder <ChevronRight size={13}/>
                  </div>
                </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TABLEAU DE BORD CTA ───────────────────────────────────────────────── */}
      <section className="lp-pad" style={{background:"#004f91",padding:"80px 60px",position:"relative" as const,overflow:"hidden"}}>
        <div style={{position:"absolute" as const,inset:0,pointerEvents:"none"}}>
          <div style={{position:"absolute" as const,inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)",backgroundSize:"44px 44px",maskImage:"radial-gradient(ellipse at 20% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)",WebkitMaskImage:"radial-gradient(ellipse at 20% 0%,rgba(0,0,0,0.9) 0%,transparent 72%)"}}/>
          <div style={{position:"absolute" as const,bottom:"-30%",left:"-8%",width:520,height:520,borderRadius:"50%",background:"radial-gradient(circle,rgba(26,106,176,0.5) 0%,transparent 65%)"}}/>
          <div style={{position:"absolute" as const,left:0,right:0,top:0,height:1,background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.25) 50%,transparent 100%)"}}/>
        </div>
        <div className="lp-cta-grid" style={{maxWidth:1200,margin:"0 auto",position:"relative" as const,zIndex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center"}}>
          <div>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(202,99,31,0.1)",border:"1px solid rgba(202,99,31,0.2)",borderRadius:999,padding:"5px 14px",marginBottom:24}}>
              <BarChart2 size={12} style={{color:"#ca631f"}}/>
              <span style={{fontSize:11,fontWeight:700,color:"#E8823C",letterSpacing:"0.12em",textTransform:"uppercase"}}>Tableau de bord</span>
            </div>
            <h2 style={{fontWeight:800,fontSize:"clamp(1.8rem,3vw,2.8rem)",color:"#fff",lineHeight:1.1,marginBottom:16}}>
              KPIs, visualisations<br/>et analyses en temps réel
            </h2>
            <p style={{color:"rgba(255,255,255,0.6)",fontSize:14,lineHeight:1.75,marginBottom:32,maxWidth:460}}>
              Vue consolidée de l'attractivité de la Destination Sénégal — Tendances sectorielles, répartition géographique, taux d'occupation des zones d'investissement et flux d'IDE
            </p>
            <div style={{display:"flex",gap:10}}>
              <Link href="/tableau-de-bord" style={{display:"inline-flex",alignItems:"center",gap:8,background:"#ca631f",color:"#fff",fontWeight:700,fontSize:14,padding:"13px 24px",borderRadius:12,textDecoration:"none",boxShadow:"0 4px 20px rgba(202,99,31,0.35)",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(202,99,31,0.45)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 4px 20px rgba(202,99,31,0.35)";}}>
                Ouvrir le tableau de bord <ArrowRight size={15}/>
              </Link>
            </div>
          </div>
          {/* Aperçu KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[
              {label:"Entreprises installées",  val:stats.entreprises,        icon:"enterprise"},
              {label:"Accords en vigueur",       val:stats.accords_en_vigueur, icon:"signature"},
              {label:"Événements à venir",       val:stats.evenements_a_venir, icon:"event"},
              {label:"Zones d'investissement",   val:stats.zones,              icon:"real_estate_agent"},
            ].map((k,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:14,padding:"20px",backdropFilter:"blur(12px)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <span className="material-symbols-outlined" style={{fontSize:16,color:"#E8823C",opacity:0.9,fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",lineHeight:1}}>{k.icon}</span>
                  </div>
                  <div style={{fontWeight:800,fontSize:"1.8rem",color:"#fff",lineHeight:1,marginBottom:6}}>
                    <AnimatedCounter target={k.val}/>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>{k.label}</div>
                </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IDENTITÉ INSTITUTIONNELLE ─────────────────────────────────────────── */}
      <section className="lp-pad" style={{background:"#fff",borderTop:"1px solid #ECEAE7",padding:"56px 60px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap" as const,gap:40}}>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <Image src="/logo_apix.png" alt="APIX Sénégal" width={80} height={40} style={{height:40,width:"auto",objectFit:"contain"}}/>
            <div style={{width:1,height:36,background:"#E4E1DE"}}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e"}}>DIPE — Direction de l'Intelligence et des Perspectives Économiques</div>
              <div style={{fontSize:12,color:"#6b7684",marginTop:2}}>Agence Nationale pour la Promotion des Investissements et des Grands Travaux</div>
            </div>
          </div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap" as const}}>
            {[
              {icon:"all_inclusive", label:"Plateforme souveraine"},
              {icon:"security",      label:"Données sécurisées"},
              {icon:"show_chart",    label:"Mise à jour continue"},
            ].map((item,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"#F6F5F3",border:"1px solid #E4E1DE",borderRadius:999}}>
                  <span className="material-symbols-outlined" style={{fontSize:15,color:"#4a5568",fontVariationSettings:"'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",lineHeight:1}}>{item.icon}</span>
                  <span style={{fontSize:12,fontWeight:600,color:"#4a5568"}}>{item.label}</span>
                </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────────── */}
      <footer className="lp-pad" style={{borderTop:"1px solid #ECEAE7",padding:"24px 60px",background:"#fff"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap" as const,gap:12}}>
          <p style={{color:"#6b7684",fontSize:12}}>© {new Date().getFullYear()} APIX S.A — DIPE. Tous droits réservés.</p>
          <p style={{color:"#6b7684",fontSize:12}}>Plateforme à usage institutionnel</p>
        </div>
      </footer>
    </main>
  );
}
