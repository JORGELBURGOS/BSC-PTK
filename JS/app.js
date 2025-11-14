/* ======================= GENERADOR DE DATOS (semilla fija) ======================= */
function PRNG(seed=123456){
  let t=seed;
  return ()=> (t=(t*1664525+1013904223)%4294967296)/4294967296;
}
const rnd = PRNG(20251113); // estable: siempre mismos datos

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function jitter(base,vol){
  const f = (rnd()*2-1)*vol;
  return base*(1+f);
}

/* Periodos: 2025-01 .. 2025-12 (12 seleccionables),
   pero guardamos historia desde 2024-01 (24 meses) para YOY y series */
const PERIODOS_ALL = [];
for(let y=2024;y<=2025;y++){
  for(let m=1;m<=12;m++){
    PERIODOS_ALL.push(`${y}-${String(m).padStart(2,'0')}`);
  }
}
const PERIODOS_SELECT = PERIODOS_ALL.filter(p=>p.startsWith('2025-')); // 12 periodos visibles

/* ======================= DEFINICIÓN DE KPIs (plantillas) ======================= */
const PLANTILLAS = {
  FIN: [
    { n:"Margen Bruto", u:"%", pol:"up", base:22.0, meta:24.0, warn:21.5, pres:24.0 },
    { n:"EBITDA / Ventas", u:"%", pol:"up", base:10.5, meta:12.0, warn:9.5, pres:12.0 },
    { n:"Flujo de Caja Operativo", u:"MM USD", pol:"up", base:1.5, meta:2.0, warn:1.2, pres:2.0 },
    { n:"Rotación de Inventarios", u:"x", pol:"up", base:6.8, meta:7.2, warn:6.3, pres:7.0 },
  ],
  CLI: [
    { n:"OTIF", u:"%", pol:"up", base:90, meta:95, warn:88, pres:94 },
    { n:"Tasa de reacuerdos", u:"%", pol:"down", base:8.5, meta:5.0, warn:7.5, pres:6.0 },
    { n:"Reclamos por mil órdenes", u:"‱", pol:"down", base:4.2, meta:2.5, warn:3.8, pres:2.8 },
    { n:"NPS", u:"pts", pol:"up", base:52, meta:60, warn:48, pres:58 },
  ],
  PRO: [
    { n:"OEE", u:"%", pol:"up", base:58, meta:68, warn:60, pres:65 },
    { n:"Scrap", u:"%", pol:"down", base:3.2, meta:2.0, warn:3.0, pres:2.4 },
    { n:"MTTR", u:"min", pol:"down", base:42, meta:32, warn:40, pres:36 },
    { n:"MTBF", u:"h", pol:"up", base:38, meta:48, warn:38, pres:44 },
  ],
  APR: [
    { n:"Horas de capacitación / persona", u:"h", pol:"up", base:14, meta:24, warn:16, pres:20 },
    { n:"Ideas de mejora implementadas", u:"/mes", pol:"up", base:14, meta:25, warn:12, pres:20 },
    { n:"Cumplimiento 5S", u:"%", pol:"up", base:70, meta:85, warn:72, pres:80 },
    { n:"Cobertura de roles críticos", u:"%", pol:"up", base:64, meta:80, warn:68, pres:75 },
  ],
  SUS: [
    { n:"Consumo de energía / t", u:"kWh/t", pol:"down", base:440, meta:390, warn:430, pres:400 },
    { n:"Emisiones CO₂ / t", u:"kg/t", pol:"down", base:205, meta:170, warn:200, pres:180 },
    { n:"Residuos reciclados", u:"%", pol:"up", base:58, meta:75, warn:60, pres:70 },
  ]
};

