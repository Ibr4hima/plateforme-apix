// ── Moteur de calcul KPIs IDE ─────────────────────────────────────────────────
// 105 KPIs calculés depuis les données brutes CNUCED

export interface DonneesIDE {
  annee: number;
  valeur: number | null;
  direction: "entrant" | "sortant";
  indicateur: "flux" | "stock";
}

export interface KpiResult {
  id: string;
  label: string;
  categorie: string;
  valeur: number | null;
  unite: string;
  annee?: number;
  description: string;
  format: "monnaie" | "pourcentage" | "ratio" | "entier" | "annee" | "monnaie_signe";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function serie(donnees: DonneesIDE[], dir: string, ind: string): {annee:number;v:number}[] {
  return donnees
    .filter(d => d.direction===dir && d.indicateur===ind && d.valeur!==null)
    .sort((a,b) => a.annee-b.annee)
    .map(d => ({ annee:d.annee, v:d.valeur as number }));
}

function vals(s: {annee:number;v:number}[]): number[] { return s.map(x=>x.v); }

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s=[...arr].sort((a,b)=>a-b);
  const m=Math.floor(s.length/2);
  return s.length%2===0?(s[m-1]+s[m])/2:s[m];
}

function std(arr: number[]): number {
  if (arr.length<2) return 0;
  const m=mean(arr);
  return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length);
}

function variance(arr: number[]): number {
  if (arr.length<2) return 0;
  const m=mean(arr);
  return arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length;
}

function cagr(debut: number, fin: number, n: number): number | null {
  if (debut===0||n<=0) return null;
  if (debut<0&&fin<0) return null;
  return (Math.pow(Math.abs(fin/debut), 1/n)-1)*100;
}

function pearson(a: number[], b: number[]): number | null {
  const n=Math.min(a.length,b.length);
  if (n<3) return null;
  const ma=mean(a.slice(0,n)), mb=mean(b.slice(0,n));
  const num=a.slice(0,n).reduce((s,ai,i)=>s+(ai-ma)*(b[i]-mb),0);
  const da=Math.sqrt(a.slice(0,n).reduce((s,ai)=>s+(ai-ma)**2,0));
  const db=Math.sqrt(b.slice(0,n).reduce((s,bi)=>s+(bi-mb)**2,0));
  if (da===0||db===0) return null;
  return num/(da*db);
}

function skewness(arr: number[]): number | null {
  if (arr.length<3) return null;
  const m=mean(arr), s=std(arr);
  if (s===0) return null;
  return arr.reduce((a,b)=>a+((b-m)/s)**3,0)/arr.length;
}

function kurtosis(arr: number[]): number | null {
  if (arr.length<4) return null;
  const m=mean(arr), s=std(arr);
  if (s===0) return null;
  return arr.reduce((a,b)=>a+((b-m)/s)**4,0)/arr.length - 3;
}

function linearTrend(s: {annee:number;v:number}[]): number | null {
  if (s.length<3) return null;
  const n=s.length;
  const xs=s.map((_,i)=>i), ys=s.map(x=>x.v);
  const mx=mean(xs), my=mean(ys);
  const num=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0);
  const den=xs.reduce((a,x)=>a+(x-mx)**2,0);
  return den===0?null:(num/den);
}

function consecutiveStreak(arr: number[], condition: (v:number)=>boolean): number {
  let max=0,cur=0;
  for(const v of arr){ if(condition(v)){cur++;max=Math.max(max,cur);}else{cur=0;} }
  return max;
}

function currentStreak(arr: number[], condition: (v:number)=>boolean): number {
  let cur=0;
  for(let i=arr.length-1;i>=0;i--){ if(condition(arr[i]))cur++; else break; }
  return cur;
}

