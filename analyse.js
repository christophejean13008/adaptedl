/* =====================================================================
   Adaptedl — analyse d'une page de manuel à partir de la sortie OCR.
   Entrée  : lignes = [{ words:[{text,x0,x1,y0,y1,conf}] }]   (ordre de lecture)
   Sortie  : { exercices:[...], ignores:[{numero,consigne,raison}] }

   Les numéros d'exercices des manuels récents sont des pastilles dessinées :
   l'OCR ne les voit pas. La structure est donc reconstruite sur deux
   signaux fiables : le verbe de consigne en tête de ligne, et les repères
   d'items « a. b. c. ».
   ===================================================================== */
(function (racine) {

const VERBES = {
  trous:     ['complete','remplace','ajoute','ecris','choisis','conjugue','insere','place','recris'],
  marquage:  ['souligne','entoure','surligne','coche','barre','repere','releve','trouve','indique','colorie','identifie','montre'],
  classement:['classe','range','trie','regroupe','repartis']
};
// consignes qui demandent d'écrire : rien à glisser, on les écarte proprement
const REFUS = ['recopie','transforme','mets','reecris','invente','redige','decris','explique','dessine','raconte','justifie','reponds','construis','compose','imagine','accorde','relie','associe','continue','termine'];

const LEXIQUES = [
  {cles:['determinant','article'], mots:['le','la',"l'",'les','un','une','des','du','au','aux','mon','ma','mes','ton','ta','tes','son','sa','ses','ce','cet','cette','ces']},
  {cles:['pronom personnel','pronom sujet','pronom'], mots:['je','tu','il','elle','on','nous','vous','ils','elles']},
  {cles:['preposition'], mots:['à','de','dans','sur','sous','par','pour','avec','sans','chez','vers','entre','depuis','pendant']},
  {cles:['conjonction','mot de liaison'], mots:['mais','ou','et','donc','or','ni','car','puis','quand']},
  {cles:['auxiliaire','etre ou avoir','verbe etre','verbe avoir'], mots:['est','sont','était','étaient','sera','seront','a','ont','avait','avaient']},
  {cles:['negation'], mots:['ne',"n'",'pas','plus','jamais','rien','personne','aucun']},
  {cles:['ponctuation','signe de ponctuation'], mots:['.',',',';',':','!','?','«','»']},
  {cles:['adjectif possessif'], mots:['mon','ma','mes','ton','ta','tes','son','sa','ses','notre','nos','votre','vos','leur','leurs']}
];

const sansAccent = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const mediane = t => { if(!t.length) return 0; const a=[...t].sort((x,y)=>x-y); return a[Math.floor(a.length/2)]; };
const MARQUEUR = /^[a-o]\s*[.)°]$|^[•▪●■·*–—]$|^[(\[]?\d{1,2}\s*[.)\]°]$/;
const NUMERO   = /^[(\[]?(\d{1,2})\s*[.)\]°]?$/;

function mesuresPage(lignes){
  const ecarts=[], hauteurs=[], sauts=[];
  let bas=null;
  for(const l of lignes){
    const m=(l.words||[]).filter(w=>String(w.text).trim());
    if(!m.length) continue;
    for(let i=1;i<m.length;i++){ const e=m[i].x0-m[i-1].x1; if(e>0&&e<400) ecarts.push(e); }
    for(const w of m) hauteurs.push(w.y1-w.y0);
    const haut=Math.min(...m.map(w=>w.y0));
    if(bas!=null){ const s=haut-bas; if(s>0&&s<300) sauts.push(s); }
    bas=Math.max(...m.map(w=>w.y1));
  }
  const ecart=mediane(ecarts)||10, hauteur=mediane(hauteurs)||30, saut=mediane(sauts)||hauteur*0.5;
  return {ecart, hauteur, saut,
          seuilTrou:Math.max(ecart*2.6,hauteur*0.55),
          seuilColonne:Math.max(ecart*5,hauteur*1.6),
          seuilSaut:Math.max(saut*2.2, hauteur*0.9)};
}

/* ---- caractérisation d'une ligne ---- */
function decrire(ligne){
  const mots=(ligne.words||[]).filter(w=>String(w.text).trim());
  if(!mots.length) return null;
  let utiles=mots, marqueur=null, numero=null;
  const t0=String(mots[0].text).trim();
  if(mots.length>1 && MARQUEUR.test(t0)){ marqueur=mots[0]; utiles=mots.slice(1); }
  else if(mots.length>1 && NUMERO.test(t0)){ numero=t0.match(NUMERO)[1]; utiles=mots.slice(1); }
  const nu=sansAccent(String(utiles[0].text).trim().replace(/[^A-Za-zÀ-ÿ'-]/g,''));
  const estVerbe=[...VERBES.trous,...VERBES.marquage,...VERBES.classement,...REFUS]
    .some(v => v===nu || (nu.length>=6 && v.startsWith(nu.slice(0,6))));
  return {mots, utiles, marqueur, numero, estVerbe,
          texte: utiles.map(w=>String(w.text).trim()).join(' '),
          x0: utiles[0].x0,
          y0: Math.min(...mots.map(w=>w.y0)),
          y1: Math.max(...mots.map(w=>w.y1))};
}

/* ---- machine à états : découpage de la page en exercices ---- */
function decouperBlocs(lignes, M){
  const d=lignes.map(decrire).filter(Boolean);
  const blocs=[]; let b=null, prec=null;
  for(const l of d){
    const saut = prec ? l.y0-prec.y1 : 0;
    prec = l;
    if(l.estVerbe && !l.marqueur){
      const suite = b && !b.items.length && b.consigne.length<3 && saut<M.seuilSaut
                 && !/[.:!?]\s*$/.test(b.consigne.map(x=>x.texte).join(' '));
      if(suite){ b.consigne.push(l); continue; }
      b={numero:l.numero, consigne:[l], items:[]}; blocs.push(b); continue;
    }
    if(!b) continue;
    if(l.marqueur){ b.items.push({ligne:l, suites:[]}); continue; }
    if(!b.items.length){
      const jusquici=b.consigne.map(x=>x.texte).join(' ');
      if(saut>=M.seuilSaut){ b=null; continue; }
      if(b.consigne.length<3 && !/[.:!?]\s*$/.test(jusquici)) b.consigne.push(l);
      else b.items.push({ligne:l, suites:[]});
      continue;
    }
    const dernier=b.items[b.items.length-1];
    const gauche=dernier.ligne.utiles[0].x0;
    if(saut<M.seuilSaut && l.x0>=gauche-M.ecart*2 && !l.estVerbe) dernier.suites.push(l);
    else b=null;
  }
  return blocs;
}

/* ---- segments texte / trou, les trous repérés à l'écartement ---- */
function segmenterMots(mots, M, ctx){
  const segs=[]; let tampon=[];
  const vider=()=>{ if(tampon.length){ segs.push({type:'texte', t:tampon.join(' ')}); tampon=[]; } };
  if(mots.length && ctx && ctx.gauche!=null && mots[0].x0-ctx.gauche>M.seuilTrou) segs.push({type:'trou'});
  for(let i=0;i<mots.length;i++){
    const t=String(mots[i].text).trim(); if(!t) continue;
    if(/^[.·…_\-]{2,}$/.test(t)||/^0{4,}$/.test(t)){ vider(); segs.push({type:'trou'}); continue; }
    if(i>0 && mots[i].x0-mots[i-1].x1>M.seuilTrou){ vider(); segs.push({type:'trou'}); }
    tampon.push(t);
  }
  vider();
  return segs.filter((s,i)=>!(s.type==='trou'&&segs[i-1]&&segs[i-1].type==='trou'));
}
function melanger(a){const t=[...a];for(let i=t.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[t[i],t[j]]=[t[j],t[i]];}return t;}

/* ---- transformation d'un bloc en exercice ---- */
function convertir(bloc, M, rang){
  const consigne=bloc.consigne.map(l=>l.texte).join(' ').replace(/\s+/g,' ').trim();
  const c=sansAccent(consigne);
  const numero=bloc.numero||String(rang);
  const contient=liste=>liste.some(v=>new RegExp('\\b'+v+'z?\\b').test(c));
  const ecarter=raison=>({ignore:{numero, consigne, raison}});

  let type = contient(VERBES.marquage) ? 'marquage'
           : contient(VERBES.classement) ? 'classement'
           : contient(VERBES.trous) ? 'trous' : null;
  if(!type) return ecarter("cette consigne demande d'écrire, pas de manipuler des étiquettes");
  if(!bloc.items.length) return ecarter("aucune phrase n'a été lue sous la consigne");

  const ex={numero, consigne, consigne_dite:'', type, items:[], categories:[], etiquettes:[],
            reutilisable:false, cible:'', avecCle:false, reponses:{}, tri:{}, marques:{}, nbReponses:0};

  const apres=consigne.includes(':')?consigne.slice(consigne.lastIndexOf(':')+1):'';
  const donnee=apres.split(/[,;•]| et /).map(s=>s.replace(/[.]$/,'').trim()).filter(s=>s&&s.length<24);

  if(type==='classement'){
    for(const it of bloc.items){
      const m=it.ligne.utiles;
      if(m.length<2||m.length>4) continue;
      let large=true;
      for(let k=1;k<m.length;k++) if(m[k].x0-m[k-1].x1<M.seuilColonne) large=false;
      if(large){ ex.categories=m.map((w,k)=>({id:'c'+k,nom:String(w.text).trim(),reponses:[]})); break; }
    }
    if(!ex.categories.length && donnee.length>=2 && donnee.length<=4)
      ex.categories=donnee.map((n,k)=>({id:'c'+k,nom:n,reponses:[]}));
    if(!ex.categories.length) return ecarter("les colonnes du tableau n'ont pas été reconnues");
    const mots=donnee.filter(m=>!ex.categories.some(k=>sansAccent(k.nom)===sansAccent(m)));
    if(mots.length<2) return ecarter("la liste des mots à classer est absente");
    ex.etiquettes=melanger(mots).map((t,k)=>({id:'e'+k,texte:t}));
    ex.nbReponses=ex.etiquettes.length;
    return {ex};
  }

  for(const it of bloc.items){
    const gauche=it.ligne.marqueur?it.ligne.marqueur.x1:null;
    let segs=segmenterMots(it.ligne.utiles,M,{gauche});
    for(const s of it.suites) segs=segs.concat(segmenterMots(s.mots,M,{gauche:null}));
    if(segs.length) ex.items.push({segments:segs});
  }
  if(!ex.items.length) return ecarter("aucune phrase n'a été lue sous la consigne");

  if(type==='marquage'){
    const verbe=VERBES.marquage.find(v=>new RegExp('\\b'+v+'z?\\b').test(c));
    const i=c.search(new RegExp('\\b'+verbe+'z?\\b'));
    let cible=consigne.slice(i).split(/\s+/).slice(1).join(' ');
    cible=cible.split(/\bdans\b|\bde ces\b|[.:]/)[0].trim();
    ex.cible=cible||'les mots demandés';
    ex.items.forEach(it=>{ it.segments=it.segments.filter(s=>s.type!=='trou'); });
    return {ex};
  }

  const nb=ex.items.reduce((n,it)=>n+it.segments.filter(s=>s.type==='trou').length,0);
  if(!nb) return ecarter("aucun emplacement à compléter n'a été repéré");
  ex.items.forEach(it=>it.segments.forEach(s=>{ if(s.type==='trou') s.id='t'+Math.random().toString(36).slice(2,8); }));

  if(donnee.length>=2) ex.etiquettes=melanger(donnee).map((t,k)=>({id:'e'+k,texte:t}));
  else{
    const lex=LEXIQUES.find(L=>L.cles.some(k=>c.includes(sansAccent(k))));
    if(!lex) return ecarter("les réponses possibles ne sont pas déductibles de la page");
    ex.etiquettes=lex.mots.map((t,k)=>({id:'e'+k,texte:t}));
    ex.reutilisable=true;
  }
  ex.nbReponses=nb;
  return {ex};
}

function analyser(lignes){
  const M=mesuresPage(lignes);
  const exercices=[], ignores=[];
  decouperBlocs(lignes,M).forEach((b,i)=>{
    let r; try{ r=convertir(b,M,i+1); }catch(e){ r={ignore:null}; }
    if(r.ex) exercices.push(r.ex);
    else if(r.ignore&&r.ignore.consigne) ignores.push(r.ignore);
  });
  return {exercices, ignores, mesures:M};
}

function versSource(res){
  return res.exercices.map(ex=>{
    const l=[`${ex.numero}. ${ex.consigne}`];
    if(ex.type==='classement'){
      ex.categories.forEach(c=>l.push(`> ${c.nom} : `));
      l.push('+ '+ex.etiquettes.map(e=>e.texte).join(', '));
    } else if(ex.type==='marquage'){
      l.push(`= ${ex.cible}`);
      ex.items.forEach(it=>l.push(it.segments.map(s=>s.t).join(' ')));
    } else {
      ex.items.forEach(it=>l.push(it.segments.map(s=>s.type==='trou'?'[ ]':s.t).join(' ')));
      if(!ex.reutilisable) l.push('+ '+ex.etiquettes.map(e=>e.texte).join(', '));
    }
    return l.join('\n');
  }).join('\n\n');
}

const API={analyser, versSource, mesuresPage, decouperBlocs};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else racine.Analyse=API;

})(typeof window!=='undefined'?window:globalThis);