/* genera 24 meses por KPI con leve tendencia hacia meta/pres */
function generaSerie(k){
  const arr = [];
  let v = k.base;
  for(let i=0;i<24;i++){
    const dir = (k.pol==="up" ? +1 : -1);
    const bias = dir * 0.006; // empuje suave a la mejora
    v = v*(1+bias) + (rnd()*2-1)*(k.u==="%"?0.6:(k.u==="MM USD"?0.06:(k.u==="x"?0.04:(k.u==="min"||k.u==="h"?0.9:0.9))));
    if(k.pol==="up") v = Math.max(v, k.warn*0.85);
    else v = Math.min(v, k.warn*1.2);
    arr.push(Number(v.toFixed(k.u==="%"?1:(k.u==="MM USD"?2:(k.u==="‱"?1:(k.u==="x"?1:0))))));
  }
  return arr;
}

/* construye el dataset completo */
function buildData(){
  const persp = [];
  const grupos = [
    {code:"FIN", id:"fin", nombre:"Financiera"},
    {code:"CLI", id:"cli", nombre:"Cliente"},
    {code:"PRO", id:"pro", nombre:"Procesos"},
    {code:"APR", id:"apr", nombre:"Aprendizaje"},
    {code:"SUS", id:"sus", nombre:"Sostenibilidad"},
  ];
  for(const g of grupos){
    const kpis = PLANTILLAS[g.code].map(t=>{
      const s = generaSerie(t);
      const hist = {};
      PERIODOS_ALL.forEach((per, idx)=>{
        const a = s[idx];
        hist[per] = {
          a,
          pres: t.pres,
          meta: t.meta,
          warn: t.warn
        };
      });
      const br = [
        {seg:"Línea A", a:jitter(t.base,0.1), t:t.meta, u:t.u, pol:t.pol},
        {seg:"Línea B", a:jitter(t.base*1.02,0.1), t:t.meta, u:t.u, pol:t.pol}
      ];
      return { n:t.n, u:t.u, pol:t.pol, s, br, hist };
    });
    persp.push({code:g.code, id:g.id, nombre:g.nombre, kpis});
  }
  return persp;
}

const DATA = {
  periodosSelect: PERIODOS_SELECT,
  periodosAll: PERIODOS_ALL,
  perspectivas: buildData()
};

/* ======================= HELPERS UI ======================= */
const $ = sel => document.querySelector(sel);
const summary = $("#summary");
const blocks = { FIN:$("#fin .grid"), CLI:$("#cli .grid"), PRO:$("#pro .grid"), APR:$("#apr .grid"), SUS:$("#sus .grid") };

function fmt(v,u){
  if(u==="%") return v.toFixed(1)+"%";
  if(u==="MM USD") return v.toFixed(2)+" MM";
  if(u==="‱") return v.toFixed(1);
  if(u==="h"||u==="min"||u==="pts"||u==="/mes") return v.toFixed(0)+" "+(u==="/mes"?"/mes":u);
  if(u==="x") return v.toFixed(1)+"x";
  if(u==="kWh/t"||u==="kg/t") return v.toFixed(0)+" "+u;
  return v.toFixed(1)+" "+(u||"");
}
function state(pol,a,meta,warn){
  if(pol==="up") return a>=meta?"good":(a>=warn?"warn":"bad");
  return a<=meta?"good":(a<=warn?"warn":"bad");
}
function pctDiff(cur, ref, pol){
  if(ref===0||ref==null) return null;
  const d = ((cur-ref)/ref)*100;
  const sign = (pol==="up" ? d : -d);
  return sign;
}
function gaugeColor(pct){
  if(pct>=70) return "good";
  if(pct>=40) return "warn";
  return "bad";
}

/* ======================= RENDER ======================= */
const selPeriodo = $("#selPeriodo");
DATA.periodosSelect.forEach(p=>{
  const opt=document.createElement("option");
  opt.textContent=p; opt.value=p;
  selPeriodo.appendChild(opt);
});
selPeriodo.value = DATA.periodosSelect[DATA.periodosSelect.length-1];