// ── Calcul des 105 KPIs ───────────────────────────────────────────────────────
export function calculerKpis(donnees: DonneesIDE[]): KpiResult[] {
  const FE = serie(donnees,"entrant","flux");
  const FS = serie(donnees,"sortant","flux");
  const SE = serie(donnees,"entrant","stock");
  const SS = serie(donnees,"sortant","stock");

  const vFE=vals(FE), vFS=vals(FS), vSE=vals(SE), vSS=vals(SS);
  const vFN=FE.map((x,i)=>{ const s=FS.find(f=>f.annee===x.annee); return {annee:x.annee,v:s?x.v-s.v:x.v}; });
  const vSN=SE.map((x,i)=>{ const s=SS.find(f=>f.annee===x.annee); return {annee:x.annee,v:s?x.v-s.v:x.v}; });

  const lastFE=FE[FE.length-1], lastFS=FS[FS.length-1];
  const lastSE=SE[SE.length-1], lastSS=SS[SS.length-1];
  const prevFE=FE[FE.length-2], prevFS=FS[FS.length-2];

  const anneeMin=FE[0]?.annee, anneeMax=FE[FE.length-1]?.annee;
  const n=FE.length;

  const R: KpiResult[] = [];

  const add = (id:string,label:string,categorie:string,valeur:number|null,unite:string,annee:number|undefined,description:string,format:KpiResult["format"]) => {
    R.push({id,label,categorie,valeur,unite,annee,description,format});
  };

  // ── 1. Valeurs annuelles ──────────────────────────────────────────────────
  add("fe_last","Flux entrants — dernière année","Valeurs annuelles",lastFE?.v??null,"M$",lastFE?.annee,"Montant des flux d'IDE entrants pour la dernière année disponible","monnaie");
  add("fs_last","Flux sortants — dernière année","Valeurs annuelles",lastFS?.v??null,"M$",lastFS?.annee,"Montant des flux d'IDE sortants pour la dernière année disponible","monnaie");
  add("fn_last","Flux nets — dernière année","Valeurs annuelles",lastFE&&lastFS?lastFE.v-lastFS.v:null,"M$",lastFE?.annee,"Flux entrants moins flux sortants","monnaie_signe");
  add("se_last","Stock entrant — dernière année","Valeurs annuelles",lastSE?.v??null,"M$",lastSE?.annee,"Stock d'IDE entrant cumulé","monnaie");
  add("ss_last","Stock sortant — dernière année","Valeurs annuelles",lastSS?.v??null,"M$",lastSS?.annee,"Stock d'IDE sortant cumulé","monnaie");
  add("sn_last","Stock net — dernière année","Valeurs annuelles",lastSE&&lastSS?lastSE.v-lastSS.v:null,"M$",lastSE?.annee,"Stock entrant moins stock sortant","monnaie_signe");

  // ── 2. Cumulés ────────────────────────────────────────────────────────────
  add("fe_cum","Flux entrants cumulés","Cumulés",vFE.reduce((a,b)=>a+b,0)||null,"M$",undefined,"Somme de tous les flux entrants sur la période","monnaie");
  add("fs_cum","Flux sortants cumulés","Cumulés",vFS.reduce((a,b)=>a+b,0)||null,"M$",undefined,"Somme de tous les flux sortants sur la période","monnaie");
  add("fn_cum","Flux nets cumulés","Cumulés",vFN.reduce((a,b)=>a+b.v,0)||null,"M$",undefined,"Somme des flux nets sur la période","monnaie_signe");

  // ── 3. Croissance annuelle ────────────────────────────────────────────────
  const gFE = prevFE&&lastFE&&prevFE.v!==0?((lastFE.v-prevFE.v)/Math.abs(prevFE.v)*100):null;
  const gFS = prevFS&&lastFS&&prevFS.v!==0?((lastFS.v-prevFS.v)/Math.abs(prevFS.v)*100):null;
  const prevSE=SE[SE.length-2],prevSS=SS[SS.length-2];
  const gSE = prevSE&&lastSE&&prevSE.v!==0?((lastSE.v-prevSE.v)/Math.abs(prevSE.v)*100):null;
  const gSS = prevSS&&lastSS&&prevSS.v!==0?((lastSS.v-prevSS.v)/Math.abs(prevSS.v)*100):null;
  add("g_fe","Croissance flux entrants (vs N-1)","Croissance",gFE,"%",lastFE?.annee,"Taux de croissance annuel des flux entrants","pourcentage");
  add("g_fs","Croissance flux sortants (vs N-1)","Croissance",gFS,"%",lastFS?.annee,"Taux de croissance annuel des flux sortants","pourcentage");
  add("g_se","Croissance stock entrant (vs N-1)","Croissance",gSE,"%",lastSE?.annee,"Taux de croissance annuel du stock entrant","pourcentage");
  add("g_ss","Croissance stock sortant (vs N-1)","Croissance",gSS,"%",lastSS?.annee,"Taux de croissance annuel du stock sortant","pourcentage");

  // ── 4. CAGR ───────────────────────────────────────────────────────────────
  add("cagr_fe","CAGR flux entrants","CAGR",cagr(FE[0]?.v,lastFE?.v,n-1),"%",undefined,`Taux de croissance annuel composé des flux entrants (${anneeMin}–${anneeMax})`,"pourcentage");
  add("cagr_fs","CAGR flux sortants","CAGR",cagr(FS[0]?.v,lastFS?.v,FS.length-1),"%",undefined,"Taux de croissance annuel composé des flux sortants","pourcentage");
  add("cagr_se","CAGR stock entrant","CAGR",cagr(SE[0]?.v,lastSE?.v,SE.length-1),"%",undefined,"Taux de croissance annuel composé du stock entrant","pourcentage");
  add("cagr_ss","CAGR stock sortant","CAGR",cagr(SS[0]?.v,lastSS?.v,SS.length-1),"%",undefined,"Taux de croissance annuel composé du stock sortant","pourcentage");

  // ── 5. Moyennes ───────────────────────────────────────────────────────────
  add("moy_fe","Moyenne flux entrants","Statistiques",vFE.length?mean(vFE):null,"M$",undefined,"Moyenne arithmétique des flux entrants sur la période","monnaie");
  add("moy_fs","Moyenne flux sortants","Statistiques",vFS.length?mean(vFS):null,"M$",undefined,"Moyenne arithmétique des flux sortants","monnaie");
  add("moy_fn","Moyenne flux nets","Statistiques",vFN.length?mean(vFN.map(x=>x.v)):null,"M$",undefined,"Moyenne arithmétique des flux nets","monnaie_signe");
  add("med_fe","Médiane flux entrants","Statistiques",vFE.length?median(vFE):null,"M$",undefined,"Valeur médiane des flux entrants","monnaie");
  add("med_fs","Médiane flux sortants","Statistiques",vFS.length?median(vFS):null,"M$",undefined,"Valeur médiane des flux sortants","monnaie");
  add("med_fn","Médiane flux nets","Statistiques",vFN.length?median(vFN.map(x=>x.v)):null,"M$",undefined,"Valeur médiane des flux nets","monnaie_signe");

  // ── 6. Dispersion ─────────────────────────────────────────────────────────
  const stdFE=vFE.length?std(vFE):null, stdFS=vFS.length?std(vFS):null;
  const stdFN=vFN.length?std(vFN.map(x=>x.v)):null;
  const mFE=vFE.length?mean(vFE):0, mFS=vFS.length?mean(vFS):0;
  add("std_fe","Écart-type flux entrants","Dispersion",stdFE,"M$",undefined,"Mesure de la variabilité des flux entrants","monnaie");
  add("std_fs","Écart-type flux sortants","Dispersion",stdFS,"M$",undefined,"Mesure de la variabilité des flux sortants","monnaie");
  add("std_fn","Écart-type flux nets","Dispersion",stdFN,"M$",undefined,"Mesure de la variabilité des flux nets","monnaie");
  add("cv_fe","Coeff. variation flux entrants","Dispersion",stdFE&&mFE?stdFE/Math.abs(mFE)*100:null,"%",undefined,"Variabilité relative des flux entrants (écart-type/moyenne)","pourcentage");
  add("cv_fs","Coeff. variation flux sortants","Dispersion",stdFS&&mFS?stdFS/Math.abs(mFS)*100:null,"%",undefined,"Variabilité relative des flux sortants","pourcentage");
  add("var_fe","Variance flux entrants","Dispersion",vFE.length?variance(vFE):null,"M$²",undefined,"Variance statistique des flux entrants","monnaie");
  add("var_fs","Variance flux sortants","Dispersion",vFS.length?variance(vFS):null,"M$²",undefined,"Variance statistique des flux sortants","monnaie");

  // ── 7. Extrêmes ───────────────────────────────────────────────────────────
  const maxFE=FE.length?FE.reduce((a,b)=>b.v>a.v?b:a):null;
  const maxFS=FS.length?FS.reduce((a,b)=>b.v>a.v?b:a):null;
  const minFE=FE.length?FE.reduce((a,b)=>b.v<a.v?b:a):null;
  const minFS=FS.length?FS.reduce((a,b)=>b.v<a.v?b:a):null;
  add("max_fe","Maximum flux entrants","Extrêmes",maxFE?.v??null,"M$",maxFE?.annee,"Valeur maximale historique des flux entrants","monnaie");
  add("max_fs","Maximum flux sortants","Extrêmes",maxFS?.v??null,"M$",maxFS?.annee,"Valeur maximale historique des flux sortants","monnaie");
  add("min_fe","Minimum flux entrants","Extrêmes",minFE?.v??null,"M$",minFE?.annee,"Valeur minimale historique des flux entrants","monnaie");
  add("min_fs","Minimum flux sortants","Extrêmes",minFS?.v??null,"M$",minFS?.annee,"Valeur minimale historique des flux sortants","monnaie");
  add("amp_fe","Amplitude flux entrants","Extrêmes",maxFE&&minFE?maxFE.v-minFE.v:null,"M$",undefined,"Écart entre maximum et minimum des flux entrants","monnaie");
  add("amp_fs","Amplitude flux sortants","Extrêmes",maxFS&&minFS?maxFS.v-minFS.v:null,"M$",undefined,"Écart entre maximum et minimum des flux sortants","monnaie");
  add("yr_max_fe","Année du pic flux entrants","Extrêmes",maxFE?.annee??null,"",maxFE?.annee,"Année où les flux entrants ont atteint leur maximum historique","annee");
  add("yr_max_fs","Année du pic flux sortants","Extrêmes",maxFS?.annee??null,"",maxFS?.annee,"Année où les flux sortants ont atteint leur maximum historique","annee");
  add("yr_min_fe","Année du minimum flux entrants","Extrêmes",minFE?.annee??null,"",minFE?.annee,"Année où les flux entrants ont atteint leur minimum historique","annee");
  add("yr_min_fs","Année du minimum flux sortants","Extrêmes",minFS?.annee??null,"",minFS?.annee,"Année où les flux sortants ont atteint leur minimum historique","annee");

  // Plus forte hausse/baisse annuelle
  const deltasFE = FE.slice(1).map((x,i)=>({annee:x.annee,v:x.v-FE[i].v}));
  const deltasFS = FS.slice(1).map((x,i)=>({annee:x.annee,v:x.v-FS[i].v}));
  const maxDeltaFE=deltasFE.length?deltasFE.reduce((a,b)=>b.v>a.v?b:a):null;
  const minDeltaFE=deltasFE.length?deltasFE.reduce((a,b)=>b.v<a.v?b:a):null;
  const maxDeltaFS=deltasFS.length?deltasFS.reduce((a,b)=>b.v>a.v?b:a):null;
  const minDeltaFS=deltasFS.length?deltasFS.reduce((a,b)=>b.v<a.v?b:a):null;
  add("up_fe","Plus forte hausse annuelle flux ent.","Extrêmes",maxDeltaFE?.v??null,"M$",maxDeltaFE?.annee,"Plus grande augmentation absolue d'une année sur l'autre (flux entrants)","monnaie");
  add("dn_fe","Plus forte baisse annuelle flux ent.","Extrêmes",minDeltaFE?.v??null,"M$",minDeltaFE?.annee,"Plus grande diminution absolue d'une année sur l'autre (flux entrants)","monnaie_signe");
  add("up_fs","Plus forte hausse annuelle flux sort.","Extrêmes",maxDeltaFS?.v??null,"M$",maxDeltaFS?.annee,"Plus grande augmentation absolue d'une année sur l'autre (flux sortants)","monnaie");
  add("dn_fs","Plus forte baisse annuelle flux sort.","Extrêmes",minDeltaFS?.v??null,"M$",minDeltaFS?.annee,"Plus grande diminution absolue d'une année sur l'autre (flux sortants)","monnaie_signe");

  // ── 8. Comptages ─────────────────────────────────────────────────────────
  const growthsFE=FE.slice(1).map((x,i)=>x.v>FE[i].v);
  add("n_pos_fe","Années de croissance flux entrants","Comptages",growthsFE.filter(Boolean).length,"ans",undefined,"Nombre d'années avec flux entrants en hausse vs N-1","entier");
  add("n_neg_fe","Années de baisse flux entrants","Comptages",growthsFE.filter(x=>!x).length,"ans",undefined,"Nombre d'années avec flux entrants en baisse vs N-1","entier");
  add("n_neg_val_fe","Années avec flux entrants négatifs","Comptages",vFE.filter(v=>v<0).length,"ans",undefined,"Nombre d'années où les flux entrants sont négatifs (désinvestissement)","entier");
  add("n_neg_val_fs","Années avec flux sortants négatifs","Comptages",vFS.filter(v=>v<0).length,"ans",undefined,"Nombre d'années où les flux sortants sont négatifs","entier");
  add("n_pos_fn","Années avec flux net positif","Comptages",vFN.filter(x=>x.v>0).length,"ans",undefined,"Nombre d'années où le pays reçoit plus qu'il n'envoie","entier");
  add("n_neg_fn","Années avec flux net négatif","Comptages",vFN.filter(x=>x.v<0).length,"ans",undefined,"Nombre d'années où le pays envoie plus qu'il ne reçoit","entier");

  // ── 9. Ratios ─────────────────────────────────────────────────────────────
  add("r_fe_fs","Ratio flux entrants / sortants","Ratios",lastFE&&lastFS&&lastFS.v!==0?lastFE.v/lastFS.v:null,"×",lastFE?.annee,"Rapport entre flux entrants et sortants (>1 = attire plus qu'il n'envoie)","ratio");
  add("r_se_ss","Ratio stock entrant / sortant","Ratios",lastSE&&lastSS&&lastSS.v!==0?lastSE.v/lastSS.v:null,"×",lastSE?.annee,"Rapport entre stock entrant et sortant","ratio");
  add("r_se_fe","Ratio stock / flux entrant","Ratios",lastSE&&lastFE&&lastFE.v!==0?lastSE.v/lastFE.v:null,"×",lastSE?.annee,"Nombre d'années de flux entrants nécessaires pour atteindre le stock actuel","ratio");
  add("r_ss_fs","Ratio stock / flux sortant","Ratios",lastSS&&lastFS&&lastFS.v!==0?lastSS.v/lastFS.v:null,"×",lastSS?.annee,"Nombre d'années de flux sortants pour atteindre le stock sortant actuel","ratio");
  add("r_fn_fe","Ratio flux net / flux entrant","Ratios",lastFE&&lastFS&&lastFE.v!==0?(lastFE.v-lastFS.v)/lastFE.v*100:null,"%",lastFE?.annee,"Part du flux entrant qui reste dans le pays (net de ce qui repart)","pourcentage");
  add("r_sn_se","Ratio stock net / stock entrant","Ratios",lastSE&&lastSS&&lastSE.v!==0?(lastSE.v-lastSS.v)/lastSE.v*100:null,"%",lastSE?.annee,"Part du stock entrant qui est net de l'investissement à l'étranger","pourcentage");
  add("r_sn_fn","Ratio stock net / flux net","Ratios",vSN.length&&vFN.length&&vFN[vFN.length-1]?.v!==0?vSN[vSN.length-1]?.v/vFN[vFN.length-1]?.v:null,"×",undefined,"Années de flux net pour atteindre le stock net actuel","ratio");

  // ── 10. Tendance & momentum ───────────────────────────────────────────────
  const trendFE=linearTrend(FE), trendFS=linearTrend(FS);
  const trendSE=linearTrend(SE), trendSS=linearTrend(SS);
  add("trend_fe","Tendance linéaire flux entrants","Tendance",trendFE,"M$/an",undefined,"Pente de régression linéaire — progression annuelle moyenne","monnaie_signe");
  add("trend_fs","Tendance linéaire flux sortants","Tendance",trendFS,"M$/an",undefined,"Pente de régression linéaire des flux sortants","monnaie_signe");
  add("trend_se","Tendance linéaire stock entrant","Tendance",trendSE,"M$/an",undefined,"Pente de régression linéaire du stock entrant","monnaie_signe");
  add("trend_ss","Tendance linéaire stock sortant","Tendance",trendSS,"M$/an",undefined,"Pente de régression linéaire du stock sortant","monnaie_signe");

  // Accélération (pente sur 2e moitié vs 1ère moitié)
  const mid=Math.floor(FE.length/2);
  const accelFE=FE.length>4?(linearTrend(FE.slice(mid))??0)-(linearTrend(FE.slice(0,mid))??0):null;
  const accelFS=FS.length>4?(linearTrend(FS.slice(mid))??0)-(linearTrend(FS.slice(0,mid))??0):null;
  add("accel_fe","Accélération flux entrants","Tendance",accelFE,"M$/an²",undefined,"Différence de tendance entre 2e et 1ère moitié de la période (>0 = accélération)","monnaie_signe");
  add("accel_fs","Accélération flux sortants","Tendance",accelFS,"M$/an²",undefined,"Différence de tendance entre 2e et 1ère moitié de la période","monnaie_signe");

  // Momentum
  const last5FE=vFE.slice(-5), last5FS=vFS.slice(-5);
  const mom_fe=last5FE.length>=2?((last5FE[last5FE.length-1]-last5FE[0])/Math.abs(last5FE[0]||1)*100):null;
  const mom_fs=last5FS.length>=2?((last5FS[last5FS.length-1]-last5FS[0])/Math.abs(last5FS[0]||1)*100):null;
  add("mom_fe","Momentum flux entrants (5 ans)","Tendance",mom_fe,"%",undefined,"Variation relative des flux entrants sur les 5 dernières années","pourcentage");
  add("mom_fs","Momentum flux sortants (5 ans)","Tendance",mom_fs,"%",undefined,"Variation relative des flux sortants sur les 5 dernières années","pourcentage");

  // ── 11. Taux moyen de variation ───────────────────────────────────────────
  const tv5FE=FE.length>=6?cagr(FE[FE.length-6].v,lastFE?.v??0,5):null;
  const tv10FE=FE.length>=11?cagr(FE[FE.length-11].v,lastFE?.v??0,10):null;
  const tv5FS=FS.length>=6?cagr(FS[FS.length-6].v,lastFS?.v??0,5):null;
  const tv10FS=FS.length>=11?cagr(FS[FS.length-11].v,lastFS?.v??0,10):null;
  add("tv5_fe","Taux moyen variation 5 ans flux ent.","Tendance",tv5FE,"%",undefined,"CAGR des flux entrants sur les 5 dernières années","pourcentage");
  add("tv10_fe","Taux moyen variation 10 ans flux ent.","Tendance",tv10FE,"%",undefined,"CAGR des flux entrants sur les 10 dernières années","pourcentage");
  add("tv5_fs","Taux moyen variation 5 ans flux sort.","Tendance",tv5FS,"%",undefined,"CAGR des flux sortants sur les 5 dernières années","pourcentage");
  add("tv10_fs","Taux moyen variation 10 ans flux sort.","Tendance",tv10FS,"%",undefined,"CAGR des flux sortants sur les 10 dernières années","pourcentage");

  // ── 12. Moyennes mobiles ──────────────────────────────────────────────────
  const mm5 = (arr:number[]) => arr.length>=5?mean(arr.slice(-5)):null;
  const mm10 = (arr:number[]) => arr.length>=10?mean(arr.slice(-10)):null;
  add("mm5_fe","Moyenne mobile 5 ans flux entrants","Moyennes mobiles",mm5(vFE),"M$",undefined,"Moyenne des flux entrants sur les 5 dernières années","monnaie");
  add("mm5_fs","Moyenne mobile 5 ans flux sortants","Moyennes mobiles",mm5(vFS),"M$",undefined,"Moyenne des flux sortants sur les 5 dernières années","monnaie");
  add("mm5_se","Moyenne mobile 5 ans stock entrant","Moyennes mobiles",mm5(vSE),"M$",undefined,"Moyenne du stock entrant sur les 5 dernières années","monnaie");
  add("mm5_ss","Moyenne mobile 5 ans stock sortant","Moyennes mobiles",mm5(vSS),"M$",undefined,"Moyenne du stock sortant sur les 5 dernières années","monnaie");
  add("mm10_fe","Moyenne mobile 10 ans flux entrants","Moyennes mobiles",mm10(vFE),"M$",undefined,"Moyenne des flux entrants sur les 10 dernières années","monnaie");
  add("mm10_fs","Moyenne mobile 10 ans flux sortants","Moyennes mobiles",mm10(vFS),"M$",undefined,"Moyenne des flux sortants sur les 10 dernières années","monnaie");

  // ── 13. Volatilité glissante ──────────────────────────────────────────────
  const vol5 = (arr:number[]) => arr.length>=5?std(arr.slice(-5)):null;
  add("vol5_fe","Volatilité 5 ans flux entrants","Volatilité",vol5(vFE),"M$",undefined,"Écart-type des flux entrants sur les 5 dernières années","monnaie");
  add("vol5_fs","Volatilité 5 ans flux sortants","Volatilité",vol5(vFS),"M$",undefined,"Écart-type des flux sortants sur les 5 dernières années","monnaie");

  // ── 14. Corrélations ─────────────────────────────────────────────────────
  const yearsCommon=FE.map(x=>x.annee).filter(y=>FS.some(f=>f.annee===y));
  const cFE=yearsCommon.map(y=>FE.find(x=>x.annee===y)!.v);
  const cFS=yearsCommon.map(y=>FS.find(x=>x.annee===y)!.v);
  add("corr_fe_fs","Corrélation flux ent. / sortants","Corrélations",pearson(cFE,cFS),"",undefined,"Corrélation de Pearson entre flux entrants et sortants (-1 à +1)","ratio");
  const yearsSE=SE.map(x=>x.annee).filter(y=>SS.some(f=>f.annee===y));
  const cSE=yearsSE.map(y=>SE.find(x=>x.annee===y)!.v);
  const cSS=yearsSE.map(y=>SS.find(x=>x.annee===y)!.v);
  add("corr_se_ss","Corrélation stock ent. / sortant","Corrélations",pearson(cSE,cSS),"",undefined,"Corrélation de Pearson entre stock entrant et sortant","ratio");

  // ── 15. Séries consécutives ───────────────────────────────────────────────
  const growthArrFE=FE.slice(1).map((x,i)=>x.v-FE[i].v);
  add("streak_up_fe","Streak max croissance flux ent.","Consécutives",consecutiveStreak(growthArrFE,v=>v>0),"ans",undefined,"Plus longue série consécutive d'années en hausse (flux entrants)","entier");
  add("streak_dn_fe","Streak max baisse flux ent.","Consécutives",consecutiveStreak(growthArrFE,v=>v<0),"ans",undefined,"Plus longue série consécutive d'années en baisse (flux entrants)","entier");
  add("cur_streak_fe","Streak actuel flux entrants","Consécutives",currentStreak(growthArrFE,v=>v>0),"ans",undefined,"Nombre d'années consécutives de croissance en cours (flux entrants)","entier");
  const growthArrSE=SE.slice(1).map((x,i)=>x.v-SE[i].v);
  const growthArrSS=SS.slice(1).map((x,i)=>x.v-SS[i].v);
  add("streak_se","Streak croissance stock entrant","Consécutives",consecutiveStreak(growthArrSE,v=>v>0),"ans",undefined,"Plus longue série consécutive de croissance du stock entrant","entier");
  add("streak_ss","Streak croissance stock sortant","Consécutives",consecutiveStreak(growthArrSS,v=>v>0),"ans",undefined,"Plus longue série consécutive de croissance du stock sortant","entier");

  // ── 16. Accumulation stock ────────────────────────────────────────────────
  const vitSE=SE.length>=2?(lastSE!.v-SE[0].v)/(SE.length-1):null;
  const vitSS=SS.length>=2?(lastSS!.v-SS[0].v)/(SS.length-1):null;
  add("vit_se","Vitesse accumulation stock entrant","Accumulation",vitSE,"M$/an",undefined,"Augmentation annuelle moyenne du stock d'IDE entrant","monnaie_signe");
  add("vit_ss","Vitesse accumulation stock sortant","Accumulation",vitSS,"M$/an",undefined,"Augmentation annuelle moyenne du stock d'IDE sortant","monnaie_signe");

  // ── 17. Distribution ─────────────────────────────────────────────────────
  add("skew_fe","Asymétrie flux entrants","Distribution",skewness(vFE),"",undefined,"Asymétrie de la distribution (>0 = queue à droite, grands pics ponctuels)","ratio");
  add("skew_fs","Asymétrie flux sortants","Distribution",skewness(vFS),"",undefined,"Asymétrie de la distribution des flux sortants","ratio");
  add("kurt_fe","Kurtosis flux entrants","Distribution",kurtosis(vFE),"",undefined,"Aplatissement de la distribution (>0 = queues épaisses, valeurs extrêmes fréquentes)","ratio");
  add("kurt_fs","Kurtosis flux sortants","Distribution",kurtosis(vFS),"",undefined,"Aplatissement de la distribution des flux sortants","ratio");

  // ── 18. Retournements de tendance ─────────────────────────────────────────
  let reversals=0;
  for(let i=1;i<growthArrFE.length;i++){
    if((growthArrFE[i]>0&&growthArrFE[i-1]<0)||(growthArrFE[i]<0&&growthArrFE[i-1]>0)) reversals++;
  }
  add("reversals_fe","Nombre de retournements (flux ent.)","Retournements",reversals,"",undefined,"Nombre de fois où les flux entrants changent de direction (hausse↔baisse)","entier");
  add("freq_rev_fe","Fréquence retournements flux ent.","Retournements",n>1?reversals/(n-1)*100:null,"%",undefined,"% d'années avec changement de direction des flux entrants","pourcentage");

  // ── 19. Distance au pic ───────────────────────────────────────────────────
  add("dist_max_fe","Distance au pic flux entrants","Position",maxFE&&lastFE?((lastFE.v-maxFE.v)/Math.abs(maxFE.v)*100):null,"%",undefined,"Écart entre la valeur actuelle et le pic historique","pourcentage");
  add("dist_max_fs","Distance au pic flux sortants","Position",maxFS&&lastFS?((lastFS.v-maxFS.v)/Math.abs(maxFS.v)*100):null,"%",undefined,"Écart entre la valeur actuelle et le pic historique des flux sortants","pourcentage");

  // ── 20. Ratios stock/flux ─────────────────────────────────────────────────
  add("part5_se","Contribution 5 ans au stock entrant","Position",lastSE&&FE.length>=5?(vFE.slice(-5).reduce((a,b)=>a+b,0)/lastSE.v*100):null,"%",undefined,"Part des 5 dernières années de flux dans le stock entrant actuel","pourcentage");
  add("part5_ss","Contribution 5 ans au stock sortant","Position",lastSS&&FS.length>=5?(vFS.slice(-5).reduce((a,b)=>a+b,0)/lastSS.v*100):null,"%",undefined,"Part des 5 dernières années de flux dans le stock sortant actuel","pourcentage");

  // ── 21. Bonus ─────────────────────────────────────────────────────────────
  const regularite=n>0?vFE.filter(v=>v>0).length/n*100:null;
  add("regularite_fe","Indice de régularité flux entrants","Bonus",regularite,"%",undefined,"% d'années avec flux entrants positifs sur la période","pourcentage");
  const moy_hist_fe=mean(vFE), moy5_fe=mm5(vFE);
  add("vs_moy_fe","Dernière vs moyenne historique","Bonus",lastFE&&moy_hist_fe?((lastFE.v-moy_hist_fe)/Math.abs(moy_hist_fe)*100):null,"%",undefined,"Écart entre dernière valeur et moyenne historique (+= au-dessus)","pourcentage");

  // Meilleure décennie
  let bestDecVal=null, bestDecLabel=null;
  for(let yr=Math.floor((anneeMin||1990)/10)*10;yr<=(anneeMax||2024)-9;yr+=10){
    const dec=vFE.filter((_,i)=>FE[i]?.annee>=yr&&FE[i]?.annee<yr+10);
    if(dec.length>=5){ const m=mean(dec); if(bestDecVal===null||m>bestDecVal){bestDecVal=m;bestDecLabel=`${yr}s`;} }
  }
  add("best_dec_fe","Meilleure décennie flux entrants","Bonus",bestDecVal,"M$",undefined,`Décennie avec la meilleure moyenne de flux entrants (${bestDecLabel||"N/A"})` ,"monnaie");

  const sn_fe_ratio = moy5_fe&&moy_hist_fe?(moy5_fe/moy_hist_fe):null;
  add("recent_vs_hist","Tendance récente vs historique","Bonus",sn_fe_ratio?((sn_fe_ratio-1)*100):null,"%",undefined,"Moyenne 5 ans vs moyenne historique — positif = accélération récente","pourcentage");

  return R;
}

// ── KPIs affichés par défaut ──────────────────────────────────────────────────
export const KPI_DEFAUT = ["fe_last","fs_last","se_last","ss_last","fn_last"];

// ── Formater une valeur KPI ───────────────────────────────────────────────────
export function fmtKpi(kpi: KpiResult): string {
  if (kpi.valeur === null || kpi.valeur === undefined || isNaN(kpi.valeur)) return "N/A";
  const v = kpi.valeur;
  const nf1 = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  switch(kpi.format) {
    case "monnaie":
    case "monnaie_signe": {
      const abs=Math.abs(v);
      const sign = kpi.format==="monnaie_signe"&&v>0?"+":"";
      // Valeurs en millions USD — style commun : fr-FR, 1 décimale, « Md $ / M $ »
      if(abs>=1000) return `${sign}${nf1(v/1000)} Md $`;
      return `${sign}${Math.round(v).toLocaleString("fr-FR")} M $`;
    }
    case "pourcentage": return `${v>0?"+":""}${nf1(v)} %`;
    case "ratio":       return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    case "entier":      return Math.round(v).toLocaleString("fr-FR");
    case "annee":       return Math.round(v).toString();
    default:            return nf1(v);
  }
}