function renderSummary(periodo){
  summary.innerHTML="";
  DATA.perspectivas.forEach(p=>{
    const total=p.kpis.length;
    const greens=p.kpis.filter(k=>{
      const h=k.hist[periodo];
      return state(k.pol,h.a,h.meta,h.warn)==="good";
    }).length;
    const pct=Math.round((greens/total)*100);
    const tile=document.createElement("div");
    tile.className="tile";
    tile.innerHTML=`
      <h3>${p.nombre}</h3>
      <div class="gauge"><div class="bar ${gaugeColor(pct)}" style="width:${pct}%"></div></div>
      <div class="pct">${greens}/${total} indicadores favorables — ${pct}%</div>
    `;
    summary.appendChild(tile);
  });
}

function sparkPath(arr,color){
  const min=Math.min(...arr), max=Math.max(...arr);
  const norm=v=>26-((v-min)/(max-min||1))*24;
  const step=100/(arr.length-1);
  let d=`M 0 ${norm(arr[0]).toFixed(2)} `;
  arr.forEach((v,i)=> d+=`L ${(i*step).toFixed(2)} ${norm(v).toFixed(2)} `);
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
}

let currentCmp="mes";

document.querySelectorAll("button.toggle").forEach(b=>{
  b.addEventListener("click",()=> {
    document.querySelectorAll("button.toggle").forEach(x=>x.setAttribute("aria-pressed","false"));
    b.setAttribute("aria-pressed","true");
    currentCmp = b.dataset.cmp;
    renderAll();
  });
});

function refPeriodo(periodo){
  const idx = DATA.periodosAll.indexOf(periodo);
  if(currentCmp==="mes") return DATA.periodosAll[idx-1] ?? null;
  if(currentCmp==="tri") return DATA.periodosAll[idx-3] ?? null;
  if(currentCmp==="anio") return DATA.periodosAll[idx-12] ?? null;
  return "PRES";
}

function renderBlocks(periodo, filter=""){
  Object.values(blocks).forEach(el=>el.innerHTML="");
  const ref = refPeriodo(periodo);

  DATA.perspectivas.forEach(p=>{
    const grid = blocks[p.code];
    p.kpis
      .filter(k=>!filter || k.n.toLowerCase().includes(filter.toLowerCase()))
      .forEach(k=>{
        const h = k.hist[periodo];
        const st = state(k.pol,h.a,h.meta,h.warn);
        let deltaStr = "";
        if(ref==="PRES"){
          const d = pctDiff(h.a, h.pres, k.pol);
          deltaStr = (d==null?"":"Δ vs Pres: "+(d>=0?"+":"")+d.toFixed(1)+"%");
        }else if(ref && k.hist[ref]){
          const d = pctDiff(h.a, k.hist[ref].a, k.pol);
          deltaStr = (d==null?"":`Δ vs ${ref}: `+(d>=0?"+":"")+d.toFixed(1)+"%");
        }

        const series12 = k.s.slice(-12);
        const card = document.createElement("div");
        card.className="kpi";
        card.setAttribute("role","button");
        card.innerHTML=`
          <div class="head">
            <span class="chip">${k.u}</span>
            <div class="name">${k.n}</div>
            <div class="sema ${st}" title="estado"></div>
          </div>
          <div class="vals">
            <div class="actual">${fmt(h.a,k.u)}</div>
            <div class="budget">Budget: <b>${fmt(h.pres,k.u)}</b> | Meta: <b>${fmt(h.meta,k.u)}</b></div>
            <div class="delta">${deltaStr}</div>
          </div>
          <div class="trend">
            <svg viewBox="0 0 100 28" preserveAspectRatio="none">
              ${sparkPath(series12, st==="good"?"#16c172":(st==="warn"?"#ffbf3c":"#ff5d5d"))}
            </svg>
          </div>
        `;
        card.addEventListener("click",()=>openModal(`${p.nombre} • ${k.n}`,k,periodo));
        grid.appendChild(card);
      });
  });
}

/* ======================= MODAL ======================= */
const modal=$("#modal"),
      dlgTitle=$("#dlgTitle"),
      dlgSpark=$("#dlgSpark"),
      dlgTbody=$("#dlgTbody"),
      btnClose=$("#btnClose");

btnClose.onclick=()=>modal.classList.remove("show");
modal.addEventListener("click",(e)=>{ if(e.target===modal) modal.classList.remove("show") });

function openModal(title,k,periodo){
  dlgTitle.textContent=title;
  renderSparkBig(k);
  renderBreakdown(k,periodo);
  modal.classList.add("show");
}

function renderSparkBig(k){
  const w=dlgSpark.clientWidth||800, h=200, pad=18;
  dlgSpark.setAttribute("viewBox",`0 0 ${w} ${h}`); dlgSpark.innerHTML="";
  const min=Math.min(...k.s), max=Math.max(...k.s);
  const y=v=>(h-pad)-((v-min)/(max-min||1))*(h-2*pad), step=(w-2*pad)/(k.s.length-1);
  for(let i=0;i<5;i++){
    const y0=pad+i*((h-2*pad)/4);
    const l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",pad); l.setAttribute("x2",w-pad);
    l.setAttribute("y1",y0); l.setAttribute("y2",y0);
    l.setAttribute("stroke","#22325c"); l.setAttribute("stroke-dasharray","3 4");
    dlgSpark.appendChild(l);
  }
  const mkLine=(val,col)=>{
    const L=document.createElementNS("http://www.w3.org/2000/svg","line");
    L.setAttribute("x1",pad); L.setAttribute("x2",w-pad);
    L.setAttribute("y1",y(val)); L.setAttribute("y2",y(val));
    L.setAttribute("stroke",col); L.setAttribute("stroke-width","1.2");
    L.setAttribute("stroke-dasharray","6 6"); return L;
  };
  const ejemploHist = k.hist[DATA.periodosSelect[0]];
  const meta = ejemploHist.meta;
  const warn = ejemploHist.warn;
  dlgSpark.appendChild(mkLine(meta,"#16c172"));
  dlgSpark.appendChild(mkLine(warn,"#ffbf3c"));
  let d=`M ${pad} ${y(k.s[0]).toFixed(2)} `;
  k.s.forEach((v,i)=> d+=`L ${(pad+i*step).toFixed(2)} ${y(v).toFixed(2)} `);
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d",d); path.setAttribute("fill","none");
  path.setAttribute("stroke","#5aa9ff"); path.setAttribute("stroke-width","2.2");
  dlgSpark.appendChild(path);
}

function renderBreakdown(k,periodo){
  dlgTbody.innerHTML="";
  const h = k.hist[periodo];
  const metas = { meta: h.meta, warn: h.warn };
  (k.br||[]).forEach(r=>{
    const pol=r.pol||k.pol||"up";
    const estado = state(pol, r.a, metas.meta, metas.warn);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${r.seg}</td>
      <td>${fmt(r.a,r.u||k.u)}</td>
      <td>${fmt(metas.meta,r.u||k.u)}</td>
      <td><span class="pill ${estado}">${estado.toUpperCase()}</span></td>`;
    dlgTbody.appendChild(tr);
  });
}

/* ======================= MAPA CAUSA-EFECTO ======================= */
function drawMap(periodo){
  const svg = $("#map"); svg.innerHTML="";
  const W=800,H=240, pad=40;
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  const g=document.createElementNS("http://www.w3.org/2000/svg","g");
  svg.appendChild(g);
  const nodes=[
    {id:"APR",x:pad,y:pad,w:180,h:48,t:"Aprendizaje"},
    {id:"PRO",x:pad+190,y:pad+60,w:180,h:48,t:"Procesos"},
    {id:"CLI",x:pad+380,y:pad+120,w:180,h:48,t:"Cliente"},
    {id:"FIN",x:pad+570,y:pad+180,w:180,h:48,t:"Finanzas"},
  ];
  function nstate(code){
    const p=DATA.perspectivas.find(pp=>pp.code===code);
    const greens=p.kpis.filter(k=>{
      const h=k.hist[periodo]; return state(k.pol,h.a,h.meta,h.warn)==="good";
    }).length;
    const ratio=greens/p.kpis.length;
    return ratio>=0.7?"good":(ratio>=0.4?"warn":"bad");
  }
  function rect(n,cls){
    const r=document.createElementNS("http://www.w3.org/2000/svg","rect");
    r.setAttribute("x",n.x);r.setAttribute("y",n.y);
    r.setAttribute("width",n.w);r.setAttribute("height",n.h);
    r.setAttribute("rx","10");
    r.setAttribute("fill","#0f1526");
    r.setAttribute("stroke","#2a3b6b");
    r.setAttribute("stroke-width","1.4");
    g.appendChild(r);
    const text=document.createElementNS("http://www.w3.org/2000/svg","text");
    text.setAttribute("x",n.x+n.w/2);text.setAttribute("y",n.y+n.h/2+4);
    text.setAttribute("text-anchor","middle");
    text.setAttribute("fill","var(--ink)");
    text.textContent=n.t;g.appendChild(text);
    const badge=document.createElementNS("http://www.w3.org/2000/svg","circle");
    badge.setAttribute("cx",n.x+n.w-10);badge.setAttribute("cy",n.y+10);badge.setAttribute("r","6");
    badge.setAttribute("fill", cls==="good"?"#16c172":(cls==="warn"?"#ffbf3c":"#ff5d5d"));
    g.appendChild(badge);
  }
  function arrow(from,to,cls){
    const l=document.createElementNS("http://www.w3.org/2000/svg","line");
    l.setAttribute("x1",from.x+from.w); l.setAttribute("y1",from.y+from.h/2);
    l.setAttribute("x2",to.x); l.setAttribute("y2",to.y+to.h/2);
    l.setAttribute("stroke", cls==="good"?"#16c172":(cls==="warn"?"#ffbf3c":"#ff5d5d"));
    l.setAttribute("stroke-width","2");
    l.setAttribute("marker-end","url(#arr)"); g.appendChild(l);
  }
  const defs=document.createElementNS("http://www.w3.org/2000/svg","defs");
  const m=document.createElementNS("http://www.w3.org/2000/svg","marker");
  m.id="arr"; m.setAttribute("viewBox","0 0 10 10"); m.setAttribute("refX","10"); m.setAttribute("refY","5");
  m.setAttribute("markerWidth","6"); m.setAttribute("markerHeight","6"); m.setAttribute("orient","auto-start-reverse");
  const p=document.createElementNS("http://www.w3.org/2000/svg","path");
  p.setAttribute("d","M0 0 10 5 0 10z"); p.setAttribute("fill","#5aa9ff");
  m.appendChild(p); defs.appendChild(m); svg.appendChild(defs);

  const sAPR=nstate("APR"), sPRO=nstate("PRO"), sCLI=nstate("CLI"), sFIN=nstate("FIN");
  rect(nodes[0],sAPR); rect(nodes[1],sPRO); rect(nodes[2],sCLI); rect(nodes[3],sFIN);
  arrow(nodes[0],nodes[1],sAPR); arrow(nodes[1],nodes[2],sPRO); arrow(nodes[2],nodes[3],sCLI);
}

/* ======================= INTERACCIÓN ======================= */
function renderAll(){
  const periodo = selPeriodo.value;
  renderSummary(periodo);
  renderBlocks(periodo, $("#q").value.trim());
  drawMap(periodo);
}

$("#btnUpd").addEventListener("click", renderAll);
$("#q").addEventListener("input", e=> renderBlocks(selPeriodo.value, e.target.value.trim()));

renderAll();
