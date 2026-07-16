'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { useSession, signIn, signOut } from "next-auth/react";
import { dbLoadSettings, dbSaveSettings, dbLoadDesigns, dbSaveDesign, dbDeleteDesign, dbSaveLead, useCloud, dbLoadAccount, dbSetAccount, dbAdminCompanies, dbUploadARModel, dbAdminCompanyDetail, dbAdminCompanyLeads, dbAdminUpdateCompany, dbAdminSetNote } from "../lib/db";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";

const USE_GOOGLE = process.env.NEXT_PUBLIC_USE_GOOGLE === "true";
// Platform owners (super admins). Comma-separated in env, with fallback.
const SUPER_ADMINS=(process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS||"praveendealmeida@gmail.com,jaypraveengraffiti@gmail.com").toLowerCase().split(",").map(s=>s.trim());
const PLANS=[
  {id:"starter",name:"Starter",tier:"starter",price:14900,onboarding:15000},
  {id:"pro",name:"Pro",tier:"pro",price:24900,onboarding:25000},
];
const SOCIAL_ADDONS=[
  {id:"social-starter",name:"Social Media — Starter",price:20000},
  {id:"social-growth",name:"Social Media — Growth",price:55000},
  {id:"social-premium",name:"Social Media — Premium",price:75000},
];
const planLabel=p=>p?`${p.name||p.id} — Rs. ${(p.price??0).toLocaleString('en-LK')}/mo`:"";
const isProPlan=(planId,plans)=>{const p=(plans||PLANS).find(x=>x.id===planId);return (p?.tier||"starter")==="pro";};

// ─── PERSISTENT STORAGE (localStorage w/ in-memory fallback) ──
const _mem={};
const store={
  get(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):(_mem[k]??null);}catch(e){return _mem[k]??null;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){_mem[k]=v;}},
};

// ─── DEFAULT DATA ────────────────────────────────────────────
const DEFAULT_MATERIALS=[
  {id:"warm-white",name:"Warm White",color:"#F2EDE6"},{id:"ivory",name:"Ivory Cream",color:"#E8DCCA"},
  {id:"light-oak",name:"Light Oak",color:"#C9A96E"},{id:"teak",name:"Classic Teak",color:"#A0713C"},
  {id:"walnut",name:"Dark Walnut",color:"#5C3A1E"},{id:"graphite",name:"Graphite",color:"#3E3E40"},
  {id:"slate",name:"Slate Grey",color:"#6B6E72"},{id:"linen",name:"Linen Beige",color:"#C8BAA7"},
  {id:"sage",name:"Sage Green",color:"#7D8B6E"},{id:"navy",name:"Navy Blue",color:"#1E2A3A"},
];
const DEFAULT_ACCESSORIES=[
  {id:"finger-groove",name:"Finger Groove",desc:"Routed groove on doors",price:500,per:"per door",icon:"〰️",perDoor:true},
  {id:"matte-handles",name:"Matte Black Handles",desc:"Modern bar handles",price:750,per:"per door",icon:"▬",perDoor:true},
  {id:"mirror",name:"Mirror (1 Door)",desc:"Full-length mirror",price:4500,per:"one-time",icon:"M"},
  {id:"led-strip",name:"LED Strip",desc:"Warm white LED inside",price:3500,per:"per section",icon:"L",perSection:true},
  {id:"motion-sensor",name:"Motion Sensor Light",desc:"Auto-on when door opens",price:2800,per:"one-time",icon:"S"},
  {id:"shoe-rack-fixed",name:"Shoe Rack (Fixed)",desc:"Angled shoe shelf",price:3500,per:"per unit",icon:"F"},
  {id:"shoe-rack-pullout",name:"Pull-out Shoe Rack",desc:"Sliding shoe tray",price:6500,per:"per unit",icon:"P"},
  {id:"saree-section",name:"Saree Section",desc:"Pull-out saree rod",price:4000,per:"per unit",icon:"R"},
  {id:"handbag-section",name:"Handbag Section",desc:"Hooks + shelf",price:3000,per:"per unit",icon:"H"},
  {id:"locker",name:"Locker",desc:"Lockable compartment",price:5500,per:"per unit",icon:"K"},
];
const MODULE_TYPES=[{id:"shelf",name:"Shelf",icon:"━"},{id:"drawer",name:"Drawer",icon:"▤"},{id:"rail",name:"Hanging Rail",icon:"⊶"}];
const DOOR_STYLES=[{id:"none",name:"Open",multiplier:0},{id:"hinged",name:"Hinged",multiplier:1.0},{id:"sliding",name:"Sliding",multiplier:1.35}];
const HINGED_MIN=457.2,HINGED_MAX=609.6,SLIDING_MIN=609.6,SLIDING_MAX=914.4,SLIDING_MIN_WIDTH=1219.2,TOP_CUPBOARD_MM=1981,SHELF_SPACING_MM=381,PANEL_THICKNESS=15;
const DEFAULT_PRICE_PER_SQFT=7000;
const BRAND="Plan My Wardrobe";

// Settings: per-user customizable. Falls back to defaults.
const DEFAULT_BUSINESS={name:"Plan My Wardrobe",tagline:"Wardrobe Studio",logo:"",address:"",phone:"",email:"",terms:"Prices are estimates and exclude delivery & installation unless stated. Quote valid 14 days.",accent:"#EFC01E"};
const DEFAULT_PAYMENT={bankName:"",accountName:"",accountNumber:"",branch:"",advancePct:50,discountPct:0};
const DEFAULT_DOOR_PRICING={none:6500,hinged:7000,sliding:8500};
function loadSettings(email){
  const s=store.get(`settings_${email}`);
  const base={pricePerSqft:DEFAULT_PRICE_PER_SQFT,materials:DEFAULT_MATERIALS,accessories:DEFAULT_ACCESSORIES,business:DEFAULT_BUSINESS};
  if(!s)return base;
  return {...base,...s,business:{...DEFAULT_BUSINESS,...(s.business||{})}};
}
function saveSettings(email,settings){store.set(`settings_${email}`,settings);}

const PRESETS=[
  {id:"compact",name:"Compact Starter",tag:"2 Door",badge:"Boarding rooms / small apartments",width:ftM(4),height:ftM(6.5),depth:560,sections:2,doorStyle:"hinged",slidingPanels:2,modules:[{type:"rail",section:0,yNorm:0.92},{type:"shelf",section:1,yNorm:0.22},{type:"shelf",section:1,yNorm:0.42},{type:"shelf",section:1,yNorm:0.62},{type:"drawer",section:1,yNorm:0.08},{type:"drawer",section:0,yNorm:0.08}]},
  {id:"balanced",name:"Balanced Daily Use",tag:"3 Door",badge:"Most popular — middle-class homes",width:ftM(5.5),height:ftM(7),depth:560,sections:3,doorStyle:"hinged",slidingPanels:2,modules:[{type:"rail",section:0,yNorm:0.92},{type:"rail",section:1,yNorm:0.92},{type:"shelf",section:1,yNorm:0.42},{type:"shelf",section:1,yNorm:0.22},{type:"drawer",section:2,yNorm:0.15},{type:"drawer",section:2,yNorm:0.28},{type:"drawer",section:2,yNorm:0.41}]},
  {id:"family-compact",name:"Family Compact",tag:"3 Door + Top",badge:"Good upsell option",width:ftM(6),height:ftM(8),depth:560,sections:3,doorStyle:"hinged",slidingPanels:2,modules:[{type:"rail",section:0,yNorm:0.78},{type:"rail",section:1,yNorm:0.78},{type:"shelf",section:2,yNorm:0.16},{type:"shelf",section:2,yNorm:0.30},{type:"shelf",section:2,yNorm:0.44},{type:"shelf",section:2,yNorm:0.58},{type:"drawer",section:0,yNorm:0.08},{type:"drawer",section:1,yNorm:0.08}]},
  {id:"premium-couple",name:"Premium Couple",tag:"4 Door",badge:"Target: newly married couples",width:ftM(7),height:ftM(8),depth:580,sections:4,doorStyle:"hinged",slidingPanels:2,modules:[{type:"rail",section:0,yNorm:0.78},{type:"rail",section:0,yNorm:0.40},{type:"rail",section:3,yNorm:0.78},{type:"shelf",section:1,yNorm:0.16},{type:"shelf",section:1,yNorm:0.32},{type:"shelf",section:1,yNorm:0.48},{type:"shelf",section:2,yNorm:0.48},{type:"shelf",section:2,yNorm:0.32},{type:"drawer",section:1,yNorm:0.06},{type:"drawer",section:2,yNorm:0.06},{type:"drawer",section:2,yNorm:0.18},{type:"drawer",section:3,yNorm:0.06}]},
  {id:"storage-heavy",name:"Storage Heavy",tag:"4 Door",badge:"For customers who fold mostly",width:ftM(6.5),height:ftM(7.5),depth:560,sections:4,doorStyle:"hinged",slidingPanels:2,modules:[{type:"rail",section:0,yNorm:0.90},{type:"shelf",section:1,yNorm:0.18},{type:"shelf",section:1,yNorm:0.36},{type:"shelf",section:1,yNorm:0.54},{type:"shelf",section:2,yNorm:0.18},{type:"shelf",section:2,yNorm:0.36},{type:"shelf",section:3,yNorm:0.36},{type:"shelf",section:3,yNorm:0.54},{type:"drawer",section:2,yNorm:0.06},{type:"drawer",section:3,yNorm:0.06},{type:"drawer",section:3,yNorm:0.20},{type:"drawer",section:0,yNorm:0.06}]},
  {id:"luxury",name:"Luxury Vertical",tag:"5 Door",badge:"High-margin premium product",width:ftM(8),height:ftM(8),depth:600,sections:5,doorStyle:"sliding",slidingPanels:3,modules:[{type:"rail",section:0,yNorm:0.78},{type:"rail",section:1,yNorm:0.78},{type:"rail",section:2,yNorm:0.78},{type:"rail",section:2,yNorm:0.40},{type:"shelf",section:3,yNorm:0.18},{type:"shelf",section:3,yNorm:0.34},{type:"shelf",section:3,yNorm:0.50},{type:"shelf",section:4,yNorm:0.34},{type:"shelf",section:4,yNorm:0.50},{type:"shelf",section:4,yNorm:0.66},{type:"drawer",section:3,yNorm:0.06},{type:"drawer",section:4,yNorm:0.06},{type:"drawer",section:4,yNorm:0.19},{type:"drawer",section:0,yNorm:0.06}]},
  {id:"slim",name:"Slim Space Saver",tag:"2 Door Tall",badge:"Narrow rooms / urban houses",width:ftM(4.5),height:ftM(8),depth:530,sections:2,doorStyle:"hinged",slidingPanels:2,modules:[{type:"rail",section:0,yNorm:0.78},{type:"shelf",section:1,yNorm:0.18},{type:"shelf",section:1,yNorm:0.34},{type:"shelf",section:1,yNorm:0.50},{type:"shelf",section:1,yNorm:0.66},{type:"drawer",section:0,yNorm:0.06},{type:"drawer",section:0,yNorm:0.18}]},
  {id:"kids-parent",name:"Kids + Parent Combo",tag:"3 Door",badge:"Smart family pitch",width:ftM(6),height:ftM(7),depth:560,sections:3,doorStyle:"hinged",slidingPanels:2,modules:[{type:"rail",section:0,yNorm:0.90},{type:"rail",section:1,yNorm:0.45},{type:"shelf",section:1,yNorm:0.18},{type:"shelf",section:2,yNorm:0.18},{type:"shelf",section:2,yNorm:0.34},{type:"shelf",section:2,yNorm:0.50},{type:"shelf",section:2,yNorm:0.66},{type:"drawer",section:0,yNorm:0.06},{type:"drawer",section:0,yNorm:0.18},{type:"drawer",section:1,yNorm:0.06}]},
  {id:"mirror",name:"Mirror Focus",tag:"4 Door",badge:"Strong visual appeal — conversion",width:ftM(7),height:ftM(7.5),depth:560,sections:4,doorStyle:"hinged",slidingPanels:2,modules:[{type:"rail",section:0,yNorm:0.88},{type:"rail",section:3,yNorm:0.88},{type:"shelf",section:1,yNorm:0.20},{type:"shelf",section:1,yNorm:0.40},{type:"shelf",section:2,yNorm:0.20},{type:"shelf",section:2,yNorm:0.40},{type:"drawer",section:1,yNorm:0.06},{type:"drawer",section:2,yNorm:0.06},{type:"drawer",section:3,yNorm:0.06}]},
  {id:"full-max",name:"Full Storage Max",tag:"5 Door Wide",badge:"Premium villa / luxury homes",width:ftM(10),height:ftM(8),depth:600,sections:5,doorStyle:"sliding",slidingPanels:4,modules:[{type:"rail",section:0,yNorm:0.78},{type:"rail",section:4,yNorm:0.78},{type:"shelf",section:1,yNorm:0.18},{type:"shelf",section:1,yNorm:0.34},{type:"shelf",section:1,yNorm:0.50},{type:"shelf",section:2,yNorm:0.34},{type:"shelf",section:2,yNorm:0.50},{type:"shelf",section:3,yNorm:0.18},{type:"shelf",section:3,yNorm:0.34},{type:"shelf",section:3,yNorm:0.50},{type:"drawer",section:1,yNorm:0.06},{type:"drawer",section:2,yNorm:0.06},{type:"drawer",section:2,yNorm:0.18},{type:"drawer",section:3,yNorm:0.06},{type:"drawer",section:4,yNorm:0.06},{type:"drawer",section:4,yNorm:0.18}]},
];

// Auto-drawn wardrobe illustration for preset cards (Pickawood-style line art)
function presetThumb(p){
  const VW=320,VH=164,pad=18,wall=3;
  const sc=Math.min((VW-2*pad)/p.width,(VH-2*pad)/p.height);
  const w=p.width*sc,h=p.height*sc,ox=(VW-w)/2,oy=(VH-h)/2;
  const secs=p.sections,sw=(w-2*wall)/secs;
  const hasTop=/top/i.test(p.tag||"");const topY=hasTop?oy+h*0.24:null;
  const innerTop=hasTop?topY:oy+wall;
  let s=`<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">`;
  s+=`<ellipse cx="${(ox+w/2).toFixed(1)}" cy="${(oy+h+7).toFixed(1)}" rx="${(w*0.46).toFixed(1)}" ry="4.5" fill="#00000010"/>`;
  s+=`<rect x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="#fdfcfa" stroke="#d4cec4" stroke-width="2"/>`;
  if(hasTop)s+=`<line x1="${(ox+wall).toFixed(1)}" y1="${topY.toFixed(1)}" x2="${(ox+w-wall).toFixed(1)}" y2="${topY.toFixed(1)}" stroke="#e3ded4" stroke-width="1.5"/>`;
  for(let i=1;i<secs;i++){const x=ox+wall+i*sw;s+=`<line x1="${x.toFixed(1)}" y1="${(oy+wall).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(oy+h-wall).toFixed(1)}" stroke="#e3ded4" stroke-width="1.5"/>`;}
  (p.modules||[]).forEach(m=>{
    if(m.section>=secs)return;
    const sx=ox+wall+m.section*sw,ex=sx+sw,iL=sx+4,iR=ex-4,yy=oy+h-(m.yNorm)*h;
    if(yy<innerTop+2)return;
    if(m.type==="shelf")s+=`<line x1="${iL.toFixed(1)}" y1="${yy.toFixed(1)}" x2="${iR.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#cdc4b6" stroke-width="2"/>`;
    else if(m.type==="rail"){s+=`<line x1="${(iL+2).toFixed(1)}" y1="${yy.toFixed(1)}" x2="${(iR-2).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#b8af9e" stroke-width="2"/>`;const n=3,gh=Math.min(16,h*0.14);for(let k=0;k<n;k++){const hx=iL+6+(k+0.5)*((iR-iL-12)/n);s+=`<line x1="${hx.toFixed(1)}" y1="${yy.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${(yy+gh).toFixed(1)}" stroke="#e0d9cc" stroke-width="3"/>`;}}
    else if(m.type==="drawer"){const dh=Math.min(14,h*0.066);s+=`<rect x="${iL.toFixed(1)}" y="${(yy-dh/2).toFixed(1)}" width="${(iR-iL).toFixed(1)}" height="${dh.toFixed(1)}" rx="1.5" fill="#f4f0e8" stroke="#d4cec4" stroke-width="1"/><circle cx="${((iL+iR)/2).toFixed(1)}" cy="${yy.toFixed(1)}" r="1.7" fill="#EFC01E"/>`;}
  });
  s+=`<rect x="${ox.toFixed(1)}" y="${(oy+h).toFixed(1)}" width="${w.toFixed(1)}" height="3" rx="1.5" fill="#EFC01E"/>`;
  s+=`</svg>`;return s;
}

// ─── HELPERS ─────────────────────────────────────────────────
function ftM(ft){return Math.round(ft*304.8);}
function toFI(mm){const t=mm/25.4;const f=Math.floor(t/12);const i=Math.round(t%12);return i===12?`${f+1}'0"`:`${f}'${i}"`;}
function toIn(mm){return Math.round(mm/25.4*10)/10;}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function fmtLKR(n){return n.toLocaleString('en-LK');}
function mmToSqft(w,h){return Math.round((w/304.8)*(h/304.8)*100)/100;}
function getSectionRange(w){return{min:Math.max(1,Math.ceil(w/HINGED_MAX)),max:Math.max(1,Math.floor(w/HINGED_MIN))};}
function getSlidingPanelRange(w){return{min:Math.max(2,Math.ceil(w/SLIDING_MAX)),max:Math.max(2,Math.floor(w/SLIDING_MIN))};}
function getSmartYNorm(type,sec,mods,hMm,config){
  const ti=config?topInfo(config):{has:hMm>TOP_CUPBOARD_MM,divY:Math.min(hMm,TOP_CUPBOARD_MM)};
  const uT=ti.has?ti.divY:hMm;const ex=mods.filter(m=>m.section===sec);
  const r=ex.filter(m=>m.type==="rail"),s=ex.filter(m=>m.type==="shelf"),d=ex.filter(m=>m.type==="drawer");
  if(type==="rail"){if(r.length>=2)return-1;return r.length===0?(uT-50)/hMm:(uT*0.52)/hMm;}
  if(type==="shelf"){const y=SHELF_SPACING_MM+s.length*SHELF_SPACING_MM;return y>uT-100?-1:y/hMm;}
  if(type==="drawer"){const y=uT*0.45+d.length*180;return y>uT-100?-1:y/hMm;}return 0.5;
}
// Top-cupboard geometry. User-controlled via config.topCupboard + config.topCupboardHeight.
function topInfo(config){
  const has = config.topCupboard ?? (config.height>TOP_CUPBOARD_MM);
  if(!has) return {has:false,divY:config.height,tcH:0};
  const tcH = clamp(config.topCupboardHeight ?? 457, 250, Math.min(700,Math.round(config.height*0.4)));
  return {has:true,divY:config.height-tcH,tcH};
}
function calcPriceLKR(c,settings){
  const rateFor=ds=>(settings.doorPricing&&settings.doorPricing[ds]!=null)?settings.doorPricing[ds]:settings.pricePerSqft;
  const accList=settings.accessories;const isL=c.shape==="L"&&c.legB;
  const ppsA=rateFor(c.doorStyle);
  const sqftA=Math.round(mmToSqft(c.width,c.height)*100)/100;const priceA=Math.round(sqftA*ppsA);
  let basePrice=priceA,sqft=sqftA,legA={sqft:sqftA,rate:ppsA,price:priceA},legB=null,cornerCharge=0;
  if(isL){
    const ppsB=rateFor(c.legB.doorStyle);
    const sqftB=Math.round(mmToSqft(c.legB.width,c.height)*100)/100;const priceB=Math.round(sqftB*ppsB);
    legB={sqft:sqftB,rate:ppsB,price:priceB};
    cornerCharge=Math.max(0,settings.lCornerCharge!=null?settings.lCornerCharge:0);
    basePrice=priceA+priceB+cornerCharge;sqft=Math.round((sqftA+sqftB)*100)/100;
  }
  let accessoryTotal=0;const accBreakdown=[];
  (c.accessories||[]).forEach(accId=>{const acc=accList.find(a=>a.id===accId);if(!acc)return;
    let cost=acc.price,qty=1,label=acc.name;
    if(acc.perDoor){qty=c.sections;cost=acc.price*qty;label=`${acc.name} (×${qty})`;}
    else if(acc.perSection){qty=c.sections;cost=acc.price*qty;label=`${acc.name} (×${qty})`;}
    accessoryTotal+=cost;accBreakdown.push({label,cost});});
  return{sqft,basePrice,accessoryTotal,accBreakdown,total:basePrice+accessoryTotal,perSqft:ppsA,isL,legA,legB,cornerCharge};
}

// ─── 2D SVG STRING (for inline + PDF) ───────────────────────
function elevationSvg(cfg,ox,oy,sW,sH,sc,opts){
  const W=cfg.width,H=cfg.height,secs=cfg.sections;
  const ti=topInfo(cfg);const hasTop=ti.has;const tcDivY=ti.divY;
  const secW=sW/secs;const dc="#E05050",lc="#444",fc="#f5f3ef";const eL=18;
  let s="";
  s+=`<rect x="${ox}" y="${oy}" width="${sW}" height="${sH}" fill="${fc}" stroke="${lc}" stroke-width="2"/>`;
  s+=`<rect x="${ox}" y="${oy+sH-5*sc}" width="${sW}" height="${5*sc}" fill="#e8e4df" stroke="${lc}" stroke-width="0.5"/>`;
  for(let i=1;i<secs;i++)s+=`<line x1="${ox+i*secW}" y1="${oy+1}" x2="${ox+i*secW}" y2="${oy+sH-1}" stroke="${lc}" stroke-width="1.5"/>`;
  if(hasTop)s+=`<line x1="${ox+1}" y1="${oy+sH-tcDivY*sc}" x2="${ox+sW-1}" y2="${oy+sH-tcDivY*sc}" stroke="${lc}" stroke-width="1.5" stroke-dasharray="8,4"/>`;
  (cfg.modules||[]).forEach(mod=>{if(mod.section>=secs)return;const sx=ox+mod.section*secW+4,mw=secW-8,yP=oy+sH-mod.yNorm*sH;
    if(mod.type==="shelf")s+=`<rect x="${sx}" y="${yP-2}" width="${mw}" height="4" fill="#bbb" stroke="${lc}" stroke-width="0.5"/>`;
    if(mod.type==="drawer"){const dh=Math.max(20,36*sc);s+=`<rect x="${sx}" y="${yP-dh/2}" width="${mw}" height="${dh}" fill="#fff" stroke="${lc}" stroke-width="1" rx="1"/><line x1="${sx+mw*0.35}" y1="${yP}" x2="${sx+mw*0.65}" y2="${yP}" stroke="${lc}" stroke-width="2" stroke-linecap="round"/>`;}
    if(mod.type==="rail")s+=`<line x1="${sx+5}" y1="${yP}" x2="${sx+mw-5}" y2="${yP}" stroke="#777" stroke-width="2.5" stroke-linecap="round"/><circle cx="${sx+5}" cy="${yP}" r="3.5" fill="none" stroke="#777" stroke-width="1"/><circle cx="${sx+mw-5}" cy="${yP}" r="3.5" fill="none" stroke="#777" stroke-width="1"/>`;});
  for(let i=0;i<secs;i++)s+=`<text x="${ox+i*secW+secW/2}" y="${oy+sH-9}" text-anchor="middle" fill="#bbb" font-size="8" font-family="Poppins">Door ${i+1}</text>`;
  // width dim (top)
  s+=`<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy-eL}" stroke="${dc}" stroke-width="0.5"/><line x1="${ox+sW}" y1="${oy}" x2="${ox+sW}" y2="${oy-eL}" stroke="${dc}" stroke-width="0.5"/><line x1="${ox}" y1="${oy-eL+3}" x2="${ox+sW}" y2="${oy-eL+3}" stroke="${dc}" stroke-width="0.8"/><text x="${ox+sW/2}" y="${oy-eL-3}" text-anchor="middle" fill="${dc}" font-size="11" font-family="Poppins" font-weight="600">${toIn(W)}"</text>`;
  // height dim (left) — only if requested
  if(opts&&opts.drawHeight)s+=`<line x1="${ox}" y1="${oy}" x2="${ox-eL}" y2="${oy}" stroke="${dc}" stroke-width="0.5"/><line x1="${ox}" y1="${oy+sH}" x2="${ox-eL}" y2="${oy+sH}" stroke="${dc}" stroke-width="0.5"/><line x1="${ox-eL+3}" y1="${oy}" x2="${ox-eL+3}" y2="${oy+sH}" stroke="${dc}" stroke-width="0.8"/><text x="${ox-eL-4}" y="${oy+sH/2+4}" text-anchor="end" fill="${dc}" font-size="11" font-family="Poppins" font-weight="600">${toFI(H)}</text>`;
  // section widths (bottom)
  for(let i=0;i<secs;i++){const x1=ox+i*secW,x2=ox+(i+1)*secW;s+=`<line x1="${x1}" y1="${oy+sH}" x2="${x1}" y2="${oy+sH+eL}" stroke="${dc}" stroke-width="0.5"/><line x1="${x2}" y1="${oy+sH}" x2="${x2}" y2="${oy+sH+eL}" stroke="${dc}" stroke-width="0.5"/><line x1="${x1}" y1="${oy+sH+eL-3}" x2="${x2}" y2="${oy+sH+eL-3}" stroke="${dc}" stroke-width="0.8"/><text x="${(x1+x2)/2}" y="${oy+sH+eL+10}" text-anchor="middle" fill="${dc}" font-size="10" font-family="Poppins" font-weight="600">${toIn(W/secs)}"</text>`;}
  if(opts&&opts.label)s+=`<text x="${ox+sW/2}" y="${oy-eL-18}" text-anchor="middle" fill="#9a7a0a" font-size="11" font-family="Poppins" font-weight="700">${opts.label}</text>`;
  return s;
}
function gen2DSvg(config,materials,cW=600,cH=480,brandName="Plan My Wardrobe"){
  const isL=config.shape==="L"&&config.legB;
  const m={top:isL?64:46,right:56,bottom:46,left:56};
  const dW=cW-m.left-m.right,dH=cH-m.top-m.bottom;
  let s=`<svg viewBox="0 0 ${cW} ${cH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fff">`;
  s+=`<text x="${cW/2}" y="${cH-8}" text-anchor="middle" fill="#aaa" font-size="9" font-family="Poppins">${brandName} — Front Elevation${isL?" · L-Shape (two runs)":""}</text>`;
  if(!isL){
    const W=config.width,H=config.height;const sc=Math.min(dW/W,dH/H);const sW=W*sc,sH=H*sc;
    const ox=m.left+(dW-sW)/2,oy=m.top+(dH-sH)/2;
    s+=elevationSvg(config,ox,oy,sW,sH,sc,{drawHeight:true});
  }else{
    const lb=legBFull(config);const WA=config.width,WB=lb.width,H=config.height;
    const gap=34;const sc=Math.min((dW-gap)/(WA+WB),dH/H);const sH=H*sc;
    const sWA=WA*sc,sWB=WB*sc;const totalW=sWA+gap+sWB;
    const ox=m.left+(dW-totalW)/2,oy=m.top+(dH-sH)/2;
    s+=elevationSvg(config,ox,oy,sWA,sH,sc,{drawHeight:true,label:"LEG A"});
    s+=elevationSvg(lb,ox+sWA+gap,oy,sWB,sH,sc,{drawHeight:false,label:"LEG B"});
  }
  s+=`</svg>`;return s;
}

// ─── 3D BUILDER ──────────────────────────────────────────────
function buildRun(g,config,materials,editInt){
  const W=config.width/1000,H=config.height/1000,D=config.depth/1000,T=0.015;
  const mat=materials.find(m=>m.id===config.materialId)||materials[0];const bc=new THREE.Color(mat.color);
  const imat=materials.find(m=>m.id===config.interiorMaterialId)||mat;const ic=new THREE.Color(imat.color);
  const hd=config.doorStyle!=="none";const ti=topInfo(config);const ht=ti.has;const tY=ti.divY/1000;
  const pm=new THREE.MeshStandardMaterial({color:bc,roughness:0.55,metalness:0.05});
  const em=new THREE.MeshStandardMaterial({color:ic.clone().multiplyScalar(0.9),roughness:0.5,metalness:0.05});
  const sf=new THREE.MeshStandardMaterial({color:ic,roughness:0.5,metalness:0.02});
  const df=new THREE.MeshStandardMaterial({color:ic.clone().lerp(new THREE.Color("#fff"),0.12),roughness:0.45,metalness:0.05});
  const db=new THREE.MeshStandardMaterial({color:"#D8CFC2",roughness:0.6});
  const mt=new THREE.MeshStandardMaterial({color:"#B8B8B8",roughness:0.25,metalness:0.85});
  const tm=new THREE.MeshStandardMaterial({color:new THREE.Color(mat.color).lerp(new THREE.Color("#D4CBC0"),0.55),roughness:0.7,transparent:true,opacity:0.38});
  const ap=(w,h,d,x,y,z,m)=>{const ms=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m||pm);ms.position.set(x,y,z);ms.castShadow=true;ms.receiveShadow=true;g.add(ms);};
  ap(T,H,D,-W/2+T/2,H/2,0);ap(T,H,D,W/2-T/2,H/2,0);ap(W-2*T,T,D,0,H-T/2,0);ap(W,T,D,0,T/2,0);ap(W,H,0.005,0,H/2,-D/2+0.0025,em);
  const sc=config.sections,sw=(W-2*T)/sc;
  for(let i=1;i<sc;i++)ap(T,H-2*T,D-0.01,-W/2+T+i*sw,H/2,0,em);
  if(ht)for(let i=0;i<sc;i++)ap(sw-T,T,D-0.01,-W/2+T+i*sw+sw/2,tY,0,em);
  if(hd&&!editInt)for(let i=0;i<sc;i++){const sl=-W/2+T+i*sw,cx=sl+sw/2,mw=sw-T-0.005;const mH=ht?tY-T:H-2*T;ap(mw,mH,D-0.04,cx,T+mH/2,0.005,tm);if(ht){const th=H-tY-T;ap(mw,th,D-0.04,cx,tY+T/2+th/2,0.005,tm);}}
  config.modules.forEach(mod=>{const mty=MODULE_TYPES.find(t=>t.id===mod.type);if(!mty||mod.section>=sc)return;const sl=-W/2+T+mod.section*sw,sr=sl+sw,cx=(sl+sr)/2,mw=sw-T-0.01;const yp=T+(mod.yNorm||0.5)*(H-2*T);
    if(mod.type==="shelf"){ap(mw,0.022,D-0.015,cx,yp,0.007,sf);ap(mw,0.022,0.003,cx,yp,D/2-0.015,df);}
    else if(mod.type==="drawer"){const dH=0.16,dD=D-0.04;ap(mw,dH,0.02,cx,yp,D/2-0.02,df);ap(mw-0.02,0.01,dD*0.7,cx,yp-dH/2+0.005,-0.01,db);ap(0.01,dH-0.02,dD*0.7,cx-mw/2+0.015,yp,-0.01,db);ap(0.01,dH-0.02,dD*0.7,cx+mw/2-0.015,yp,-0.01,db);ap(mw-0.02,dH-0.02,0.01,cx,yp,-0.01-dD*0.35,db);ap(mw*0.35,0.014,0.016,cx,yp,D/2-0.005,mt);}
    else if(mod.type==="rail"){const rg=new THREE.CylinderGeometry(0.014,0.014,mw,16);rg.rotateZ(Math.PI/2);const rl=new THREE.Mesh(rg,mt);rl.position.set(cx,yp,0);rl.castShadow=true;g.add(rl);ap(0.03,0.03,0.05,sl+T/2+0.025,yp,0,mt);ap(0.03,0.03,0.05,sr-T/2-0.025,yp,0,mt);}});
  const sd=!editInt;
  if(sd&&config.doorStyle==="hinged")for(let i=0;i<sc;i++){const sl=-W/2+T+i*sw,dw=sw-0.006;const dm=pm.clone();dm.transparent=true;dm.opacity=0.82;if(ht){const mh=tY-T;ap(dw,mh,0.018,sl+sw/2,T+mh/2,D/2-0.009,dm);ap(0.008,0.08,0.02,sl+sw-0.04,T+mh/2,D/2+0.005,mt);const th=H-tY-T;ap(dw,th,0.018,sl+sw/2,tY+T/2+th/2,D/2-0.009,pm.clone());ap(0.008,0.06,0.02,sl+sw-0.04,tY+T/2+th/2,D/2+0.005,mt);}else{ap(dw,H-2*T,0.018,sl+sw/2,H/2,D/2-0.009,dm);ap(0.008,0.08,0.02,sl+sw-0.04,H/2,D/2+0.005,mt);}}
  if(sd&&config.doorStyle==="sliding"){const np=config.slidingPanels,fW=W-2*T,ov=0.05,pW=(fW+(np-1)*ov)/np;const mH=ht?tY-T:H-2*T,mY=ht?T+mH/2:H/2;for(let i=0;i<np;i++){const dm=pm.clone();dm.transparent=true;dm.opacity=0.75+(i%2)*0.08;const zO=D/2+0.005+(i%2)*0.022,xS=-fW/2+i*(pW-ov)+pW/2;ap(pW,mH,0.018,xS,mY,zO,dm);const hx=i<np/2?xS+pW/2-0.04:xS-pW/2+0.04;ap(0.008,0.08,0.02,hx,mY,zO+0.014,mt);}ap(fW,0.006,0.05,0,ht?tY-0.003:H-T-0.003,D/2+0.015,mt);ap(fW,0.006,0.05,0,T+0.003,D/2+0.015,mt);if(ht)for(let i=0;i<sc;i++){const sl=-W/2+T+i*sw,dw=sw-0.006,th=H-tY-T;const tdm=pm.clone();tdm.transparent=true;tdm.opacity=0.82;ap(dw,th,0.018,sl+sw/2,tY+T/2+th/2,D/2-0.009,tdm);ap(0.008,0.06,0.02,sl+sw-0.04,tY+T/2+th/2,D/2+0.005,mt);}}
}
// Leg B inherits shared height/depth/materials/top-cupboard from the main config (so the corner aligns)
function legBFull(config){return {...config.legB,height:config.height,depth:config.depth,materialId:config.materialId,interiorMaterialId:config.interiorMaterialId,topCupboard:config.topCupboard,topCupboardHeight:config.topCupboardHeight};}
function buildWardrobe(scene,config,materials,editInt){
  const old=scene.getObjectByName("w");if(old){old.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material){if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material.dispose();}});scene.remove(old);}
  const g=new THREE.Group();g.name="w";const H=config.height/1000;
  const gA=new THREE.Group();buildRun(gA,config,materials,editInt);g.add(gA);
  if(config.shape==="L"&&config.legB){
    const lb=legBFull(config);const gB=new THREE.Group();buildRun(gB,lb,materials,editInt);
    gB.rotation.y=-Math.PI/2;
    const WA=config.width/1000,WB=lb.width/1000,D=config.depth/1000;
    gB.position.set(WA/2-D/2,0,D/2+WB/2);
    g.add(gB);
  }
  const box=new THREE.Box3().setFromObject(g);const c=box.getCenter(new THREE.Vector3());
  g.position.set(-c.x,-H/2,-c.z);scene.add(g);
}

function DimInput({value,min,max,onChange,suffix}){
  const[e,sE]=useState(false);const[t,sT]=useState(String(value));
  useEffect(()=>{if(!e)sT(String(value));},[value,e]);
  return e?(<input autoFocus value={t} onChange={ev=>sT(ev.target.value)} onBlur={()=>{sE(false);const n=parseFloat(t);if(!isNaN(n))onChange(clamp(Math.round(n),min,max));}} onKeyDown={ev=>{if(ev.key==="Enter")ev.target.blur();if(ev.key==="Escape"){sE(false);sT(String(value));}}} style={{width:84,background:"#fff",border:"2px solid #EFC01E",borderRadius:8,color:"#1d1b18",fontSize:15,fontWeight:600,textAlign:"right",padding:"6px 10px",outline:"none",fontFamily:"inherit"}}/>
  ):(<span onClick={()=>sE(true)} style={{cursor:"text",fontSize:15,color:"#1d1b18",fontWeight:600,background:"#fff",border:"1px solid #e4e1da",borderRadius:8,padding:"6px 12px",display:"inline-flex",alignItems:"center",gap:2}}>{value}<span style={{fontSize:11,color:"#9c968e",fontWeight:500}}>{suffix}</span></span>);
}

function buildWhatsAppMsg(config,price,customer,settings){
  const b=settings.business||DEFAULT_BUSINESS;
  const mat=settings.materials.find(m=>m.id===config.materialId);const door=DOOR_STYLES.find(d=>d.id===config.doorStyle);
  const modCount=config.modules.reduce((a,m)=>{const t=MODULE_TYPES.find(x=>x.id===m.type);if(t)a[t.name]=(a[t.name]||0)+1;return a;},{});
  const selAcc=(config.accessories||[]).map(id=>settings.accessories.find(a=>a.id===id)).filter(Boolean);
  let msg=`*${b.name||BRAND} — Wardrobe Quote*\n━━━━━━━━━━━━━━━\n`;
  if(customer.name)msg+=`${customer.name}\n`;if(customer.phone)msg+=`${customer.phone}\n`;if(customer.city)msg+=`${customer.city}\n`;
  msg+=`\n*Dimensions*\n${toFI(config.width)} × ${toFI(config.height)} × ${toFI(config.depth)}\n${price.sqft} sq.ft · ${config.sections} sections\n`;
  msg+=`\n*Material:* ${mat?.name}\n*Doors:* ${door.name}${config.doorStyle==='sliding'?` (${config.slidingPanels} panels)`:''}\n\n*Interior:*\n`;
  Object.entries(modCount).forEach(([n,c])=>{msg+=`  ${n}: ×${c}\n`;});
  if(selAcc.length){msg+=`\n*Add-ons:*\n`;selAcc.forEach(a=>{msg+=`  ${a.name}\n`;});}
  if(config.notes)msg+=`\n*Notes:* ${config.notes}\n`;
  msg+=`\n━━━━━━━━━━━━━━━\n*Base:* Rs. ${fmtLKR(price.basePrice)}\n`;
  if(price.accessoryTotal)msg+=`*Add-ons:* Rs. ${fmtLKR(price.accessoryTotal)}\n`;
  const pay={advancePct:50,discountPct:0,...(settings.payment||{})};
  const disc=Math.round(price.total*((pay.discountPct||0)/100));const net=price.total-disc;const adv=Math.round(net*((pay.advancePct||0)/100));
  if(disc>0){msg+=`*Discount (${pay.discountPct}%):* − Rs. ${fmtLKR(disc)}\n*NET TOTAL: Rs. ${fmtLKR(net)}*\n`;}else{msg+=`\n*TOTAL: Rs. ${fmtLKR(net)}*\n`;}
  if((pay.advancePct||0)>0)msg+=`*Advance (${pay.advancePct}%):* Rs. ${fmtLKR(adv)} · Balance: Rs. ${fmtLKR(net-adv)}\n`;
  if(pay.bankName||pay.accountNumber)msg+=`\n*Payment:* ${pay.bankName||''}${pay.branch?` ${pay.branch}`:''}${pay.accountName?`\n${pay.accountName}`:''}${pay.accountNumber?` · ${pay.accountNumber}`:''}\n`;
  return msg;
}

// ─── CUT LIST / MANUFACTURING EXPORT ─────────────────────────
// Detailed "overall dimensions" drawing — internal measurements in mm
function genDimsSvg(config,materials,cW=760,cH=560,brandName="Plan My Wardrobe"){
  const isL=config.shape==="L"&&config.legB;const T=PANEL_THICKNESS;
  const H=config.height;
  const m={top:isL?78:64,right:96,bottom:60,left:88};
  const lb=isL?legBFull(config):null;
  const WA=config.width,WB=isL?lb.width:0;const gap=isL?54:0;
  const availW=cW-m.left-m.right,availH=cH-m.top-m.bottom;
  const sc=isL?Math.min((availW-gap)/(WA+WB),availH/H):Math.min(availW/WA,availH/H);
  const sH=H*sc;
  const totalW=isL?(WA*sc+gap+WB*sc):WA*sc;
  const ox0=m.left+(availW-totalW)/2,oy=m.top+(availH-sH)/2;
  const Y=mm=>oy+sH-mm*sc;
  const ln=(x1,y1,x2,y2,st="#444",w=1.3)=>`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${st}" stroke-width="${w}"/>`;
  const txt=(x,y,t,size=9,fill="#E05050",anchor="middle")=>`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" fill="${fill}" font-size="${size}" font-family="Poppins" font-weight="600">${t}</text>`;
  const dimH=(x1,x2,y,label,sz=9)=>ln(x1,y,x2,y,"#E05050",1)+ln(x1,y-4,x1,y+4,"#E05050",1)+ln(x2,y-4,x2,y+4,"#E05050",1)+txt((x1+x2)/2,y-5,label,sz);
  const dimV=(x,y1,y2,label,sz=8.5,side=1)=>{const yy1=Math.min(y1,y2),yy2=Math.max(y1,y2);return ln(x,yy1,x,yy2,"#E05050",1)+ln(x-4,yy1,x+4,yy1,"#E05050",1)+ln(x-4,yy2,x+4,yy2,"#E05050",1)+txt(x+side*5,(yy1+yy2)/2+3,label,sz,"#E05050",side>0?"start":"end");};
  const drawRun=(cfg,ox,opts)=>{
    const W=cfg.width,secs=cfg.sections,ti=topInfo(cfg),sW=W*sc;
    const X=mm=>ox+mm*sc;let s="";
    s+=`<rect x="${X(0).toFixed(1)}" y="${Y(H).toFixed(1)}" width="${sW.toFixed(1)}" height="${sH.toFixed(1)}" fill="#fbfaf8" stroke="#333" stroke-width="2"/>`;
    const innerW=W-2*T,secW=innerW/secs;
    for(let i=1;i<secs;i++)s+=ln(X(T+i*secW),Y(H-T),X(T+i*secW),Y(T),"#555",1.5);
    if(ti.has)s+=ln(X(T),Y(ti.divY),X(W-T),Y(ti.divY),"#555",1.5);
    s+=dimH(X(0),X(W),Y(H)-30,`${toFI(W)} · ${W}mm`,10);
    if(opts.drawHeight){s+=dimV(X(0)-26,Y(0),Y(H),`${H}`,9,-1);s+=txt(X(0)-26,Y(H)-8,toFI(H),8,"#E05050");}
    for(let i=0;i<secs;i++){const xl=T+i*secW,xr=xl+secW-(i<secs-1?T:0);s+=dimH(X(xl)+1,X(xr)-1,Y(H)-10,`${Math.round(secW-T)}`,8.5);}
    if(ti.has){s+=dimV(X(W)+24,Y(H),Y(ti.divY),`${Math.round(H-ti.divY)}`,8.5,1);s+=dimV(X(W)+24,Y(ti.divY),Y(0),`${Math.round(ti.divY)}`,8.5,1);}
    const upper=ti.has?ti.divY-T:H-T;
    for(let i=0;i<secs;i++){const xl=T+i*secW,xr=xl+secW-T;
      const els=(cfg.modules||[]).filter(md=>md.section===i).map(md=>({...md,y:T+(md.yNorm||0.5)*(H-2*T)})).filter(e=>e.y<upper).sort((a,b)=>a.y-b.y);
      els.forEach(e=>{
        if(e.type==="shelf")s+=ln(X(xl)+2,Y(e.y),X(xr)-2,Y(e.y),"#777",1.8);
        else if(e.type==="rail"){s+=ln(X(xl)+6,Y(e.y),X(xr)-6,Y(e.y),"#999",2.2);s+=`<circle cx="${(X(xl)+6).toFixed(1)}" cy="${Y(e.y).toFixed(1)}" r="2.5" fill="#999"/><circle cx="${(X(xr)-6).toFixed(1)}" cy="${Y(e.y).toFixed(1)}" r="2.5" fill="#999"/>`;}
        else if(e.type==="drawer"){const hMM=160;s+=`<rect x="${(X(xl)+2).toFixed(1)}" y="${Y(e.y+hMM/2).toFixed(1)}" width="${(X(xr)-X(xl)-4).toFixed(1)}" height="${(hMM*sc).toFixed(1)}" fill="#f1ede6" stroke="#888" stroke-width="1"/>`+ln(X(xl)+(X(xr)-X(xl))*0.38,Y(e.y),X(xl)+(X(xr)-X(xl))*0.62,Y(e.y),"#666",1.6)+txt(X(xr)-6,Y(e.y)+3,`${hMM}`,7.5,"#a05656","end");}
      });
      let prev=T;const chainX=X(xl)+12;
      els.forEach(e=>{const lo=e.type==="drawer"?e.y-80:e.y;if(lo-prev>40)s+=dimV(chainX,Y(lo),Y(prev),`${Math.round(lo-prev)}`,7.5,1);prev=e.type==="drawer"?e.y+80:e.y;});
      if(upper-prev>40)s+=dimV(chainX,Y(upper),Y(prev),`${Math.round(upper-prev)}`,7.5,1);
    }
    if(opts.label)s+=txt(X(0)+sW/2,oy-34,opts.label,11,"#9a7a0a");
    return s;
  };
  let s=`<svg viewBox="0 0 ${cW} ${cH}" xmlns="http://www.w3.org/2000/svg" style="background:#fff;max-width:100%;height:auto">`;
  s+=txt(ox0,26,"OVERALL DIMENSIONS",12,"#333","start");
  if(isL)s+=txt(ox0,40,`All internal dimensions in mm · L-Shape · Leg A ${WA}mm + Leg B ${WB}mm · H ${H}mm · D ${config.depth}mm`,8.5,"#888","start");
  else s+=txt(ox0,40,`All internal dimensions in mm · Overall ${toFI(WA)} × ${toFI(H)} × ${toFI(config.depth)} (${WA}×${H}×${config.depth}mm)`,8.5,"#888","start");
  if(!isL){s+=drawRun(config,ox0,{drawHeight:true});}
  else{s+=drawRun(config,ox0,{drawHeight:true,label:"LEG A"});s+=drawRun(lb,ox0+WA*sc+gap,{drawHeight:false,label:"LEG B"});}
  s+=txt(cW/2,cH-12,`${brandName} — Overall Dimensions · verify on site before production`,8,"#aaa");
  s+=`</svg>`;return s;
}

// Offscreen 3D render for PDFs — front view, light background, auto-fit
function captureRender(config,materials,withDoors){
  try{
    const w=1400,h=1000;
    const cv=document.createElement("canvas");cv.width=w;cv.height=h;
    const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
    r.setPixelRatio(1);r.setSize(w,h,false);
    const scene=new THREE.Scene();scene.background=new THREE.Color("#f4f2ee");
    scene.add(new THREE.AmbientLight("#ffffff",0.85));
    const dl=new THREE.DirectionalLight("#fff8f0",0.9);dl.position.set(2.5,4,5);scene.add(dl);
    const dl2=new THREE.DirectionalLight("#eef2f7",0.35);dl2.position.set(-3,2,-2);scene.add(dl2);
    buildWardrobe(scene,config,materials,!withDoors);
    const g=scene.getObjectByName("w");
    const box=new THREE.Box3().setFromObject(g);const size=box.getSize(new THREE.Vector3());const ctr=box.getCenter(new THREE.Vector3());
    const cam=new THREE.PerspectiveCamera(26,w/h,0.1,100);
    const fitDim=Math.max(size.x,size.y*(w/h));
    const dist=(fitDim/2)/Math.tan(THREE.MathUtils.degToRad(13))*1.12+size.z;
    cam.position.set(ctr.x+size.x*0.1,ctr.y+size.y*0.05,ctr.z+dist);
    cam.lookAt(ctr.x,ctr.y,ctr.z);
    r.render(scene,cam);
    const url=cv.toDataURL("image/png");
    g.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material){Array.isArray(c.material)?c.material.forEach(mm=>mm.dispose()):c.material.dispose();}});
    r.dispose();
    return url;
  }catch(e){return "";}
}

function runCutParts(cfg,add){
  const W=cfg.width,H=cfg.height,D=cfg.depth,T=PANEL_THICKNESS,secs=cfg.sections;
  const ti=topInfo(cfg);const hasTop=ti.has;const divY=ti.divY;
  const sw=(W-2*T)/secs;
  add("Side Panel",2,D,H,"15mm melamine",H);
  add("Top Panel",1,W-2*T,D,"",W-2*T);
  add("Bottom Panel",1,W,D,"",W);
  add("Back Panel",1,W,H,"3mm hardboard",0);
  if(secs>1)add("Vertical Divider",secs-1,D-10,H-2*T,"",H-2*T);
  if(hasTop)add("Top Cupboard Shelf",secs,sw-T,D-10,"",sw-T);
  const shelves=(cfg.modules||[]).filter(m=>m.type==="shelf").length;
  const drawers=(cfg.modules||[]).filter(m=>m.type==="drawer").length;
  const rails=(cfg.modules||[]).filter(m=>m.type==="rail").length;
  if(shelves)add("Shelf",shelves,sw-T-10,D-15,"",sw-T-10);
  if(drawers){
    add("Drawer Front",drawers,sw-T-10,160,"",2*((sw-T-10)+160));
    add("Drawer Side",drawers*2,D*0.7,140,"box side",D*0.7);
    add("Drawer Back",drawers,sw-T-30,140,"",sw-T-30);
    add("Drawer Bottom",drawers,sw-T-30,D*0.7,"3mm",0);
  }
  let mainDoors=0,topDoors=0;
  if(cfg.doorStyle==="hinged"){
    const dh=hasTop?divY-T:H-2*T;mainDoors=secs;
    add("Door (Hinged)",secs,sw-6,dh,"",2*((sw-6)+dh));
    if(hasTop){topDoors=secs;add("Top Cupboard Door",secs,sw-6,H-divY-T,"",2*((sw-6)+(H-divY-T)));}
  } else if(cfg.doorStyle==="sliding"){
    const np=cfg.slidingPanels;const dh=hasTop?divY-T:H-2*T;mainDoors=np;
    const ovm=50,spw=((W-2*T)+(np-1)*ovm)/np;add("Sliding Panel",np,spw,dh,"50mm overlap",2*(spw+dh));
    if(hasTop){topDoors=secs;add("Top Cupboard Door",secs,sw-6,H-divY-T,"",2*((sw-6)+(H-divY-T)));}
  }
  return{secs,sw,hasTop,divY,shelves,drawers,rails,mainDoors,topDoors};
}
function runCutHardware(cfg,c,hardware,pre){
  if(cfg.doorStyle==="hinged"){const th=c.mainDoors*3,tp=c.topDoors*2;hardware.push(`${pre}Hinges: ${th+tp} (${c.mainDoors}×3 main${c.topDoors?` + ${c.topDoors}×2 top`:''})`);hardware.push(`${pre}Handles: ${c.mainDoors+c.topDoors}`);}
  if(cfg.doorStyle==="sliding"){hardware.push(`${pre}Sliding track sets: ${cfg.slidingPanels}`,`${pre}Rollers: ${cfg.slidingPanels*2}`);if(c.topDoors)hardware.push(`${pre}Top cupboard hinges: ${c.topDoors*2}`,`${pre}Top cupboard handles: ${c.topDoors}`);}
  if(c.drawers)hardware.push(`${pre}Drawer slide pairs: ${c.drawers}`,`${pre}Drawer handles: ${c.drawers}`);
  if(c.rails)hardware.push(`${pre}Hanging rails: ${c.rails}`,`${pre}Rail brackets: ${c.rails*2}`);
  if(c.shelves)hardware.push(`${pre}Shelf support pins: ${c.shelves*4}`);
}
function computeCutList(config){
  const isL=config.shape==="L"&&config.legB;
  const parts=[];const hardware=[];
  const mk=leg=>(part,qty,w,h,note="",band=0)=>parts.push({part,qty,w:Math.round(w),h:Math.round(h),note,band:Math.round(band),leg});
  if(!isL){
    const c=runCutParts(config,mk(null));runCutHardware(config,c,hardware,"");
    hardware.push(`Confirmat / carcass screws: ~${(c.secs*8)+24}`,`Back-panel pins: ~${Math.round((config.width+config.height)/100)}`);
  }else{
    const cA=runCutParts(config,mk("A"));runCutHardware(config,cA,hardware,"Leg A · ");
    const lb=legBFull(config);const cB=runCutParts(lb,mk("B"));runCutHardware(lb,cB,hardware,"Leg B · ");
    mk("A")("Corner Filler Panel",1,config.depth,config.height,"closes blind corner — Leg A owns the corner",config.height);
    const totalSecs=cA.secs+cB.secs;
    hardware.push(`Confirmat / carcass screws: ~${(totalSecs*8)+48}`,`Back-panel pins: ~${Math.round((config.width+lb.width+2*config.height)/100)}`,`Corner joining brackets: 4`);
  }
  let edgeM=0;parts.forEach(p=>{edgeM+=p.qty*(p.band||0)/1000;});
  return{parts,hardware,edgeM:Math.round(edgeM*10)/10,isL};
}

function generateCutList(config,settings){
  const b=settings.business;const cl=computeCutList(config);
  const mat=settings.materials.find(m=>m.id===config.materialId);
  const dateStr=new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'});
  const jobNo="JOB-"+Date.now().toString().slice(-6);
  const accent=b.accent||"#EFC01E";
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cut List ${jobNo}</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"><style>@page{size:A4;margin:14mm}*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:'Poppins',sans-serif;color:#222}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${accent};padding-bottom:12px;margin-bottom:16px}
  .logo{font-size:22px;font-weight:700;color:${accent}}.sub{font-size:9px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}
  .meta{text-align:right;font-size:11px;color:#666;line-height:1.6}.meta b{color:#222}
  .banner{background:#faf9f7;border:1px solid #eee;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:#444;display:flex;justify-content:space-between}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${accent};margin:16px 0 8px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th{text-align:left;font-size:10px;text-transform:uppercase;color:#999;padding:7px 8px;border-bottom:2px solid #eee;font-weight:600}
  th.r,td.r{text-align:right}th.c,td.c{text-align:center}
  td{padding:7px 8px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333}
  tr:nth-child(even) td{background:#fafafa}
  .dim{font-family:monospace;font-weight:600;color:#222}
  .hw{display:grid;grid-template-columns:1fr 1fr;gap:6px}.hw div{font-size:12px;color:#444;padding:6px 10px;background:#faf9f7;border-radius:6px}
  .ft{margin-top:24px;padding-top:12px;border-top:1px solid #eee;font-size:9px;color:#bbb;text-align:center}
  .note{font-size:10px;color:#999;font-style:italic}</style></head><body>
  <div class="hdr"><div><div class="logo">${b.name||'Plan My Wardrobe'}</div><div class="sub">Manufacturing Cut List</div></div><div class="meta"><b>${jobNo}</b><br>${dateStr}<br>${b.phone||''}</div></div>
  <div class="banner"><div><b>Wardrobe:</b> ${cl.isL?`L-Shape · Leg A ${toFI(config.width)} + Leg B ${toFI(config.legB.width)} · H ${toFI(config.height)} · D ${toFI(config.depth)}`:`${toFI(config.width)} × ${toFI(config.height)} × ${toFI(config.depth)} (${config.width}×${config.height}×${config.depth}mm)`}</div><div><b>Material:</b> ${mat?.name} · ${PANEL_THICKNESS}mm</div></div>
  <h2>Panel Cut List <span class="note">— all dimensions in mm${cl.isL?' · grouped by leg':''}</span></h2>
  <table><thead><tr><th>Part</th>${cl.isL?'<th class="c">Leg</th>':''}<th class="c">Qty</th><th class="r">Width</th><th class="r">Height</th><th>Material / Note</th></tr></thead><tbody>
  ${cl.parts.map(p=>`<tr><td>${p.part}</td>${cl.isL?`<td class="c">${p.leg||'—'}</td>`:''}<td class="c">${p.qty}</td><td class="r dim">${p.w}</td><td class="r dim">${p.h}</td><td>${p.note||(mat?.name+' '+PANEL_THICKNESS+'mm')}</td></tr>`).join('')}
  </tbody></table>
  <p class="note" style="margin-bottom:16px">Total panels: ${cl.parts.reduce((a,p)=>a+p.qty,0)} · Edge banding (front/visible edges): ~${cl.edgeM} linear metres${cl.isL?' · L-shape: both legs counted fully plus a corner filler (slightly conservative — confirm corner overlap before cutting)':''}</p>
  <h2>Hardware</h2>
  <div class="hw">${cl.hardware.map(h=>`<div>${h}</div>`).join('')||'<div>None</div>'}</div>
  ${config.notes?`<h2>Notes</h2><p style="font-size:12px;color:#555;line-height:1.6">${config.notes}</p>`:''}
  <div class="ft">${b.name||'Plan My Wardrobe'} · Generated cut list — verify all dimensions before cutting. Saw kerf & edge allowances not included.</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),400);</script></body></html>`;
  const win=window.open('','_blank');if(win){win.document.write(html);win.document.close();}
}


function generatePDF(config,price,canvasRef,customer,settings,isDemo=false){
  const wm=isDemo?`<div class="wm">DEMO</div>`:"";
  const b=settings.business||DEFAULT_BUSINESS;const accent=b.accent||"#EFC01E";
  const mat=settings.materials.find(m=>m.id===config.materialId);const door=DOOR_STYLES.find(d=>d.id===config.doorStyle);
  const imat=settings.materials.find(m=>m.id===config.interiorMaterialId)||mat;
  const ssOpen=captureRender(config,settings.materials,false);
  const ssClosed=captureRender(config,settings.materials,true);
  const pay={advancePct:50,discountPct:0,...(settings.payment||{})};
  const disc=Math.round(price.total*((pay.discountPct||0)/100));
  const net=price.total-disc;
  const adv=Math.round(net*((pay.advancePct||0)/100));
  const bal=net-adv;
  const ml=config.modules.reduce((a,m)=>{const t=MODULE_TYPES.find(x=>x.id===m.type);if(t)a[t.name]=(a[t.name]||0)+1;return a;},{});
  const selAcc=(config.accessories||[]).map(id=>settings.accessories.find(a=>a.id===id)).filter(Boolean);
  const svg2d=gen2DSvg(config,settings.materials,640,500,b.name||BRAND);
  const svgDims=genDimsSvg(config,settings.materials,700,520,b.name||BRAND);
  const dateStr=new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'});
  const quoteNo="PMW-"+Date.now().toString().slice(-6);
  const css=`@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:'Poppins',sans-serif;color:#222}
  .page{width:210mm;min-height:297mm;padding:18mm 16mm;position:relative;page-break-after:always;display:flex;flex-direction:column}
  .wm{position:absolute;top:42%;left:0;right:0;text-align:center;font-size:110px;font-weight:800;letter-spacing:24px;color:rgba(210,60,60,0.13);transform:rotate(-27deg);pointer-events:none;z-index:99}
  .page:last-child{page-break-after:auto}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #EFC01E;padding-bottom:14px;margin-bottom:8px}
  .logo{font-size:26px;font-weight:700;color:#EFC01E;letter-spacing:-0.5px}
  .logo-sub{font-size:9px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
  .meta{text-align:right;font-size:11px;color:#666;line-height:1.7}
  .meta b{color:#222}
  .bill{display:flex;justify-content:space-between;margin:18px 0;gap:20px}
  .bill-box{flex:1;background:#faf9f7;border:1px solid #eee;border-radius:8px;padding:14px}
  .bill-box .lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#aaa;margin-bottom:6px}
  .bill-box .val{font-size:13px;color:#333;line-height:1.6}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#EFC01E;margin:20px 0 8px;font-weight:600}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#999;padding:8px 10px;border-bottom:2px solid #eee;font-weight:600}
  th:last-child{text-align:right}
  td{padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#444}
  td:last-child{text-align:right;font-weight:500;color:#222}
  .tot-row td{border-top:2px solid #EFC01E;border-bottom:none;font-size:16px;font-weight:700;padding-top:12px}
  .tot-row td:last-child{color:#EFC01E}
  .notes{margin-top:16px;padding:12px 14px;background:#faf9f7;border-radius:8px;font-size:11px;color:#666;line-height:1.7;white-space:pre-wrap}
  .ft{margin-top:auto;padding-top:16px;border-top:1px solid #eee;font-size:9px;color:#bbb;text-align:center;line-height:1.6}
  .draw-title{font-size:15px;font-weight:600;color:#333;margin-bottom:4px}
  .draw-sub{font-size:11px;color:#999;margin-bottom:20px}
  .draw-wrap{flex:1;display:flex;align-items:center;justify-content:center;border:1px solid #eee;border-radius:10px;background:#fff;padding:20px}
  .draw-wrap img{max-width:100%;max-height:200mm;object-fit:contain}
  .spec-strip{display:flex;justify-content:space-around;margin-top:20px;padding:14px;background:#faf9f7;border-radius:8px}
  .spec-strip .s{text-align:center}
  .spec-strip .s .n{font-size:14px;font-weight:600;color:#EFC01E}
  .spec-strip .s .l{font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
  .payb{margin-top:6px;background:#faf9f7;border:1px solid #eee;border-radius:8px;padding:12px 14px;font-size:11px;color:#444;line-height:1.8}
  .payb b{color:#222}
  .sub-row td{font-size:12px;color:#555}
  .adv-row td{font-size:13px;font-weight:600;color:#333;background:#faf6ee}`;

  const headerBlock=(pageLabel)=>`<div class="hdr"><div><div class="logo">${b.name||BRAND}</div><div class="logo-sub">${b.tagline||'Wardrobe Studio'}</div></div><div class="meta"><b>${pageLabel}</b><br>Quote No: <b>${quoteNo}</b><br>Date: ${dateStr}${b.phone?`<br>${b.phone}`:''}</div></div>`;
  const footer=`<div class="ft">${b.name||BRAND}${b.address?` · ${b.address}`:''}${b.email?` · ${b.email}`:''}<br>${b.terms||'Prices are estimates and exclude delivery & installation unless stated.'}</div>`;

  // Page 1: Invoice
  const page1=`<div class="page">${wm}
    ${headerBlock('QUOTATION')}
    <div class="bill">
      <div class="bill-box"><div class="lbl">Prepared For</div><div class="val"><b>${customer?.name||'—'}</b><br>${customer?.phone||''}<br>${customer?.city||''}</div></div>
      <div class="bill-box"><div class="lbl">Specification</div><div class="val">${toFI(config.width)} × ${toFI(config.height)} × ${toFI(config.depth)}<br>${price.sqft} sq.ft · ${config.sections} sections<br>${PANEL_THICKNESS}mm Melamine</div></div>
    </div>
    <h2>Material &amp; Doors</h2>
    <table><tr><td>Exterior Color</td><td>${mat?.name||'—'}</td></tr><tr><td>Interior Color</td><td>${imat?.name||'—'}</td></tr><tr><td>Door Style</td><td>${door.name}${config.doorStyle==='sliding'?` (${config.slidingPanels} panels)`:''}</td></tr></table>
    <h2>Interior Layout</h2>
    <table>${Object.entries(ml).map(([n,c])=>`<tr><td>${n}</td><td>×${c}</td></tr>`).join('')||'<tr><td>None</td><td>—</td></tr>'}</table>
    ${selAcc.length?`<h2>Add-on Features</h2><table>${selAcc.map(a=>`<tr><td>${a.name}</td><td>Rs. ${fmtLKR(a.price)} ${a.per}</td></tr>`).join('')}</table>`:''}
    <h2>Pricing</h2>
    <table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>
    ${price.isL?`<tr><td>Leg A — ${price.legA.sqft} sq.ft × Rs. ${fmtLKR(price.legA.rate)} (${door.name})</td><td>Rs. ${fmtLKR(price.legA.price)}</td></tr><tr><td>Leg B — ${price.legB.sqft} sq.ft × Rs. ${fmtLKR(price.legB.rate)} (${(DOOR_STYLES.find(d=>d.id===config.legB.doorStyle)||{}).name||''})</td><td>Rs. ${fmtLKR(price.legB.price)}</td></tr>${price.cornerCharge>0?`<tr><td>Corner (post, filler &amp; joining)</td><td>Rs. ${fmtLKR(price.cornerCharge)}</td></tr>`:''}`:`<tr><td>Base — ${price.sqft} sq.ft × Rs. ${fmtLKR(price.perSqft)} (${door.name} rate)</td><td>Rs. ${fmtLKR(price.basePrice)}</td></tr>`}
    ${price.accBreakdown.map(a=>`<tr><td>${a.label}</td><td>Rs. ${fmtLKR(a.cost)}</td></tr>`).join('')}
    ${disc>0?`<tr class="sub-row"><td>Subtotal</td><td>Rs. ${fmtLKR(price.total)}</td></tr><tr class="sub-row"><td>Discount (${pay.discountPct}%)</td><td>&minus; Rs. ${fmtLKR(disc)}</td></tr>`:''}
    <tr class="tot-row"><td>${disc>0?'Net Total':'Total'}</td><td>Rs. ${fmtLKR(net)}</td></tr>
    ${(pay.advancePct||0)>0?`<tr class="adv-row"><td>Advance to confirm order (${pay.advancePct}%)</td><td>Rs. ${fmtLKR(adv)}</td></tr><tr class="sub-row"><td>Balance on completion</td><td>Rs. ${fmtLKR(bal)}</td></tr>`:''}
    </tbody></table>
    ${(pay.bankName||pay.accountNumber)?`<h2>Payment Information</h2><div class="payb">${pay.bankName?`<b>Bank:</b> ${pay.bankName}`:''}${pay.branch?` &middot; <b>Branch:</b> ${pay.branch}`:''}${pay.accountName?`<br><b>Account Name:</b> ${pay.accountName}`:''}${pay.accountNumber?`<br><b>Account No:</b> ${pay.accountNumber}`:''}${(pay.advancePct||0)>0?`<br><b>Advance due:</b> Rs. ${fmtLKR(adv)} (${pay.advancePct}% of net total)`:''}</div>`:''}
    ${config.notes?`<div class="notes"><b>Notes:</b> ${config.notes}</div>`:''}
    ${footer}
  </div>`;

  // Page 2: 3D interior (without doors)
  const page2=`<div class="page">${wm}
    ${headerBlock('3D — INTERIOR VIEW')}
    <div class="draw-title">3D Rendering — Without Doors</div>
    <div class="draw-sub">Interior layout · Exterior ${mat?.name} · Interior ${imat?.name}</div>
    <div class="draw-wrap">${ssOpen?`<img src="${ssOpen}"/>`:'<span style="color:#ccc">3D preview not available</span>'}</div>
    <div class="spec-strip"><div class="s"><div class="n">${toFI(config.width)}</div><div class="l">Width</div></div><div class="s"><div class="n">${toFI(config.height)}</div><div class="l">Height</div></div><div class="s"><div class="n">${toFI(config.depth)}</div><div class="l">Depth</div></div><div class="s"><div class="n">${price.sqft}</div><div class="l">Sq.ft</div></div></div>
    ${footer}
  </div>`;

  // Page 3: 3D exterior (with doors)
  const page3b=`<div class="page">${wm}
    ${headerBlock('3D — EXTERIOR VIEW')}
    <div class="draw-title">3D Rendering — With Doors</div>
    <div class="draw-sub">${mat?.name} finish · ${door.name} doors</div>
    <div class="draw-wrap">${ssClosed?`<img src="${ssClosed}"/>`:'<span style="color:#ccc">3D preview not available</span>'}</div>
    <div class="spec-strip"><div class="s"><div class="n">${toFI(config.width)}</div><div class="l">Width</div></div><div class="s"><div class="n">${toFI(config.height)}</div><div class="l">Height</div></div><div class="s"><div class="n">${toFI(config.depth)}</div><div class="l">Depth</div></div><div class="s"><div class="n">${door.name}</div><div class="l">Doors</div></div></div>
    ${footer}
  </div>`;

  // Page 4: 2D
  const page4=`<div class="page">${wm}
    ${headerBlock('TECHNICAL DRAWING')}
    <div class="draw-title">2D Front Elevation</div>
    <div class="draw-sub">All dimensions in inches · ${config.sections} sections</div>
    <div class="draw-wrap">${svg2d}</div>
    <div class="spec-strip"><div class="s"><div class="n">${toIn(config.width)}"</div><div class="l">Total Width</div></div><div class="s"><div class="n">${toIn(config.width/config.sections)}"</div><div class="l">Per Section</div></div><div class="s"><div class="n">${toFI(config.height)}</div><div class="l">Height</div></div></div>
    ${footer}
  </div>`;

  // Page 5: overall dimensions
  const page5=`<div class="page">${wm}
    ${headerBlock('OVERALL DIMENSIONS')}
    <div class="draw-title">Overall Dimensions</div>
    <div class="draw-sub">All internal dimensions in mm · verify on site before production</div>
    <div class="draw-wrap">${svgDims}</div>
    ${footer}
  </div>`;

  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${BRAND} Quote ${quoteNo}</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>${css}</style></head><body>${page1}${page2}${page3b}${page4}${page5}<script>window.onload=()=>setTimeout(()=>window.print(),400);</script></body></html>`;
  const win=window.open('','_blank');if(win){win.document.write(html);win.document.close();}
}

// ─── LOGIN SCREEN ────────────────────────────────────────────
function LoginScreen({onLogin,onBack}){
  const[mode,setMode]=useState("login");const[name,setName]=useState("");const[email,setEmail]=useState("");
  const handleGoogle=()=>{
    if(USE_GOOGLE){ signIn("google"); return; }
    // DEMO fallback: simulates login. Set NEXT_PUBLIC_USE_GOOGLE=true for real OAuth.
    const demoEmail=email.trim()||"demo@gmail.com";
    const demoName=name.trim()||demoEmail.split("@")[0];
    onLogin({email:demoEmail,name:demoName});
  };
  return(
    <div style={{width:"100%",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f6f3",color:"#1d1b18",fontFamily:"'Poppins',sans-serif",padding:20}}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:600,height:500,borderRadius:"50%",background:"radial-gradient(circle,#EFC01E0A 0%,transparent 70%)"}}/>
      <div style={{position:"relative",zIndex:1,width:380,maxWidth:"90vw",background:"#ffffff",border:"1px solid #e4e1da",borderRadius:18,padding:36,textAlign:"center"}}>
        <div style={{fontSize:26,fontWeight:700,color:"#EFC01E",marginBottom:4}}>{BRAND}</div>
        <div style={{fontSize:11,color:"#9c968e",letterSpacing:"2px",textTransform:"uppercase",marginBottom:28}}>Wardrobe Studio</div>
        <h2 style={{fontSize:20,fontWeight:600,marginBottom:6}}>{mode==="login"?"Welcome back":"Create your account"}</h2>
        <p style={{fontSize:13,color:"#847e76",marginBottom:24,lineHeight:1.5}}>{mode==="login"?"Sign in to access your designs and quotes":"Sign up to save designs and manage your catalog"}</p>

        {!USE_GOOGLE&&mode==="register"&&(<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{width:"100%",padding:"12px 14px",borderRadius:10,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:14,outline:"none",fontFamily:"inherit",marginBottom:12}}/>)}
        {!USE_GOOGLE&&(<input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@gmail.com" type="email" style={{width:"100%",padding:"12px 14px",borderRadius:10,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:14,outline:"none",fontFamily:"inherit",marginBottom:16}}/>)}

        <button onClick={handleGoogle} style={{width:"100%",padding:"13px 0",borderRadius:10,background:"#fff",border:"1px solid #dadce0",color:"#3c4043",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12,boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2C41.4 36 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
          Continue with Google
        </button>
        {!USE_GOOGLE&&<div style={{fontSize:10,color:"#aaa49c",marginBottom:16}}>Demo mode — enter any email to continue</div>}
        {!USE_GOOGLE&&<div style={{fontSize:12,color:"#847e76"}}>{mode==="login"?"New here? ":"Have an account? "}<span onClick={()=>setMode(mode==="login"?"register":"login")} style={{color:"#EFC01E",cursor:"pointer",fontWeight:500}}>{mode==="login"?"Create account":"Sign in"}</span></div>}
        {onBack&&<div onClick={onBack} style={{fontSize:12,color:"#9c968e",cursor:"pointer",marginTop:16}}>← Back to home</div>}
      </div>
    </div>
  );
}

// ─── ADMIN SETTINGS MODAL ────────────────────────────────────
function AdminModal({settings,onSave,onClose}){
  const[pps,setPps]=useState(settings.pricePerSqft);
  const[mats,setMats]=useState(JSON.parse(JSON.stringify(settings.materials)));
  const[accs,setAccs]=useState(JSON.parse(JSON.stringify(settings.accessories)));
  const[biz,setBiz]=useState({...DEFAULT_BUSINESS,...(settings.business||{})});
  const[pay,setPay]=useState({...DEFAULT_PAYMENT,...(settings.payment||{})});
  const[dpr,setDpr]=useState({...DEFAULT_DOOR_PRICING,...(settings.doorPricing||{})});
  const[lcorner,setLcorner]=useState(settings.lCornerCharge!=null?settings.lCornerCharge:0);
  const[tab,setTab]=useState("business");
  const sl={fontSize:11,color:"#847e76",letterSpacing:"0.08em",textTransform:"uppercase"};
  const addMat=()=>setMats([...mats,{id:"custom-"+Date.now(),name:"New Color",color:"#cccccc"}]);
  const addAcc=()=>setAccs([...accs,{id:"custom-"+Date.now(),name:"New Product",desc:"",price:1000,per:"per unit",icon:"+"}]);
  const bizField=(label,key,placeholder,textarea)=>(<div style={{marginBottom:12}}><span style={sl}>{label}</span>{textarea?<textarea value={biz[key]||""} onChange={e=>setBiz({...biz,[key]:e.target.value})} placeholder={placeholder} rows={2} style={{width:"100%",marginTop:6,padding:"10px 12px",borderRadius:8,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical"}}/>:<input value={biz[key]||""} onChange={e=>setBiz({...biz,[key]:e.target.value})} placeholder={placeholder} style={{width:"100%",marginTop:6,padding:"10px 12px",borderRadius:8,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:13,outline:"none",fontFamily:"inherit"}}/>}</div>);
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(25,22,19,0.38)",backdropFilter:"blur(6px)",padding:20}}>
      <div style={{background:"#ffffff",border:"1px solid #e4e1da",borderRadius:16,width:560,maxWidth:"95vw",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px",borderBottom:"1px solid #e4e1da"}}>
          <h3 style={{fontSize:18,fontWeight:600}}>Settings</h3>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#9c968e",fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",gap:4,padding:"12px 22px 0",flexWrap:"wrap"}}>
          {[["business","Business"],["payments","Payments"],["pricing","Pricing"],["colors","Colors"],["products","Products"]].map(([id,l])=>(<button key={id} onClick={()=>setTab(id)} style={{padding:"8px 16px",borderRadius:8,background:tab===id?"#EFC01E22":"transparent",border:tab===id?"1px solid #EFC01E44":"1px solid #d8d4cc",color:tab===id?"#EFC01E":"#847e76",cursor:"pointer",fontSize:12,fontWeight:tab===id?500:400}}>{l}</button>))}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:22}}>
          {tab==="business"&&(<div>
            <p style={{fontSize:11,color:"#9c968e",marginBottom:16,lineHeight:1.5}}>Your branding appears on the configurator header, PDF quotes, cut lists, and WhatsApp messages — so customers see your company, not Plan My Wardrobe.</p>
            {bizField("Company Name","name","e.g. Your Company (Pvt) Ltd")}
            {bizField("Tagline","tagline","e.g. Custom Furniture Makers")}
            {bizField("Logo URL (optional)","logo","https://yoursite.com/logo.png")}
            {bizField("Phone","phone","e.g. +94 77 123 4567")}
            {bizField("Email","email","info@yourcompany.lk")}
            {bizField("Address","address","e.g. No: 123, Main Street, Colombo",true)}
            {bizField("Quote Terms / Footer Note","terms","Prices valid 14 days. Excludes delivery.",true)}
            <div style={{marginBottom:12}}><span style={sl}>Accent Color</span><div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}><input type="color" value={biz.accent||"#EFC01E"} onChange={e=>setBiz({...biz,accent:e.target.value})} style={{width:44,height:36,borderRadius:6,border:"none",cursor:"pointer",background:"none"}}/><input value={biz.accent||"#EFC01E"} onChange={e=>setBiz({...biz,accent:e.target.value})} style={{width:100,padding:"8px 10px",borderRadius:6,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#847e76",fontSize:12,outline:"none",fontFamily:"monospace"}}/></div></div>
          </div>)}
          {tab==="payments"&&(<div>
            <p style={{fontSize:11,color:"#9c968e",marginBottom:16,lineHeight:1.5}}>Bank details print on the PDF quotation. Advance and discount are applied automatically to every quote.</p>
            {[["Bank Name","bankName","e.g. Bank of Ceylon"],["Account Name","accountName","e.g. Your Company (Pvt) Ltd"],["Account Number","accountNumber","e.g. 0012345678"],["Branch","branch","e.g. Colombo"]].map(([l,k,ph])=>(<div key={k} style={{marginBottom:12}}><span style={sl}>{l}</span><input value={pay[k]||""} onChange={e=>setPay({...pay,[k]:e.target.value})} placeholder={ph} style={{width:"100%",marginTop:6,padding:"10px 12px",borderRadius:8,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:13,outline:"none",fontFamily:"inherit"}}/></div>))}
            <div style={{display:"flex",gap:14}}>
              <div style={{flex:1}}><span style={sl}>Advance %</span><input type="number" min={0} max={100} value={pay.advancePct??50} onChange={e=>setPay({...pay,advancePct:clamp(Number(e.target.value)||0,0,100)})} style={{width:"100%",marginTop:6,padding:"10px 12px",borderRadius:8,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:13,outline:"none",fontFamily:"inherit"}}/><div style={{fontSize:9.5,color:"#9c968e",marginTop:4}}>Advance due to confirm the order</div></div>
              <div style={{flex:1}}><span style={sl}>Discount %</span><input type="number" min={0} max={100} value={pay.discountPct??0} onChange={e=>setPay({...pay,discountPct:clamp(Number(e.target.value)||0,0,100)})} style={{width:"100%",marginTop:6,padding:"10px 12px",borderRadius:8,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:13,outline:"none",fontFamily:"inherit"}}/><div style={{fontSize:9.5,color:"#9c968e",marginTop:4}}>Applied to every quote (0 = none)</div></div>
            </div>
          </div>)}
          {tab==="pricing"&&(<div>
            <span style={sl}>Price per Square Foot — by Door Type (LKR)</span>
            <p style={{fontSize:11,color:"#9c968e",margin:"6px 0 14px",lineHeight:1.5}}>Each door type costs differently to build, so each has its own rate. The rate is multiplied by the wardrobe's front area (width × height in sq.ft).</p>
            {[["Open (no doors)","none"],["Hinged doors","hinged"],["Sliding doors","sliding"]].map(([l,k])=>(<div key={k} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}><span style={{flex:1,fontSize:13,color:"#34302b",fontWeight:500}}>{l}</span><span style={{fontSize:11,color:"#9c968e"}}>Rs.</span><input type="number" value={dpr[k]??pps} onChange={e=>setDpr({...dpr,[k]:Math.max(0,Number(e.target.value)||0)})} style={{width:130,padding:"10px 12px",borderRadius:8,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#EFC01E",fontSize:16,fontWeight:600,outline:"none",fontFamily:"inherit",textAlign:"right"}}/><span style={{fontSize:11,color:"#9c968e"}}>/sqft</span></div>))}
            <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid #e4e1da"}}>
              <span style={sl}>L-Shape Corner Charge</span>
              <p style={{fontSize:11,color:"#9c968e",margin:"6px 0 10px",lineHeight:1.5}}>A flat amount added to L-shaped wardrobes for the corner post, filler panel &amp; joining labour. Set 0 for none. Each leg is otherwise priced at its own door-type rate × its area.</p>
              <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{flex:1,fontSize:13,color:"#34302b",fontWeight:500}}>Corner charge (flat)</span><span style={{fontSize:11,color:"#9c968e"}}>Rs.</span><input type="number" value={lcorner} onChange={e=>setLcorner(Math.max(0,Number(e.target.value)||0))} style={{width:130,padding:"10px 12px",borderRadius:8,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#EFC01E",fontSize:16,fontWeight:600,outline:"none",fontFamily:"inherit",textAlign:"right"}}/></div>
            </div>
          </div>)}
          {tab==="colors"&&(<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {mats.map((m,i)=>(<div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,background:"#f4f2ee",border:"1px solid #e4e1da"}}>
              <input type="color" value={m.color} onChange={e=>{const n=[...mats];n[i]={...m,color:e.target.value};setMats(n);}} style={{width:36,height:36,borderRadius:6,border:"none",cursor:"pointer",background:"none"}}/>
              <input value={m.name} onChange={e=>{const n=[...mats];n[i]={...m,name:e.target.value};setMats(n);}} style={{flex:1,padding:"8px 10px",borderRadius:6,background:"#ffffff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:13,outline:"none",fontFamily:"inherit"}}/>
              <input value={m.color} onChange={e=>{const n=[...mats];n[i]={...m,color:e.target.value};setMats(n);}} style={{width:80,padding:"8px 10px",borderRadius:6,background:"#ffffff",border:"1px solid #d8d4cc",color:"#847e76",fontSize:12,outline:"none",fontFamily:"monospace"}}/>
              <button onClick={()=>setMats(mats.filter((_,j)=>j!==i))} style={{width:28,height:28,borderRadius:6,background:"#fbeaea",border:"1px solid #f0c9c9",color:"#d23b3b",cursor:"pointer",fontSize:14}}>×</button>
            </div>))}
            <button onClick={addMat} style={{padding:"10px 0",borderRadius:8,background:"#EFC01E22",border:"1px dashed #EFC01E44",color:"#EFC01E",cursor:"pointer",fontSize:12,marginTop:4}}>+ Add Color</button>
          </div>)}
          {tab==="products"&&(<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {accs.map((a,i)=>(<div key={a.id} style={{padding:"10px",borderRadius:8,background:"#f4f2ee",border:"1px solid #e4e1da"}}>
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                <input value={a.name} onChange={e=>{const n=[...accs];n[i]={...a,name:e.target.value};setAccs(n);}} placeholder="Name" style={{flex:1,padding:"6px 8px",borderRadius:5,background:"#ffffff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                <input type="number" value={a.price} onChange={e=>{const n=[...accs];n[i]={...a,price:Number(e.target.value)};setAccs(n);}} placeholder="Price" style={{width:90,padding:"6px 8px",borderRadius:5,background:"#ffffff",border:"1px solid #d8d4cc",color:"#EFC01E",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                <button onClick={()=>setAccs(accs.filter((_,j)=>j!==i))} style={{width:26,height:26,borderRadius:5,background:"#fbeaea",border:"1px solid #f0c9c9",color:"#d23b3b",cursor:"pointer",fontSize:13,flexShrink:0}}>×</button>
              </div>
              <div style={{display:"flex",gap:8}}>
                <input value={a.desc} onChange={e=>{const n=[...accs];n[i]={...a,desc:e.target.value};setAccs(n);}} placeholder="Description" style={{flex:1,padding:"6px 8px",borderRadius:5,background:"#ffffff",border:"1px solid #d8d4cc",color:"#78726a",fontSize:11,outline:"none",fontFamily:"inherit"}}/>
                <select value={a.per} onChange={e=>{const n=[...accs];n[i]={...a,per:e.target.value,perDoor:e.target.value==="per door",perSection:e.target.value==="per section"};setAccs(n);}} style={{padding:"6px 8px",borderRadius:5,background:"#ffffff",border:"1px solid #d8d4cc",color:"#78726a",fontSize:11,outline:"none",fontFamily:"inherit"}}><option value="one-time">one-time</option><option value="per unit">per unit</option><option value="per door">per door</option><option value="per section">per section</option></select>
              </div>
              <input value={a.image||""} onChange={e=>{const n=[...accs];n[i]={...a,image:e.target.value};setAccs(n);}} placeholder="Image URL (optional) — https://..." style={{width:"100%",marginTop:8,padding:"6px 8px",borderRadius:5,background:"#ffffff",border:"1px solid #d8d4cc",color:"#78726a",fontSize:11,outline:"none",fontFamily:"inherit"}}/>
            </div>))}
            <button onClick={addAcc} style={{padding:"10px 0",borderRadius:8,background:"#EFC01E22",border:"1px dashed #EFC01E44",color:"#EFC01E",cursor:"pointer",fontSize:12,marginTop:4}}>+ Add Product</button>
          </div>)}
        </div>
        <div style={{display:"flex",gap:10,padding:"16px 22px",borderTop:"1px solid #e4e1da"}}>
          <button onClick={onClose} style={{flex:1,padding:"12px 0",borderRadius:10,background:"transparent",border:"1px solid #d8d4cc",color:"#847e76",cursor:"pointer",fontSize:13}}>Cancel</button>
          <button onClick={()=>onSave({pricePerSqft:dpr.hinged??pps,doorPricing:dpr,lCornerCharge:lcorner,materials:mats,accessories:accs,business:biz,payment:pay})} style={{flex:1,padding:"12px 0",borderRadius:10,background:"linear-gradient(135deg,#EFC01E,#caa10c)",border:"none",color:"#111",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

// ─── MY DESIGNS MODAL ────────────────────────────────────────
function DesignsModal({designs,onLoad,onDelete,onClose}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(25,22,19,0.38)",backdropFilter:"blur(6px)",padding:20}}>
      <div style={{background:"#ffffff",border:"1px solid #e4e1da",borderRadius:16,width:480,maxWidth:"95vw",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px",borderBottom:"1px solid #e4e1da"}}>
          <h3 style={{fontSize:18,fontWeight:600}}>My Designs</h3>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#9c968e",fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:18}}>
          {(!designs||designs.length===0)&&<p style={{fontSize:13,color:"#9c968e",textAlign:"center",padding:"30px 0"}}>No saved designs yet. Design a wardrobe and tap Save.</p>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(designs||[]).map(d=>(<div key={d.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,background:"#f4f2ee",border:"1px solid #e4e1da"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,color:"#1d1b18",fontWeight:500}}>{d.name}</div>
                <div style={{fontSize:11,color:"#908a82",marginTop:2}}>{toFI(d.config.width)}×{toFI(d.config.height)} · {d.config.sections} doors · Rs. {fmtLKR(d.total||0)}</div>
                <div style={{fontSize:10,color:"#aaa49c",marginTop:1}}>{new Date(d.savedAt).toLocaleDateString('en-GB')}</div>
              </div>
              <button onClick={()=>onLoad(d)} style={{padding:"8px 16px",borderRadius:8,background:"#EFC01E22",border:"1px solid #EFC01E44",color:"#EFC01E",cursor:"pointer",fontSize:12,fontWeight:500}}>Edit</button>
              <button onClick={()=>onDelete(d.id)} style={{width:32,height:32,borderRadius:8,background:"#fbeaea",border:"1px solid #f0c9c9",color:"#d23b3b",cursor:"pointer",fontSize:14}}>×</button>
            </div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CaptureModal({onSubmit,onClose,action}){
  const[name,setName]=useState('');const[phone,setPhone]=useState('');const[city,setCity]=useState('');
  const cities=["Colombo","Kandy","Galle","Negombo","Jaffna","Kurunegala","Ratnapura","Matara","Batticaloa","Trincomalee","Anuradhapura","Badulla","Other"];
  const valid=name.trim()&&phone.trim()&&phone.length>=9;
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(25,22,19,0.38)",backdropFilter:"blur(6px)"}}>
      <div style={{background:"#f4f2ee",border:"1px solid #e4e1da",borderRadius:16,padding:28,width:380,maxWidth:"90vw"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{fontSize:18,color:"#1d1b18",fontWeight:600}}>{action==="whatsapp"?"Share via WhatsApp":"Get Your Quote"}</h3>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#9c968e",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><label style={{fontSize:11,color:"#847e76",textTransform:"uppercase",display:"block",marginBottom:4}}>Name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" style={{width:"100%",padding:"10px 12px",borderRadius:8,background:"#ffffff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:14,outline:"none",fontFamily:"inherit"}}/></div>
          <div><label style={{fontSize:11,color:"#847e76",textTransform:"uppercase",display:"block",marginBottom:4}}>Phone *</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07X XXXX XXX" type="tel" style={{width:"100%",padding:"10px 12px",borderRadius:8,background:"#ffffff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:14,outline:"none",fontFamily:"inherit"}}/></div>
          <div><label style={{fontSize:11,color:"#847e76",textTransform:"uppercase",display:"block",marginBottom:4}}>City</label><select value={city} onChange={e=>setCity(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:8,background:"#ffffff",border:"1px solid #d8d4cc",color:city?"#1d1b18":"#9c968e",fontSize:14,outline:"none",fontFamily:"inherit"}}><option value="">Select city</option>{cities.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <button onClick={()=>{if(valid)onSubmit({name:name.trim(),phone:phone.trim(),city});}} disabled={!valid} style={{width:"100%",padding:"14px 0",borderRadius:10,marginTop:20,background:valid?"linear-gradient(135deg,#EFC01E,#caa10c)":"#d8d4cc",border:"none",color:valid?"#111":"#9c968e",fontSize:14,fontWeight:600,cursor:valid?"pointer":"not-allowed"}}>{action==="whatsapp"?"Send via WhatsApp":"Download PDF"}</button>
      </div>
    </div>
  );
}

function LandingPage({onStart,onPreset,settings}){
  return(
    <div style={{width:"100%",minHeight:"100vh",background:"#f7f6f3",color:"#1d1b18",fontFamily:"'Poppins',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{padding:"80px 40px 60px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-100,left:"50%",transform:"translateX(-50%)",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,#EFC01E08 0%,transparent 70%)"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"inline-block",padding:"6px 20px",borderRadius:24,background:"#EFC01E12",border:"1px solid #EFC01E20",marginBottom:28}}><span style={{fontSize:12,color:"#EFC01E",fontWeight:500}}>Sri Lanka's First 3D Wardrobe Designer</span></div>
          <h1 style={{fontSize:"clamp(36px,5.5vw,58px)",fontWeight:700,lineHeight:1.1,marginBottom:20,letterSpacing:"-0.03em"}}>Design Your Dream<br/><span style={{background:"linear-gradient(135deg,#EFC01E,#D4B87C)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Wardrobe &amp; Closet</span></h1>
          <p style={{fontSize:17,color:"#847e76",maxWidth:520,margin:"0 auto 36px",lineHeight:1.7,fontWeight:300}}>Customize every detail in real-time 3D. Get an instant quote on WhatsApp.</p>
          <button onClick={onStart} style={{padding:"16px 44px",borderRadius:12,background:"linear-gradient(135deg,#EFC01E,#B8944A)",border:"none",color:"#111",fontSize:16,fontWeight:600,cursor:"pointer",boxShadow:"0 8px 32px #EFC01E30"}}>Start Designing</button>
        </div>
      </div>
      <div style={{padding:"30px 40px 60px",maxWidth:1200,margin:"0 auto"}}>
        <h2 style={{fontSize:28,fontWeight:600,marginBottom:8,textAlign:"center"}}>Popular Designs</h2>
        <p style={{fontSize:14,color:"#908a82",textAlign:"center",marginBottom:36}}>Choose a starting point and customize it fully.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:18}}>
          {PRESETS.map(p=>{const sq=mmToSqft(p.width,p.height);const pr=Math.round(sq*settings.pricePerSqft);const mc={};p.modules.forEach(m=>{mc[m.type]=(mc[m.type]||0)+1;});return(
            <button key={p.id} onClick={()=>onPreset(p)} style={{padding:0,borderRadius:14,background:"#ffffff",border:"1px solid #eae7e1",cursor:"pointer",textAlign:"left",overflow:"hidden",transition:"all 0.25s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="#EFC01E55";e.currentTarget.style.transform="translateY(-3px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="#eae7e1";e.currentTarget.style.transform="none";}}>
              <div style={{height:166,background:"linear-gradient(180deg,#faf9f6,#f1efe9)",borderBottom:"1px solid #eee",padding:"4px 8px"}} dangerouslySetInnerHTML={{__html:presetThumb(p)}}/>
              <div style={{padding:"18px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><div><div style={{fontSize:16,fontWeight:600,marginBottom:3}}>{p.name}</div><div style={{fontSize:11,color:"#EFC01E"}}>{p.badge}</div></div><span style={{fontSize:10,color:"#847e76",background:"#f0eee9",padding:"4px 10px",borderRadius:6,border:"1px solid #e4e1da"}}>{p.tag}</span></div>
                <div style={{display:"flex",gap:16,marginBottom:12,fontSize:12,color:"#78726a"}}><div>{toFI(p.width)} × {toFI(p.height)}</div><div>{p.sections} doors</div></div>
                <div style={{display:"flex",gap:8,marginBottom:14}}>{mc.rail&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:"#f0eee9",color:"#6b655d",border:"1px solid #e4e1da"}}>{mc.rail} Rails</span>}{mc.shelf&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:"#f0eee9",color:"#6b655d",border:"1px solid #e4e1da"}}>{mc.shelf} Shelves</span>}{mc.drawer&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:"#f0eee9",color:"#6b655d",border:"1px solid #e4e1da"}}>{mc.drawer} Drawers</span>}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid #e4e1da"}}><span style={{fontSize:11,color:"#9c968e"}}>{sq} sqft</span><span style={{fontSize:16,color:"#EFC01E",fontWeight:600}}>~Rs. {fmtLKR(pr)}</span></div>
              </div>
            </button>
          );})}
        </div>
      </div>
    </div>
  );
}

// ─── FULLSCREEN DRAWING PAGE (2D or 3D) ──────────────────────
function DrawingPage({mode,config,settings,canvasRef,onClose}){
  const price=calcPriceLKR(config,settings);
  return(
    <div style={{position:"fixed",inset:0,zIndex:900,background:mode==="2d"?"#fff":"#f4f2ee",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 24px",borderBottom:"1px solid "+(mode==="2d"?"#eee":"#e4e1da"),background:mode==="2d"?"#faf9f7":"#ffffff"}}>
        <div style={{fontSize:16,fontWeight:600,color:mode==="2d"?"#d8d4cc":"#1d1b18"}}>{mode==="2d"?"2D Technical Drawing":mode==="dims"?"Overall Dimensions":"3D Visualization"} <span style={{fontSize:12,color:"#78726a",fontWeight:400,marginLeft:8}}>A4 Preview</span></div>
        <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,background:mode==="2d"?"#d8d4cc":"#EFC01E22",border:mode==="2d"?"none":"1px solid #EFC01E44",color:mode==="2d"?"#fff":"#EFC01E",cursor:"pointer",fontSize:13,fontWeight:500}}>Close</button>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:30,overflow:"auto"}}>
        {/* A4 aspect page */}
        <div style={{width:"min(210mm,90vw)",aspectRatio:"210/297",background:"#fff",boxShadow:"0 10px 50px rgba(0,0,0,0.4)",borderRadius:4,padding:"8%",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",borderBottom:"2px solid #EFC01E",paddingBottom:12,marginBottom:20}}>
            <div><div style={{fontSize:22,fontWeight:700,color:"#EFC01E"}}>{BRAND}</div><div style={{fontSize:9,color:"#78726a",letterSpacing:"2px",textTransform:"uppercase"}}>Wardrobe Studio</div></div>
            <div style={{textAlign:"right",fontSize:11,color:"#9c968e"}}><b style={{color:"#d8d4cc"}}>{mode==="2d"?"TECHNICAL DRAWING":mode==="dims"?"OVERALL DIMENSIONS":"3D VISUALIZATION"}</b><br/>{new Date().toLocaleDateString('en-GB')}</div>
          </div>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid #eee",borderRadius:8,overflow:"hidden"}}>
            {mode==="2d"?<div style={{width:"100%"}} dangerouslySetInnerHTML={{__html:gen2DSvg(config,settings.materials,640,520,settings.business?.name||BRAND)}}/>:mode==="dims"?<div style={{width:"100%"}} dangerouslySetInnerHTML={{__html:genDimsSvg(config,settings.materials,700,560,settings.business?.name||BRAND)}}/>:<img src={(()=>{try{return canvasRef.current.toDataURL("image/png");}catch(e){return "";}})()} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>}
          </div>
          <div style={{display:"flex",justifyContent:"space-around",marginTop:20,paddingTop:14,borderTop:"1px solid #eee"}}>
            {[[toFI(config.width),"Width"],[toFI(config.height),"Height"],[toFI(config.depth),"Depth"],[price.sqft,"Sq.ft"]].map(([n,l])=>(<div key={l} style={{textAlign:"center"}}><div style={{fontSize:14,fontWeight:600,color:"#EFC01E"}}>{n}</div><div style={{fontSize:9,color:"#78726a",textTransform:"uppercase",letterSpacing:"0.5px"}}>{l}</div></div>))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AR "VIEW IN MY ROOM" ─────────────────────────────────────
function buildExportScene(config,materials){
  const scene=new THREE.Scene();
  buildWardrobe(scene,config,materials,false);
  const g=scene.getObjectByName("w");
  // Recenter on floor so AR places it standing on the ground
  const box=new THREE.Box3().setFromObject(g);const c=box.getCenter(new THREE.Vector3());
  g.position.x-=c.x;g.position.z-=c.z;g.position.y-=box.min.y;
  return g;
}
function ARModal({config,settings,user,onClose}){
  const[state,setState]=useState("preparing"); // preparing | ready | error | nocloud
  const[glb,setGlb]=useState(null);const[usdz,setUsdz]=useState(null);
  const mvRef=useRef(null);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      if(!useCloud){setState("nocloud");return;}
      try{
        const obj=buildExportScene(config,settings.materials);
        const glbBlob=await new Promise((res,rej)=>{new GLTFExporter().parse(obj,r=>res(new Blob([r],{type:"model/gltf-binary"})),rej,{binary:true});});
        let usdzBlob=null;try{const u=await new USDZExporter().parseAsync(obj);usdzBlob=new Blob([u],{type:"model/vnd.usdz+zip"});}catch(e){}
        const glbUrl=await dbUploadARModel(user.email,"glb",glbBlob);
        const usdzUrl=usdzBlob?await dbUploadARModel(user.email,"usdz",usdzBlob):null;
        if(cancelled)return;
        if(!glbUrl){setState("error");return;}
        setGlb(glbUrl);setUsdz(usdzUrl);setState("ready");
      }catch(e){if(!cancelled){console.error(e);setState("error");}}
    })();
    return()=>{cancelled=true;};
  },[]);
  // load <model-viewer> script once
  useEffect(()=>{
    if(document.querySelector('script[data-mv]'))return;
    const s=document.createElement("script");s.type="module";s.dataset.mv="1";
    s.src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";
    document.head.appendChild(s);
  },[]);
  return(
    <div style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(25,22,19,0.55)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:16,width:560,maxWidth:"96vw",height:"88vh",maxHeight:"88vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid #e4e1da",flexShrink:0}}>
          <div><h3 style={{fontSize:17,fontWeight:700}}>View in Your Room</h3><div style={{fontSize:11,color:"#9c968e"}}>Point your phone at the floor to place the wardrobe</div></div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#9c968e",fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,minHeight:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#f4f2ee",position:"relative"}}>
          {state==="preparing"&&<div style={{textAlign:"center",color:"#9c968e",fontSize:13}}><div style={{width:34,height:34,border:"3px solid #e4e1da",borderTopColor:"#EFC01E",borderRadius:"50%",margin:"0 auto 12px",animation:"arspin 0.8s linear infinite"}}/>Preparing your 3D model…<style>{`@keyframes arspin{to{transform:rotate(360deg)}}`}</style></div>}
          {state==="nocloud"&&<div style={{textAlign:"center",color:"#847e76",fontSize:13,padding:30}}>AR requires the cloud database to be connected. Add your Supabase keys to enable “View in My Room”.</div>}
          {state==="error"&&<div style={{textAlign:"center",color:"#c62828",fontSize:13,padding:30}}>Couldn’t prepare the AR model. Make sure the <b>ar-models</b> storage bucket exists (run supabase-ar.sql).</div>}
          {state==="ready"&&(<model-viewer src={glb} ios-src={usdz||undefined} ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" camera-controls auto-rotate shadow-intensity="1" exposure="1.0" style={{width:"100%",height:"100%",background:"#f4f2ee"}}>
            <button slot="ar-button" style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",padding:"14px 28px",borderRadius:12,background:"#EFC01E",color:"#1d1b18",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 16px rgba(239,192,30,0.4)",whiteSpace:"nowrap"}}>📷 View in My Room</button>
          </model-viewer>)}
          {state==="ready"&&usdz&&(<a href={usdz} rel="ar" style={{position:"absolute",bottom:20,right:16,fontSize:11,color:"#9a7a0a",textDecoration:"underline"}}>iPhone AR</a>)}
        </div>
        <div style={{padding:"12px 20px",borderTop:"1px solid #e4e1da",fontSize:11,color:"#9c968e",textAlign:"center",flexShrink:0}}>Android needs “Google Play Services for AR” · open in Chrome for best results</div>
      </div>
    </div>
  );
}

// ─── SUPER ADMIN PLATFORM DASHBOARD ──────────────────────────
function PlatformModal({onClose,plans,addons,onSavePlans}){
  const[rows,setRows]=useState(null);
  const[planPick,setPlanPick]=useState({});
  const[pl,setPl]=useState(JSON.parse(JSON.stringify(plans||PLANS)));
  const[sa,setSa]=useState(JSON.parse(JSON.stringify(addons||SOCIAL_ADDONS)));
  const[plOpen,setPlOpen]=useState(false);
  const load=useCallback(async()=>{setRows(await dbAdminCompanies());},[]);
  useEffect(()=>{load();},[load]);
  const[detail,setDetail]=useState(null);const[dLeads,setDLeads]=useState([]);const[dBiz,setDBiz]=useState(null);const[dNote,setDNote]=useState("");const[dLoading,setDLoading]=useState(false);const[dSaved,setDSaved]=useState(false);
  const openDetail=async(email)=>{setDLoading(true);setDetail({email});const[d,l]=await Promise.all([dbAdminCompanyDetail(email),dbAdminCompanyLeads(email)]);setDetail(d);setDBiz({...d.business});setDNote(d.adminNote||"");setDLeads(l||[]);setDLoading(false);};
  const saveDetail=async()=>{await dbAdminUpdateCompany(detail.email,dBiz);await dbAdminSetNote(detail.email,dNote);setDSaved(true);setTimeout(()=>setDSaved(false),1800);await load();};
  const days=ts=>ts?Math.floor((Date.now()-ts)/86400000):null;
  const setStatus=async(email,status,plan)=>{await dbSetAccount(email,status,plan||null);await load();};
  const fmtV=v=>v>=1000000?(v/1000000).toFixed(1)+"M":v>=1000?Math.round(v/1000)+"K":String(v);
  const badge=(s)=>({demo:["DEMO","#9c968e","#f0eee9"],active:["ACTIVE","#2e7d32","#e5f2e6"],suspended:["SUSPENDED","#c62828","#fbeaea"]}[s]||["?","#888","#eee"]);
  const total=rows?rows.length:0;
  const active=rows?rows.filter(r=>r.status==="active").length:0;
  const demos=rows?rows.filter(r=>r.status==="demo").length:0;
  const totQ=rows?rows.reduce((a,r)=>a+r.quotes,0):0;
  const totV=rows?rows.reduce((a,r)=>a+r.quoteValue,0):0;
  // Attention: active companies quiet for 7+ days, or demos quiet 3+ days (follow up to convert)
  const attention=rows?rows.filter(r=>{const d=days(r.lastActivity);return (r.status==="active"&&(d===null||d>=7))||(r.status==="demo"&&r.quotes>0&&(d===null||d>=3));}):[];
  const card=(label,val,sub)=>(<div style={{flex:1,minWidth:110,background:"#faf9f7",border:"1px solid #e4e1da",borderRadius:12,padding:"14px 16px"}}><div style={{fontSize:22,fontWeight:700,color:"#1d1b18"}}>{val}</div><div style={{fontSize:11,color:"#9c968e"}}>{label}</div>{sub&&<div style={{fontSize:10,color:"#EFC01E",marginTop:2}}>{sub}</div>}</div>);
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(25,22,19,0.38)",backdropFilter:"blur(6px)",padding:20}}>
      <div style={{background:"#ffffff",border:"1px solid #e4e1da",borderRadius:16,width:980,maxWidth:"97vw",maxHeight:"92vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 24px",borderBottom:"1px solid #e4e1da"}}>
          <div><h3 style={{fontSize:18,fontWeight:700}}>Platform — Companies &amp; Reports</h3><div style={{fontSize:11,color:"#9c968e"}}>Super admin · approve payments, set plans, watch activity</div></div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#9c968e",fontSize:22,cursor:"pointer"}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:24}}>
          {!rows?<div style={{color:"#9c968e",fontSize:13}}>Loading companies…</div>:(<>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:18}}>
            {card("Companies",total)}{card("Active (paying)",active)}{card("Demos",demos)}{card("Quotes generated",totQ)}{card("Quote value",`Rs. ${fmtV(totV)}`)}
          </div>
          <div style={{background:"#faf9f7",border:"1px solid #e4e1da",borderRadius:12,padding:"12px 16px",marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setPlOpen(!plOpen)}>
              <div style={{fontSize:13,fontWeight:700,color:"#1d1b18"}}>Packages &amp; Pricing <span style={{fontSize:10,color:"#9c968e",fontWeight:400}}>(shown when activating a company)</span></div>
              <span style={{color:"#9c968e",fontSize:12}}>{plOpen?"▲":"▼ edit"}</span>
            </div>
            {plOpen&&(<div style={{marginTop:12}}>
              <div style={{display:"flex",gap:8,fontSize:9,color:"#9c968e",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:4,padding:"0 2px"}}><span style={{flex:2}}>Package</span><span style={{width:90,textAlign:"center"}}>Tier</span><span style={{width:96,textAlign:"right"}}>Monthly</span><span style={{width:96,textAlign:"right"}}>Onboarding</span><span style={{width:18}}></span></div>
              {pl.map((p,i)=>(<div key={p.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                <input value={p.name} onChange={e=>{const n=[...pl];n[i]={...p,name:e.target.value};setPl(n);}} placeholder="Package name" style={{flex:2,padding:"7px 10px",borderRadius:6,background:"#fff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                <select value={p.tier||"starter"} onChange={e=>{const n=[...pl];n[i]={...p,tier:e.target.value};setPl(n);}} style={{width:90,padding:"7px 6px",borderRadius:6,background:"#fff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:11,outline:"none"}}><option value="starter">Starter</option><option value="pro">Pro</option></select>
                <input type="number" value={p.price} onChange={e=>{const n=[...pl];n[i]={...p,price:Math.max(0,Number(e.target.value)||0)};setPl(n);}} style={{width:96,padding:"7px 10px",borderRadius:6,background:"#fff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:12,outline:"none",fontFamily:"inherit",textAlign:"right"}}/>
                <input type="number" value={p.onboarding??0} onChange={e=>{const n=[...pl];n[i]={...p,onboarding:Math.max(0,Number(e.target.value)||0)};setPl(n);}} style={{width:96,padding:"7px 10px",borderRadius:6,background:"#fff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:12,outline:"none",fontFamily:"inherit",textAlign:"right"}}/>
                <button onClick={()=>setPl(pl.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#c62828",cursor:"pointer",fontSize:15,width:18}}>×</button>
              </div>))}
              <div style={{fontSize:10,color:"#9c968e",margin:"2px 2px 12px"}}>Pro-tier packages unlock the Cut List, L-shaped wardrobes and AR. Starter sells; Pro builds.</div>
              <div style={{fontSize:12,fontWeight:700,color:"#1d1b18",margin:"14px 0 6px"}}>Social Media Add-ons <span style={{fontSize:10,color:"#9c968e",fontWeight:400}}>(optional, any tier)</span></div>
              {sa.map((a,i)=>(<div key={a.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                <input value={a.name} onChange={e=>{const n=[...sa];n[i]={...a,name:e.target.value};setSa(n);}} placeholder="Add-on name" style={{flex:2,padding:"7px 10px",borderRadius:6,background:"#fff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                <span style={{fontSize:11,color:"#9c968e"}}>Rs.</span>
                <input type="number" value={a.price} onChange={e=>{const n=[...sa];n[i]={...a,price:Math.max(0,Number(e.target.value)||0)};setSa(n);}} style={{width:100,padding:"7px 10px",borderRadius:6,background:"#fff",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:12,outline:"none",fontFamily:"inherit",textAlign:"right"}}/>
                <span style={{fontSize:11,color:"#9c968e"}}>/mo</span>
                <button onClick={()=>setSa(sa.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#c62828",cursor:"pointer",fontSize:15,width:18}}>×</button>
              </div>))}
              <div style={{display:"flex",gap:8,marginTop:6}}>
                <button onClick={()=>setPl([...pl,{id:"plan-"+Date.now(),name:"New Package",tier:"starter",price:9900,onboarding:15000}])} style={{padding:"7px 14px",borderRadius:6,background:"#fff",border:"1px dashed #EFC01E",color:"#EFC01E",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Package</button>
                <button onClick={()=>setSa([...sa,{id:"addon-"+Date.now(),name:"New Add-on",price:15000}])} style={{padding:"7px 14px",borderRadius:6,background:"#fff",border:"1px dashed #EFC01E",color:"#EFC01E",fontSize:11,fontWeight:600,cursor:"pointer"}}>+ Add-on</button>
                <button onClick={async()=>{await onSavePlans(pl,sa);setPlOpen(false);}} style={{padding:"7px 16px",borderRadius:6,background:"#EFC01E",border:"none",color:"#1d1b18",fontSize:11,fontWeight:600,cursor:"pointer"}}>Save Packages</button>
              </div>
            </div>)}
          </div>
          {attention.length>0&&(<div style={{background:"#fff8ec",border:"1px solid #ecd9b0",borderRadius:12,padding:"14px 16px",marginBottom:18}}>
            <div style={{fontSize:13,fontWeight:700,color:"#8a6c08",marginBottom:8}}>⚠ Needs a call</div>
            {attention.map(r=>{const d=days(r.lastActivity);return(<div key={r.email} style={{fontSize:12,color:"#6b5635",padding:"3px 0"}}>
              <b>{r.name}</b> — {r.status==="demo"?`tried the demo (${r.quotes} quote${r.quotes!==1?"s":""}) but ${d===null?"no activity since":"quiet for "+d+" days"} — call to convert`:`no activity in ${d===null?"a while":d+" days"} — call before they cancel`}
            </div>);})}
          </div>)}
          <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{textAlign:"left",color:"#9c968e",fontSize:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>
              <th style={{padding:"8px 10px"}}>Company</th><th style={{padding:"8px 10px"}}>Status / Plan</th><th style={{padding:"8px 10px"}}>Using for</th><th style={{padding:"8px 10px"}}>Designs</th><th style={{padding:"8px 10px"}}>Quotes</th><th style={{padding:"8px 10px"}}>Value</th><th style={{padding:"8px 10px"}}>Last activity</th><th style={{padding:"8px 10px"}}>Actions</th>
            </tr></thead>
            <tbody>
            {rows.map(r=>{const[bl,bc,bb]=badge(r.status);const dJ=days(r.joined);const dA=days(r.lastActivity);const stale=r.status==="active"&&dA!==null&&dA>=7;
              return(<tr key={r.email} style={{borderTop:"1px solid #f0eee9"}}>
                <td style={{padding:"10px"}}><div onClick={()=>openDetail(r.email)} style={{fontWeight:600,color:"#9a7a0a",cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted"}}>{r.name}</div><div style={{fontSize:10,color:"#9c968e"}}>{r.email}</div></td>
                <td style={{padding:"10px"}}><span style={{padding:"3px 9px",borderRadius:10,fontSize:9.5,fontWeight:700,color:bc,background:bb}}>{bl}</span>{r.plan&&<div style={{fontSize:10,color:"#6b655d",marginTop:4}}>{planLabel((plans||PLANS).find(p=>p.id===r.plan))||r.plan}</div>}</td>
                <td style={{padding:"10px",color:"#6b655d"}}>{dJ===null?"—":dJ===0?"today":dJ+" days"}</td>
                <td style={{padding:"10px",color:"#6b655d"}}>{r.designs}</td>
                <td style={{padding:"10px",color:"#6b655d"}}>{r.quotes}</td>
                <td style={{padding:"10px",color:"#6b655d"}}>Rs. {fmtV(r.quoteValue)}</td>
                <td style={{padding:"10px",color:stale?"#c62828":"#6b655d",fontWeight:stale?600:400}}>{dA===null?"never":dA===0?"today":dA+" days ago"}{stale?" ⚠":""}</td>
                <td style={{padding:"10px"}}>
                  {r.status!=="active"?(<div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <select value={planPick[r.email]||"starter"} onChange={e=>setPlanPick({...planPick,[r.email]:e.target.value})} style={{fontSize:10,padding:"5px 6px",borderRadius:6,border:"1px solid #d8d4cc",background:"#fff",color:"#34302b",maxWidth:150}}>
                      {(plans||PLANS).map(p=>(<option key={p.id} value={p.id}>{planLabel(p)}</option>))}
                    </select>
                    <button onClick={()=>setStatus(r.email,"active",planPick[r.email]||(plans||PLANS)[0]?.id||"starter")} style={{padding:"5px 12px",borderRadius:6,background:"#2e7d32",border:"none",color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer"}}>Activate</button>
                  </div>):(<div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setStatus(r.email,"suspended",r.plan)} style={{padding:"5px 12px",borderRadius:6,background:"#fbeaea",border:"1px solid #f0c9c9",color:"#c62828",fontSize:10,fontWeight:600,cursor:"pointer"}}>Suspend</button>
                  </div>)}
                </td>
              </tr>);})}
            </tbody>
          </table>
          </div>
          {rows.length===0&&<div style={{color:"#9c968e",fontSize:13,padding:20,textAlign:"center"}}>No companies yet. They appear here after their first login + save.</div>}
          </>)}
        </div>
      </div>
      {detail&&(<div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(25,22,19,0.5)",display:"flex",justifyContent:"flex-end"}} onClick={()=>setDetail(null)}>
        <div onClick={e=>e.stopPropagation()} style={{width:480,maxWidth:"94vw",height:"100%",background:"#fff",overflowY:"auto",boxShadow:"-8px 0 30px rgba(0,0,0,0.2)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"18px 22px",borderBottom:"1px solid #e4e1da",position:"sticky",top:0,background:"#fff",zIndex:2}}>
            <div><h3 style={{fontSize:17,fontWeight:700,color:"#1d1b18"}}>{detail.name||"Company"}</h3><div style={{fontSize:11,color:"#9c968e"}}>{detail.email}</div></div>
            <button onClick={()=>setDetail(null)} style={{background:"transparent",border:"none",color:"#9c968e",fontSize:22,cursor:"pointer"}}>×</button>
          </div>
          {dLoading?(<div style={{padding:40,textAlign:"center",color:"#9c968e",fontSize:13}}>Loading…</div>):(<div style={{padding:"18px 22px"}}>
            <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
              {(()=>{const[bl,bc,bb]=badge(detail.status);return(<span style={{padding:"4px 11px",borderRadius:10,fontSize:10,fontWeight:700,color:bc,background:bb}}>{bl}</span>);})()}
              {detail.plan&&<span style={{padding:"4px 11px",borderRadius:10,fontSize:10,fontWeight:600,color:"#6b655d",background:"#f0eee9"}}>{planLabel((plans||PLANS).find(p=>p.id===detail.plan))||detail.plan}</span>}
              <span style={{padding:"4px 11px",borderRadius:10,fontSize:10,color:"#6b655d",background:"#f0eee9"}}>{dLeads.length} quotes · Rs. {fmtV(dLeads.reduce((a,x)=>a+(x.total||0),0))}</span>
            </div>
            <div style={{fontSize:11,color:"#EFC01E",fontWeight:700,marginBottom:10,letterSpacing:"0.05em"}}>CONTACT &amp; BUSINESS DETAILS <span style={{color:"#9c968e",fontWeight:400,textTransform:"none",letterSpacing:0}}>(editable)</span></div>
            {[["Company Name","name"],["Phone","phone"],["Email","email"],["Address","address"],["Tagline","tagline"]].map(([l,k])=>(<div key={k} style={{marginBottom:10}}><span style={{fontSize:10,color:"#9c968e",textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</span><input value={(dBiz&&dBiz[k])||""} onChange={e=>setDBiz({...dBiz,[k]:e.target.value})} style={{width:"100%",marginTop:4,padding:"9px 11px",borderRadius:8,background:"#f4f2ee",border:"1px solid #d8d4cc",color:"#1d1b18",fontSize:13,outline:"none",fontFamily:"inherit"}}/></div>))}
            <div style={{display:"flex",gap:8,margin:"6px 0 18px"}}>
              {dBiz&&dBiz.phone&&<a href={`https://wa.me/${(dBiz.phone||"").replace(/[^0-9]/g,"")}`} target="_blank" rel="noreferrer" style={{flex:1,textAlign:"center",padding:"9px 0",borderRadius:8,background:"#25D366",color:"#fff",fontSize:12,fontWeight:600,textDecoration:"none"}}>WhatsApp</a>}
              {detail.email&&<a href={`mailto:${detail.email}`} style={{flex:1,textAlign:"center",padding:"9px 0",borderRadius:8,background:"#f0eee9",border:"1px solid #d8d4cc",color:"#6b655d",fontSize:12,fontWeight:600,textDecoration:"none"}}>Email</a>}
            </div>
            <div style={{fontSize:11,color:"#EFC01E",fontWeight:700,marginBottom:8,letterSpacing:"0.05em"}}>SUPER-ADMIN NOTE / FLAG</div>
            <textarea value={dNote} onChange={e=>setDNote(e.target.value)} placeholder="e.g. Called 22 Jun — slow month, following up next week" style={{width:"100%",minHeight:60,padding:"9px 11px",borderRadius:8,background:"#fffdf8",border:"1px solid #ecd9b0",color:"#1d1b18",fontSize:12,outline:"none",fontFamily:"inherit",resize:"vertical",marginBottom:8}}/>
            <button onClick={saveDetail} style={{width:"100%",padding:"11px 0",borderRadius:9,background:dSaved?"#2e7d32":"linear-gradient(135deg,#EFC01E,#caa10c)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:20}}>{dSaved?"✓ Saved":"Save Details & Note"}</button>
            <div style={{fontSize:11,color:"#EFC01E",fontWeight:700,marginBottom:10,letterSpacing:"0.05em"}}>QUOTES / INVOICES ({dLeads.length})</div>
            {dLeads.length===0?(<div style={{fontSize:12,color:"#9c968e",padding:"12px 0"}}>No quotes captured yet.</div>):(<div style={{display:"flex",flexDirection:"column",gap:6}}>
              {dLeads.map((ld,i)=>{const ts=ld.created_at?(typeof ld.created_at==="number"?ld.created_at:new Date(ld.created_at).getTime()):null;return(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",borderRadius:8,background:"#f4f2ee",border:"1px solid #e4e1da"}}><div><div style={{fontSize:12,fontWeight:600,color:"#1d1b18"}}>{ld.name||ld.customer||"Customer"}</div><div style={{fontSize:10,color:"#9c968e"}}>{ld.phone||"—"}{ld.city?` · ${ld.city}`:""}{ts?` · ${new Date(ts).toLocaleDateString('en-GB')}`:""}</div></div><div style={{fontSize:12,fontWeight:700,color:"#9a7a0a"}}>Rs. {fmtV(ld.total||0)}</div></div>);})}
            </div>)}
            {useCloud?null:<div style={{fontSize:10,color:"#c9a24b",background:"#fffdf5",border:"1px solid #ecd9b0",borderRadius:8,padding:"8px 10px",marginTop:14}}>Note: in this local preview you can only see your own company's data. On the live (Supabase) site, every company's details &amp; invoices load here.</div>}
          </div>)}
        </div>
      </div>)}
    </div>
  );
}

// ─── PUBLIC MARKETING HOME ───────────────────────────────────
function PublicHome({onLogin,settings}){
  const accent="#EFC01E";
  const features=[
    {t:"Real-time 3D design",d:"Configure dimensions, materials, doors and interior layout — and watch it build live in 3D in front of your customer."},
    {t:"Instant quotes",d:"Automatic LKR pricing as you design. Send a branded quote to WhatsApp or download a 3-page PDF in one tap."},
    {t:"Workshop cut list",d:"Generate a manufacturing cut list — every panel size, hardware count and edge-banding — ready for the floor."},
    {t:"Your brand, not ours",d:"White-label everything: your logo, colours, pricing and contact details on every quote and drawing."},
  ];
  const steps=[
    {n:"1",t:"Measure",d:"Enter the wardrobe size — width, height, depth."},
    {n:"2",t:"Design",d:"Pick material, doors, shelves, drawers, rails and add-ons."},
    {n:"3",t:"Quote",d:"Share the price and 2D/3D drawings instantly."},
    {n:"4",t:"Build",d:"Hand the cut list to your workshop."},
  ];
  // Full-page faded blueprint background (pure SVG/CSS — no WebGL)
  const Blueprint=()=>(
    <div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",opacity:0.15,pointerEvents:"none",zIndex:0}}>
      <style>{`
        .bpDraw{stroke-dasharray:340;stroke-dashoffset:340;animation:bpDr 9s ease-in-out infinite}
        @keyframes bpDr{0%{stroke-dashoffset:340}26%{stroke-dashoffset:0}82%{stroke-dashoffset:0;opacity:1}92%{opacity:0}100%{stroke-dashoffset:340;opacity:0}}
        .bpDim{opacity:0;animation:bpDt 9s ease-in-out infinite}
        @keyframes bpDt{0%,30%{opacity:0}40%,82%{opacity:1}92%,100%{opacity:0}}
      `}</style>
      <svg viewBox="0 0 470 330" style={{width:"min(110vw,1500px)",height:"auto",maxHeight:"96vh"}} preserveAspectRatio="xMidYMid meet">
        <g fill="none" stroke="#4a4640" strokeWidth="1.5" strokeLinecap="round">
          <rect className="bpDraw" x="75" y="62" width="320" height="210" rx="2"/>
          <line className="bpDraw" x1="155" y1="62" x2="155" y2="272"/>
          <line className="bpDraw" x1="235" y1="62" x2="235" y2="272"/>
          <line className="bpDraw" x1="315" y1="62" x2="315" y2="272"/>
          <line className="bpDraw" x1="83" y1="88" x2="147" y2="88"/>
          <circle className="bpDraw" cx="88" cy="88" r="3"/><circle className="bpDraw" cx="142" cy="88" r="3"/>
          <line className="bpDraw" x1="163" y1="112" x2="227" y2="112"/>
          <line className="bpDraw" x1="163" y1="152" x2="227" y2="152"/>
          <line className="bpDraw" x1="163" y1="192" x2="227" y2="192"/>
          <rect className="bpDraw" x="245" y="120" width="60" height="34" rx="2"/>
          <rect className="bpDraw" x="245" y="160" width="60" height="34" rx="2"/>
          <rect className="bpDraw" x="245" y="200" width="60" height="34" rx="2"/>
          <line className="bpDraw" x1="323" y1="112" x2="387" y2="112"/>
          <line className="bpDraw" x1="323" y1="160" x2="387" y2="160"/>
          <line className="bpDraw" x1="323" y1="212" x2="387" y2="212"/>
        </g>
        <g stroke="#E05050" strokeWidth="1">
          <line className="bpDraw" x1="75" y1="46" x2="395" y2="46"/>
          <line x1="75" y1="41" x2="75" y2="51"/><line x1="395" y1="41" x2="395" y2="51"/>
          <line className="bpDraw" x1="57" y1="62" x2="57" y2="272"/>
          <line x1="52" y1="62" x2="62" y2="62"/><line x1="52" y1="272" x2="62" y2="272"/>
          <line className="bpDraw" x1="75" y1="288" x2="155" y2="288"/>
          <line className="bpDraw" x1="315" y1="288" x2="395" y2="288"/>
        </g>
        <g className="bpDim" fontFamily="Poppins" fontWeight="600" fill="#E05050">
          <text x="235" y="38" textAnchor="middle" fontSize="13">88"</text>
          <text x="40" y="171" textAnchor="middle" fontSize="13">84"</text>
          <text x="115" y="302" textAnchor="middle" fontSize="11">22"</text>
          <text x="355" y="302" textAnchor="middle" fontSize="11">22"</text>
        </g>
      </svg>
    </div>
  );
  return(
    <div style={{width:"100%",minHeight:"100vh",background:"#f7f6f3",color:"#1d1b18",fontFamily:"'Poppins',sans-serif",position:"relative"}}>
      <Blueprint/>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
      {/* Nav */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 6vw",position:"sticky",top:0,background:"#f7f6f3ee",backdropFilter:"blur(10px)",zIndex:50,borderBottom:"1px solid #ece9e4"}}>
        <div style={{fontSize:22,fontWeight:800,color:accent,letterSpacing:"-0.02em"}}>{settings?.business?.name||BRAND}</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={()=>{const el=document.getElementById('pricing');if(el)el.scrollIntoView({behavior:'smooth'});}} style={{padding:"9px 16px",borderRadius:9,background:"transparent",border:"none",color:"#1d1b18",fontSize:14,fontWeight:600,cursor:"pointer"}}>Pricing</button>
          <button onClick={onLogin} style={{padding:"9px 20px",borderRadius:9,background:"#fff",border:"1px solid #e4e1da",color:"#1d1b18",fontSize:14,fontWeight:600,cursor:"pointer"}}>Log in</button>
          <button onClick={onLogin} style={{padding:"9px 22px",borderRadius:9,background:accent,border:"none",color:"#1d1b18",fontSize:14,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 10px rgba(239,192,30,0.3)"}}>Get Started</button>
        </div>
      </div>

      {/* Hero — full-screen over faded blueprint */}
      <div style={{position:"relative",zIndex:1,minHeight:"calc(100vh - 73px)",display:"flex",flexDirection:"column",justifyContent:"center",padding:"40px 6vw 60px"}}>
        <div style={{maxWidth:720}}>
          <div style={{display:"inline-block",padding:"6px 16px",borderRadius:20,background:"rgba(255,255,255,0.85)",border:"1px solid #ece9e4",marginBottom:24,fontSize:12,color:accent,fontWeight:600,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>3D Wardrobe Design Studio for Manufacturers</div>
          <h1 style={{fontSize:"clamp(36px,5.5vw,64px)",fontWeight:800,lineHeight:1.08,letterSpacing:"-0.03em",marginBottom:22}}>
            Design, quote and build<br/>custom wardrobes <span style={{color:accent}}>in minutes</span>
          </h1>
          <p style={{fontSize:"clamp(15px,1.8vw,19px)",color:"#4a4640",lineHeight:1.7,maxWidth:560,marginBottom:34}}>
            Sit with your customer, design their wardrobe in live 3D, show the price instantly, and send a cut list to your workshop — all from one screen, branded as your company.
          </p>
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            <button onClick={onLogin} style={{padding:"15px 38px",borderRadius:11,background:accent,border:"none",color:"#1d1b18",fontSize:16,fontWeight:600,cursor:"pointer",boxShadow:"0 6px 22px rgba(239,192,30,0.35)"}}>Get Started</button>
            <button onClick={onLogin} style={{padding:"15px 34px",borderRadius:11,background:"#fff",border:"1px solid #e4e1da",color:"#1d1b18",fontSize:16,fontWeight:600,cursor:"pointer"}}>Log in</button>
          </div>
          <div style={{display:"flex",gap:30,marginTop:40,flexWrap:"wrap"}}>
            {[["Live","3D preview"],["Instant","LKR quotes"],["1-tap","WhatsApp + PDF"],["Auto","cut lists"]].map(([a,b])=>(
              <div key={b}><div style={{fontSize:20,fontWeight:700,color:accent}}>{a}</div><div style={{fontSize:12,color:"#9c968e"}}>{b}</div></div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{position:"relative",zIndex:1,padding:"20px 6vw 70px",maxWidth:1180,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:18}}>
          {features.map((f,i)=>(
            <div key={i} style={{background:"#fff",border:"1px solid #ece9e4",borderRadius:16,padding:26,boxShadow:"0 2px 12px rgba(0,0,0,0.03)"}}>
              <div style={{width:42,height:42,borderRadius:10,background:"rgba(239,192,30,0.14)",display:"flex",alignItems:"center",justifyContent:"center",color:accent,fontWeight:700,fontSize:18,marginBottom:14}}>{i+1}</div>
              <div style={{fontSize:17,fontWeight:600,marginBottom:8}}>{f.t}</div>
              <div style={{fontSize:13.5,color:"#78726a",lineHeight:1.6}}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Animated product-flow demo (pure SVG/CSS, 30s loop) */}
      <div style={{position:"relative",zIndex:1,padding:"56px 6vw 10px"}}>
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:6}}><span style={{fontSize:12,letterSpacing:"0.18em",textTransform:"uppercase",color:"#9a7a0a",fontWeight:700}}>See it work</span></div>
          <h2 style={{fontSize:"clamp(24px,2.8vw,34px)",fontWeight:800,textAlign:"center",marginBottom:26,letterSpacing:"-0.02em"}}>Design to quote in one flow</h2>
          <div style={{position:"relative",width:"100%",aspectRatio:"16 / 9",background:"linear-gradient(180deg,#fffdf7,#f4f1ea)",border:"1px solid #ece9e4",borderRadius:18,overflow:"hidden",boxShadow:"0 20px 50px -28px rgba(0,0,0,0.25)"}}>
            <style>{`
              @keyframes pmwGrow{0%,100%{transform:scaleX(.72)}12%{transform:scaleX(.72)}18%,100%{transform:scaleX(1)}}
              @keyframes pmwFade{to{opacity:1}}
              .pmw-stage{opacity:0;animation:pmwStage 30s linear infinite}
              @keyframes pmwStage{0%{opacity:0}2%{opacity:1}15%{opacity:1}17%{opacity:0}100%{opacity:0}}
              .pmw-s1{animation-delay:0s}.pmw-s2{animation-delay:5s}.pmw-s3{animation-delay:10s}.pmw-s4{animation-delay:15s}.pmw-s5{animation-delay:20s}.pmw-s6{animation-delay:25s}
              .pmw-draw{stroke-dasharray:200;stroke-dashoffset:200;animation:pmwDraw 30s linear infinite}
              @keyframes pmwDraw{0%{stroke-dashoffset:200}8%{stroke-dashoffset:0}}
              .pmw-pop{transform:scale(0);transform-origin:center;animation:pmwPop 30s linear infinite}
              @keyframes pmwPop{0%{transform:scale(0)}4%{transform:scale(1.15)}7%{transform:scale(1)}}
              .pmw-bar{animation:pmwBar 30s linear infinite}
              @keyframes pmwBar{0%{width:0}100%{width:100%}}
              .pmw-grow{transform-origin:left center;animation:pmwWide 30s linear infinite}
              @keyframes pmwWide{0%{transform:scaleX(.7)}4%{transform:scaleX(.7)}9%{transform:scaleX(1.02)}11%,100%{transform:scaleX(1)}}
              .pmw-swatch{opacity:.45;animation:pmwSw 30s linear infinite}
              @keyframes pmwSw{0%,17%{opacity:.45}19%,30%{opacity:.45}}
              .pmw-fill{animation:pmwFill 30s linear infinite}
              @keyframes pmwFill{0%,17%{fill:#efe7d6}20%{fill:#d9b24e}30%{fill:#d9b24e}32%,100%{fill:#efe7d6}}
              .pmw-pdf{transform:translateY(20px);opacity:0;animation:pmwPdf 30s linear infinite}
              @keyframes pmwPdf{0%,84%{transform:translateY(20px);opacity:0}88%{opacity:1}90%,98%{transform:translateY(0);opacity:1}100%{opacity:0}}
            `}</style>
            <svg viewBox="0 0 640 360" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
              {/* ground */}
              <line x1="60" y1="300" x2="580" y2="300" stroke="#e0dbd2" strokeWidth="1.5"/>

              {/* STAGE 1 — size adjust */}
              <g className="pmw-stage pmw-s1">
                <g className="pmw-grow">
                  <rect x="180" y="120" width="180" height="180" rx="3" fill="#fdfcfa" stroke="#cfc7b8" strokeWidth="2.5"/>
                  <line x1="270" y1="120" x2="270" y2="300" stroke="#e3ded4" strokeWidth="2"/>
                </g>
                <line x1="180" y1="104" x2="360" y2="104" stroke="#EFC01E" strokeWidth="1.5"/>
                <path d="M180 100l-6 4 6 4z M360 100l6 4-6 4z" fill="#EFC01E"/>
                <text x="270" y="96" textAnchor="middle" fill="#9a7a0a" fontSize="13" fontFamily="Poppins" fontWeight="600">Adjust size</text>
              </g>

              {/* STAGE 2 — colour */}
              <g className="pmw-stage pmw-s2">
                <rect x="200" y="110" width="170" height="190" rx="3" className="pmw-fill" stroke="#cfc7b8" strokeWidth="2.5"/>
                <line x1="285" y1="110" x2="285" y2="300" stroke="#ffffff66" strokeWidth="2"/>
                {[["#efe7d6",250],["#d9b24e",290],["#9a7a4a",330],["#3a352f",370]].map(([c,x],i)=>(<circle key={i} cx={x} cy="330" r="13" fill={c} stroke={i===1?"#1d1b18":"#d8d4cc"} strokeWidth={i===1?2.5:1}/>))}
                <text x="285" y="96" textAnchor="middle" fill="#9a7a0a" fontSize="13" fontFamily="Poppins" fontWeight="600">Pick colour</text>
              </g>

              {/* STAGE 3 — shelves & drawers */}
              <g className="pmw-stage pmw-s3">
                <rect x="200" y="110" width="170" height="190" rx="3" fill="#fdfcfa" stroke="#cfc7b8" strokeWidth="2.5"/>
                <line x1="285" y1="110" x2="285" y2="300" stroke="#e3ded4" strokeWidth="2"/>
                <line className="pmw-draw" x1="210" y1="160" x2="278" y2="160" stroke="#cdc4b6" strokeWidth="3"/>
                <line className="pmw-draw" x1="210" y1="200" x2="278" y2="200" stroke="#cdc4b6" strokeWidth="3"/>
                <line className="pmw-draw" x1="210" y1="240" x2="278" y2="240" stroke="#cdc4b6" strokeWidth="3"/>
                <rect className="pmw-pop" x="294" y="250" width="68" height="20" rx="2" fill="#f4f0e8" stroke="#cfc7b8" strokeWidth="1.5"/>
                <rect className="pmw-pop" x="294" y="274" width="68" height="20" rx="2" fill="#f4f0e8" stroke="#cfc7b8" strokeWidth="1.5"/>
                <circle className="pmw-pop" cx="328" cy="260" r="2.4" fill="#EFC01E"/>
                <text x="285" y="96" textAnchor="middle" fill="#9a7a0a" fontSize="13" fontFamily="Poppins" fontWeight="600">Shelves &amp; drawers</text>
              </g>

              {/* STAGE 4 — hanging rail */}
              <g className="pmw-stage pmw-s4">
                <rect x="200" y="110" width="170" height="190" rx="3" fill="#fdfcfa" stroke="#cfc7b8" strokeWidth="2.5"/>
                <line className="pmw-draw" x1="212" y1="150" x2="358" y2="150" stroke="#b8af9e" strokeWidth="3"/>
                {[235,265,295,325].map((x,i)=>(<path key={i} className="pmw-pop" d={`M${x} 150 q-6 10 0 16 M${x} 150 q6 10 0 16`} fill="none" stroke="#d9d2c4" strokeWidth="3"/>))}
                <text x="285" y="96" textAnchor="middle" fill="#9a7a0a" fontSize="13" fontFamily="Poppins" fontWeight="600">Hanging space</text>
              </g>

              {/* STAGE 5 — add-ons */}
              <g className="pmw-stage pmw-s5">
                <rect x="200" y="110" width="170" height="190" rx="3" fill="#fdfcfa" stroke="#cfc7b8" strokeWidth="2.5"/>
                <line x1="285" y1="110" x2="285" y2="300" stroke="#e3ded4" strokeWidth="2"/>
                {[["Mirror",250],["LED light",286],["Lock",322]].map(([t,y],i)=>(<g key={i} className="pmw-pop"><rect x="392" y={y-14} width="150" height="26" rx="13" fill="#fff" stroke="#EFC01E" strokeWidth="1.5"/><circle cx="408" cy={y-1} r="5" fill="#EFC01E"/><text x="424" y={y+3} fill="#6b655d" fontSize="12" fontFamily="Poppins" fontWeight="500">{t}</text></g>))}
                <text x="285" y="96" textAnchor="middle" fill="#9a7a0a" fontSize="13" fontFamily="Poppins" fontWeight="600">Add-ons</text>
              </g>

              {/* STAGE 6 — PDF */}
              <g className="pmw-stage pmw-s6">
                <rect x="180" y="120" width="150" height="170" rx="3" fill="#fdfcfa" stroke="#d4cec4" strokeWidth="2" opacity="0.4"/>
                <g className="pmw-pdf">
                  <rect x="360" y="120" width="130" height="168" rx="6" fill="#fff" stroke="#d8d4cc" strokeWidth="2"/>
                  <rect x="360" y="120" width="130" height="34" rx="6" fill="#EFC01E"/>
                  <text x="425" y="142" textAnchor="middle" fill="#1d1b18" fontSize="13" fontFamily="Poppins" fontWeight="700">QUOTE</text>
                  {[170,186,202,218,234].map((y,i)=>(<line key={i} x1="376" y1={y} x2={i%2?"452":"474"} y2={y} stroke="#e0dbd2" strokeWidth="3"/>))}
                  <text x="425" y="270" textAnchor="middle" fill="#9a7a0a" fontSize="15" fontFamily="Poppins" fontWeight="700">Rs. 269,500</text>
                </g>
                <text x="320" y="96" textAnchor="middle" fill="#9a7a0a" fontSize="13" fontFamily="Poppins" fontWeight="600">Instant PDF quote</text>
              </g>
            </svg>
            {/* progress bar */}
            <div style={{position:"absolute",left:0,bottom:0,height:4,background:"#EFC01E"}} className="pmw-bar"/>
          </div>
          <p style={{fontSize:13,color:"#9c968e",textAlign:"center",marginTop:14}}>Size → colour → interior → add-ons → quote. The whole flow, in front of your customer.</p>
        </div>
      </div>

      {/* How it works */}
      <div style={{position:"relative",zIndex:1,background:"#fff",borderTop:"1px solid #ece9e4",borderBottom:"1px solid #ece9e4",padding:"64px 6vw"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <h2 style={{fontSize:"clamp(26px,3vw,36px)",fontWeight:700,textAlign:"center",marginBottom:8,letterSpacing:"-0.02em"}}>From measurement to workshop</h2>
          <p style={{fontSize:15,color:"#9c968e",textAlign:"center",marginBottom:44}}>Four steps. One screen. In front of your customer.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:20}}>
            {steps.map(s=>(
              <div key={s.n} style={{textAlign:"center"}}>
                <div style={{width:54,height:54,borderRadius:"50%",background:accent,color:"#1d1b18",fontSize:22,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>{s.n}</div>
                <div style={{fontSize:17,fontWeight:600,marginBottom:6}}>{s.t}</div>
                <div style={{fontSize:13,color:"#78726a",lineHeight:1.6}}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="pricing" style={{position:"relative",zIndex:1,padding:"66px 6vw",background:"#fbfaf8",borderTop:"1px solid #ece9e4"}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:8}}><span style={{fontSize:12,letterSpacing:"0.18em",textTransform:"uppercase",color:"#9a7a0a",fontWeight:700}}>Plans &amp; Pricing</span></div>
          <h2 style={{fontSize:"clamp(26px,3vw,38px)",fontWeight:800,textAlign:"center",marginBottom:6,letterSpacing:"-0.02em"}}>Starter sells. Pro builds.</h2>
          <p style={{fontSize:15,color:"#9c968e",textAlign:"center",marginBottom:42}}>Unlimited designs &amp; quotes on both. No usage caps.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20,maxWidth:760,margin:"0 auto"}}>
            {/* Starter */}
            <div style={{background:"#fff",border:"1px solid #ece9e4",borderRadius:18,padding:"30px 28px",display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:12,letterSpacing:"0.14em",textTransform:"uppercase",color:"#9a7a0a",fontWeight:700}}>Starter</div>
              <div style={{fontSize:13,color:"#9c968e",margin:"6px 0 16px",minHeight:36}}>For small workshops winning customers in the room.</div>
              <div style={{fontSize:38,fontWeight:800,letterSpacing:"-0.02em"}}>Rs. 14,900<span style={{fontSize:15,fontWeight:500,color:"#9c968e"}}> /mo</span></div>
              <div style={{fontSize:12,color:"#78726a",marginTop:6}}>One-time onboarding <b style={{color:"#1d1b18"}}>Rs. 15,000</b></div>
              <div style={{height:1,background:"#ece9e4",margin:"18px 0"}}/>
              {["Real-time 3D configurator","Unlimited designs & quotes","All exterior & interior colours","5-page PDF quotation","White-label branding","WhatsApp quotes, advance & discount"].map((f,i)=>(<div key={i} style={{fontSize:13.5,color:"#3a352f",padding:"5px 0 5px 22px",position:"relative"}}><span style={{position:"absolute",left:0,color:"#2e7d32",fontWeight:700}}>✓</span>{f}</div>))}
              <button onClick={onLogin} style={{marginTop:20,padding:"13px 0",borderRadius:11,background:"#fff",border:"1.5px solid "+accent,color:"#1d1b18",fontSize:15,fontWeight:700,cursor:"pointer"}}>Start with Starter</button>
            </div>
            {/* Pro */}
            <div style={{background:"#fff",border:"2px solid "+accent,borderRadius:18,padding:"30px 28px",display:"flex",flexDirection:"column",position:"relative",boxShadow:"0 18px 50px -22px rgba(239,192,30,0.6)"}}>
              <div style={{position:"absolute",top:-12,right:24,background:accent,color:"#1d1b18",fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",padding:"5px 12px",borderRadius:20}}>Most popular</div>
              <div style={{fontSize:12,letterSpacing:"0.14em",textTransform:"uppercase",color:"#9a7a0a",fontWeight:700}}>Pro</div>
              <div style={{fontSize:13,color:"#9c968e",margin:"6px 0 16px",minHeight:36}}>For manufacturers who want the tool to run the workshop too.</div>
              <div style={{fontSize:38,fontWeight:800,letterSpacing:"-0.02em"}}>Rs. 24,900<span style={{fontSize:15,fontWeight:500,color:"#9c968e"}}> /mo</span></div>
              <div style={{fontSize:12,color:"#78726a",marginTop:6}}>One-time onboarding <b style={{color:"#1d1b18"}}>Rs. 25,000</b></div>
              <div style={{height:1,background:"#ece9e4",margin:"18px 0"}}/>
              <div style={{fontSize:13.5,color:"#3a352f",padding:"5px 0 5px 22px",position:"relative",fontWeight:600}}><span style={{position:"absolute",left:0,color:"#2e7d32",fontWeight:700}}>✓</span>Everything in Starter, plus:</div>
              {["Workshop Cut List (panels, hardware, banding)","L-shaped corner wardrobes","AR \u201cView in My Room\u201d","Analytics dashboard","Priority support"].map((f,i)=>(<div key={i} style={{fontSize:13.5,color:"#9a7a0a",fontWeight:600,padding:"5px 0 5px 22px",position:"relative"}}><span style={{position:"absolute",left:0}}>★</span>{f}</div>))}
              <button onClick={onLogin} style={{marginTop:20,padding:"13px 0",borderRadius:11,background:accent,border:"none",color:"#1d1b18",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 22px rgba(239,192,30,0.4)"}}>Go Pro</button>
            </div>
          </div>
          {/* Full feature comparison */}
          <div style={{marginTop:36,maxWidth:760,marginLeft:"auto",marginRight:"auto"}}>
            <h3 style={{fontSize:18,fontWeight:700,textAlign:"center",marginBottom:4}}>Full feature list</h3>
            <p style={{fontSize:13,color:"#9c968e",textAlign:"center",marginBottom:18}}>What's in each plan</p>
            <div style={{background:"#fff",border:"1px solid #ece9e4",borderRadius:14,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:"#faf8f4"}}>
                  <th style={{textAlign:"left",padding:"11px 16px",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:"#9c968e",fontWeight:600}}>Feature</th>
                  <th style={{textAlign:"center",padding:"11px 8px",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:"#9c968e",fontWeight:600,width:90}}>Starter</th>
                  <th style={{textAlign:"center",padding:"11px 8px",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:"#9c968e",fontWeight:600,width:90}}>Pro</th>
                </tr></thead>
                <tbody>
                  {[
                    ["grp","Design & visualisation"],
                    ["Real-time 3D configurator","y","y"],
                    ["Width / height / depth + sections","y","y"],
                    ["Exterior & interior colours (all)","y","y"],
                    ["Door styles — open, hinged, sliding","y","y"],
                    ["Top cupboard + interior modules","y","y"],
                    ["2D & overall-dimensions drawings","y","y"],
                    ["L-shaped corner wardrobes","-","pro"],
                    ["AR \u201cView in My Room\u201d","-","pro"],
                    ["grp","Selling & quoting"],
                    ["Unlimited designs & quotes","y","y"],
                    ["5-page PDF quotation","y","y"],
                    ["White-label branding","y","y"],
                    ["WhatsApp quote sending","y","y"],
                    ["Per-door pricing, advance & discount","y","y"],
                    ["Lead capture & saved designs","y","y"],
                    ["grp","Manufacturing"],
                    ["Workshop Cut List (panels, hardware)","-","pro"],
                    ["L-shape cut list + corner parts","-","pro"],
                    ["grp","Business"],
                    ["Analytics dashboard","-","pro"],
                    ["Support","Standard","Priority"],
                    ["Onboarding (one-time)","Rs. 15,000","Rs. 25,000"],
                    ["Monthly","Rs. 14,900","Rs. 24,900"],
                  ].map((row,i)=>{
                    if(row[0]==="grp")return(<tr key={i}><td colSpan={3} style={{background:"#f3efe8",fontSize:10.5,letterSpacing:"0.12em",textTransform:"uppercase",color:"#9a7a0a",fontWeight:700,padding:"8px 16px"}}>{row[1]}</td></tr>);
                    const cell=v=>v==="y"?<span style={{color:"#2e7d32",fontWeight:700}}>✓</span>:v==="-"?<span style={{color:"#cfc8bd"}}>—</span>:v==="pro"?<span style={{fontSize:10,fontWeight:700,color:"#9a7a0a",background:"#fbf3e3",border:"1px solid #ecd9b0",padding:"2px 8px",borderRadius:20}}>Pro</span>:<span style={{fontSize:12,color:"#3a352f"}}>{v}</span>;
                    return(<tr key={i} style={{borderTop:"1px solid #f0ede7"}}><td style={{padding:"10px 16px",fontSize:13,color:"#3a352f"}}>{row[0]}</td><td style={{textAlign:"center",padding:"10px 8px"}}>{cell(row[1])}</td><td style={{textAlign:"center",padding:"10px 8px"}}>{cell(row[2])}</td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Social add-ons */}
          <div style={{marginTop:30,textAlign:"center"}}>
            <div style={{fontSize:13,color:"#78726a",marginBottom:14}}><b>Optional add-on — Social Media management</b> · we run your FB &amp; Instagram using your 3D renders · Premium +$100 min ad budget/mo</div>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              {[["Starter","Rs. 20,000"],["Growth","Rs. 55,000"],["Premium","Rs. 75,000"]].map(([n,pr],i)=>(<div key={i} style={{background:"#fff",border:"1px solid #ece9e4",borderRadius:12,padding:"12px 22px",minWidth:140}}><div style={{fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:"#9a7a0a",fontWeight:700}}>{n}</div><div style={{fontSize:18,fontWeight:800,marginTop:2}}>{pr}<span style={{fontSize:11,fontWeight:500,color:"#9c968e"}}>/mo</span></div></div>))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{position:"relative",zIndex:1,padding:"72px 6vw",textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(26px,3.2vw,40px)",fontWeight:800,letterSpacing:"-0.02em",marginBottom:16}}>Ready to close more orders?</h2>
        <p style={{fontSize:16,color:"#6b655d",marginBottom:30,maxWidth:520,margin:"0 auto 30px",lineHeight:1.6}}>Start designing wardrobes with your customers today — branded as your company.</p>
        <button onClick={onLogin} style={{padding:"16px 44px",borderRadius:12,background:accent,border:"none",color:"#1d1b18",fontSize:17,fontWeight:600,cursor:"pointer",boxShadow:"0 8px 28px rgba(239,192,30,0.35)"}}>Get Started Free</button>
      </div>

      {/* Footer */}
      <div style={{position:"relative",zIndex:1,padding:"28px 6vw",borderTop:"1px solid #ece9e4",textAlign:"center",background:"#fff"}}>
        <div style={{fontSize:15,fontWeight:700,color:accent,marginBottom:4}}>{settings?.business?.name||BRAND}</div>
        <div style={{fontSize:12,color:"#9c968e"}}>Custom wardrobe design &amp; quotation studio · Sri Lanka</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────
export default function App(){
  const canvasRef=useRef(null),sceneRef=useRef(null),rendererRef=useRef(null),cameraRef=useRef(null),frameRef=useRef(null);
  const mouseRef=useRef({isDown:false,button:-1,x:0,y:0});
  const orbitRef=useRef({theta:0.6,phi:0.8,radius:3.8,target:new THREE.Vector3(0,0,0)});

  const[user,setUser]=useState(null);
  const[settings,setSettings]=useState({pricePerSqft:DEFAULT_PRICE_PER_SQFT,materials:DEFAULT_MATERIALS,accessories:DEFAULT_ACCESSORIES});
  const[designs,setDesigns]=useState([]);
  const[page,setPage]=useState("landing");
  const[step,setStep]=useState(0);
  const[viewMode,setViewMode]=useState("3d");
  const[doorsOpen,setDoorsOpen]=useState(false);
  const[authView,setAuthView]=useState("home");
  const[fullDrawing,setFullDrawing]=useState(null); // null | "2d" | "3d"
  const[presetOpen,setPresetOpen]=useState(false);
  const[profileOpen,setProfileOpen]=useState(false);
  const[account,setAccount]=useState({status:"demo",plan:null});
  const isSuper=!!user&&SUPER_ADMINS.includes((user.email||"").toLowerCase());
  const acctStatus=isSuper?"active":(account.status||"demo");
  const isPro=isSuper||(acctStatus==="active"&&isProPlan(account.plan,settings.platformPlans));
  // Pro-only features: Cut List, L-shaped wardrobes, AR. Starter sells; Pro builds.
  const proGate=(feature)=>{if(isPro)return true;alert(`${feature} is a Pro feature.\n\nUpgrade to the Pro plan to unlock L-shaped wardrobes, the workshop Cut List and AR "View in My Room".\n\nContact Plan My Wardrobe to upgrade.`);return false;};
  // Demo = 1 trial quote (watermarked). Suspended = exports locked.
  const canExport=()=>{
    if(acctStatus==="active")return true;
    if(acctStatus==="suspended"){alert("Your subscription is paused. Contact Plan My Wardrobe to reactivate your account.");return false;}
    if(settings.demoUsed){alert("Your free demo quote has been used.\n\nContact Plan My Wardrobe on WhatsApp to activate your account and unlock unlimited quotes, clean PDFs and cut lists.");return false;}
    return true;
  };
  const[modal,setModal]=useState(null); // "admin" | "designs" | "pdf" | "whatsapp"
  const[customer,setCustomer]=useState({name:"",phone:"",city:""});
  const[editingDesignId,setEditingDesignId]=useState(null);
  const[editLeg,setEditLeg]=useState("A");
  const[config,setConfig]=useState({
    width:ftM(5.5),height:ftM(7),depth:560,materialId:"warm-white",interiorMaterialId:"warm-white",
    sections:3,doorStyle:"hinged",slidingPanels:2,accessories:[],notes:"",
    topCupboard:true,topCupboardHeight:457,
    shape:"straight",
    legB:{width:ftM(4),sections:2,doorStyle:"hinged",slidingPanels:2,topCupboard:true,topCupboardHeight:457,modules:[{id:"lb1",type:"rail",section:0,yNorm:0.92},{id:"lb2",type:"shelf",section:1,yNorm:0.42},{id:"lb3",type:"shelf",section:1,yNorm:0.22}]},
    modules:[{id:"m1",type:"rail",section:0,yNorm:0.92},{id:"m2",type:"rail",section:1,yNorm:0.92},{id:"m3",type:"shelf",section:1,yNorm:0.42},{id:"m4",type:"shelf",section:1,yNorm:0.22},{id:"m5",type:"drawer",section:2,yNorm:0.15},{id:"m6",type:"drawer",section:2,yNorm:0.28},{id:"m7",type:"drawer",section:2,yNorm:0.41}],
  });

  const DEFAULTS={pricePerSqft:DEFAULT_PRICE_PER_SQFT,materials:DEFAULT_MATERIALS,accessories:DEFAULT_ACCESSORIES,business:DEFAULT_BUSINESS,payment:DEFAULT_PAYMENT,doorPricing:DEFAULT_DOOR_PRICING,lCornerCharge:0};
  const { data: gsession } = useSession();

  // Load user + their data (real Google session OR demo session)
  const loadUserData=useCallback(async(u)=>{
    const s=await dbLoadSettings(u.email,DEFAULTS);setSettings(s);
    const d=await dbLoadDesigns(u.email);setDesigns(d);
    const a=await dbLoadAccount(u.email);setAccount(a);
  },[]);

  useEffect(()=>{
    if(USE_GOOGLE){
      if(gsession?.user){const u={email:gsession.user.email,name:gsession.user.name||gsession.user.email.split("@")[0]};setUser(u);loadUserData(u);}
      else setUser(null);
    }else{
      const u=store.get("currentUser");if(u){setUser(u);loadUserData(u);}
    }
  },[gsession,loadUserData]);

  const secRange=useMemo(()=>getSectionRange(config.width),[config.width]);
  const slidingRange=useMemo(()=>getSlidingPanelRange(config.width),[config.width]);
  const sectionW=useMemo(()=>Math.round(config.width/config.sections),[config.width,config.sections]);
  const price=calcPriceLKR(config,settings);
  const payCalc=useMemo(()=>{const p={advancePct:50,discountPct:0,...(settings.payment||{})};const disc=Math.round(price.total*((p.discountPct||0)/100));const net=price.total-disc;const adv=Math.round(net*((p.advancePct||0)/100));return{...p,disc,net,adv,bal:net-adv};},[price.total,settings.payment]);
  const hasTop=topInfo(config).has;
  const editInt=step===3;
  const hasDoors=config.doorStyle!=="none";

  const upd=useCallback(p=>{setConfig(prev=>{const n={...prev,...p};if(p.width!==undefined){const sr=getSectionRange(p.width);n.sections=clamp(n.sections,sr.min,sr.max);const slr=getSlidingPanelRange(p.width);n.slidingPanels=clamp(n.slidingPanels,slr.min,slr.max);n.modules=(n.modules||prev.modules).filter(m=>m.section<n.sections);if(n.width<SLIDING_MIN_WIDTH&&n.doorStyle==="sliding")n.doorStyle="hinged";}if(p.sections!==undefined)n.modules=(n.modules||prev.modules).filter(m=>m.section<p.sections);return n;});},[]);
  const loadPreset=p=>{const mods=p.modules.map((m,i)=>({...m,id:"p"+Date.now()+i}));setConfig(prev=>({...prev,width:p.width,height:p.height,depth:p.depth,sections:p.sections,doorStyle:p.doorStyle,slidingPanels:p.slidingPanels,modules:mods}));setEditingDesignId(null);setPresetOpen(false);};
  const toggleAcc=id=>{const cur=config.accessories||[];upd({accessories:cur.includes(id)?cur.filter(a=>a!==id):[...cur,id]});};
  const isL=config.shape==="L";
  const actLeg=(editLeg==="B"&&isL)?"B":"A";
  const actModules=actLeg==="B"?(config.legB.modules||[]):config.modules;
  const actSections=actLeg==="B"?config.legB.sections:config.sections;
  const actLegCfg=actLeg==="B"?legBFull(config):config;
  const setActModules=(mods)=>{if(actLeg==="B")setConfig(p=>({...p,legB:{...p.legB,modules:mods}}));else upd({modules:mods});};
  const addMod=(type,sec)=>{const yn=getSmartYNorm(type,sec,actModules,config.height,actLegCfg);if(yn<0)return;setActModules([...actModules,{id:"m"+Date.now(),type,section:sec,yNorm:yn}]);};
  const canAdd=(type,sec)=>getSmartYNorm(type,sec,actModules,config.height,actLegCfg)>=0;

  const handleLogin=(u)=>{setUser(u);store.set("currentUser",u);loadUserData(u);setPage("landing");};
  const handleLogout=()=>{if(USE_GOOGLE){signOut();}else{store.set("currentUser",null);}setUser(null);setProfileOpen(false);setPage("landing");};
  const handleSaveSettings=async(s)=>{setSettings(s);await dbSaveSettings(user.email,s,user.name);setModal(null);};
  const handleCapture=async(cust)=>{setCustomer(cust);if(user)await dbSaveLead(user.email,{name:cust.name,phone:cust.phone,city:cust.city,total:price.total,config:JSON.parse(JSON.stringify(config))});const demo=acctStatus==="demo";if(modal==="pdf")generatePDF(config,price,canvasRef,cust,settings,demo);else if(modal==="whatsapp"){window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsAppMsg(config,price,cust,settings))}`,'_blank');}if(demo&&!settings.demoUsed){const ns={...settings,demoUsed:true};setSettings(ns);await dbSaveSettings(user.email,ns,user.name);}setModal(null);};

  const saveDesign=async()=>{
    const name=prompt("Name this design:",editingDesignId?(designs.find(d=>d.id===editingDesignId)?.name||"My Wardrobe"):"My Wardrobe");
    if(!name)return;
    const design={id:editingDesignId||("d"+Date.now()),name,config:JSON.parse(JSON.stringify(config)),total:price.total,savedAt:Date.now()};
    const savedId=await dbSaveDesign(user.email,design);
    if(savedId&&savedId!==design.id)design.id=savedId;
    setEditingDesignId(design.id);
    const fresh=await dbLoadDesigns(user.email);setDesigns(fresh);
    alert("Design saved to your profile.");
  };
  const loadDesign=d=>{setConfig(JSON.parse(JSON.stringify(d.config)));setEditingDesignId(d.id);setModal(null);setPage("configurator");};
  const deleteDesign=async id=>{await dbDeleteDesign(user.email,id);const fresh=await dbLoadDesigns(user.email);setDesigns(fresh);};

  // Three.js
  useEffect(()=>{if(page!=="configurator")return;const cv=canvasRef.current;if(!cv)return;const sc=new THREE.Scene();sc.background=new THREE.Color("#f3f2f0");sc.fog=new THREE.Fog("#f3f2f0",10,22);sceneRef.current=sc;const cam=new THREE.PerspectiveCamera(40,cv.clientWidth/cv.clientHeight,0.1,50);cameraRef.current=cam;const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});r.setSize(cv.clientWidth,cv.clientHeight);r.setPixelRatio(Math.min(devicePixelRatio,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.15;rendererRef.current=r;sc.add(new THREE.AmbientLight("#f5e6d3",0.6));const kl=new THREE.DirectionalLight("#fff8f0",1.3);kl.position.set(3,5,4);kl.castShadow=true;kl.shadow.mapSize.set(1024,1024);kl.shadow.camera.near=0.5;kl.shadow.camera.far=15;kl.shadow.camera.left=-4;kl.shadow.camera.right=4;kl.shadow.camera.top=4;kl.shadow.camera.bottom=-4;sc.add(kl);sc.add(new THREE.DirectionalLight("#d0e0f0",0.45).translateX(-3).translateY(2).translateZ(-2));sc.add(new THREE.DirectionalLight("#fff5ee",0.5).translateZ(5).translateY(1));sc.add(new THREE.PointLight("#ffeedd",0.6,10).translateY(3).translateZ(-3));const fl=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:"#f0eee9",roughness:0.9}));fl.rotation.x=-Math.PI/2;fl.position.y=-1.25;fl.receiveShadow=true;sc.add(fl);sc.add(new THREE.GridHelper(10,20,"#e4e1da","#ebe8e2").translateY(-1.24));function anim(){frameRef.current=requestAnimationFrame(anim);const o=orbitRef.current;cam.position.set(o.target.x+o.radius*Math.sin(o.phi)*Math.sin(o.theta),o.target.y+o.radius*Math.cos(o.phi),o.target.z+o.radius*Math.sin(o.phi)*Math.cos(o.theta));cam.lookAt(o.target);r.render(sc,cam);}anim();const onR=()=>{const w=cv.parentElement.clientWidth,h=cv.parentElement.clientHeight;cv.width=w;cv.height=h;cam.aspect=w/h;cam.updateProjectionMatrix();r.setSize(w,h);};window.addEventListener("resize",onR);setTimeout(onR,50);return()=>{cancelAnimationFrame(frameRef.current);window.removeEventListener("resize",onR);r.dispose();};},[page]);
  useEffect(()=>{if(page!=="configurator")return;const cv=canvasRef.current;if(!cv)return;const od=e=>{const ev=e.touches?e.touches[0]:e;mouseRef.current={isDown:true,button:e.button||0,x:ev.clientX,y:ev.clientY};};const ou=()=>{mouseRef.current.isDown=false;};const om=e=>{if(!mouseRef.current.isDown)return;const ev=e.touches?e.touches[0]:e;const dx=ev.clientX-mouseRef.current.x,dy=ev.clientY-mouseRef.current.y;mouseRef.current.x=ev.clientX;mouseRef.current.y=ev.clientY;const o=orbitRef.current;if(mouseRef.current.button===0){o.theta-=dx*0.008;o.phi=Math.max(0.2,Math.min(Math.PI-0.2,o.phi-dy*0.008));}else if(mouseRef.current.button===2){o.target.x-=dx*0.003;o.target.y+=dy*0.003;}};const ow=e=>{e.preventDefault();orbitRef.current.radius=Math.max(1.5,Math.min(8,orbitRef.current.radius+e.deltaY*0.003));};const oc=e=>e.preventDefault();cv.addEventListener("mousedown",od);cv.addEventListener("touchstart",od,{passive:true});window.addEventListener("mouseup",ou);window.addEventListener("touchend",ou);window.addEventListener("mousemove",om);window.addEventListener("touchmove",om,{passive:true});cv.addEventListener("wheel",ow,{passive:false});cv.addEventListener("contextmenu",oc);return()=>{cv.removeEventListener("mousedown",od);cv.removeEventListener("touchstart",od);window.removeEventListener("mouseup",ou);window.removeEventListener("touchend",ou);window.removeEventListener("mousemove",om);window.removeEventListener("touchmove",om);cv.removeEventListener("wheel",ow);cv.removeEventListener("contextmenu",oc);};},[page]);
  useEffect(()=>{if(sceneRef.current&&page==="configurator")buildWardrobe(sceneRef.current,config,settings.materials,editInt||doorsOpen);},[config,editInt,doorsOpen,page,settings.materials]);

  const STEPS=[{l:"Dimensions"},{l:"Material"},{l:"Doors"},{l:"Interior"},{l:"Add-ons"},{l:"Summary"}];
  const sl={fontSize:11,color:"#847e76",letterSpacing:"0.08em",textTransform:"uppercase"};

  // Not logged in → login
  if(!user){
    if(authView==="login"&&!USE_GOOGLE)return <LoginScreen onLogin={handleLogin} onBack={()=>setAuthView("home")}/>;
    return <PublicHome settings={settings} onLogin={()=>{ if(USE_GOOGLE) signIn("google"); else setAuthView("login"); }}/>;
  }

  // Landing
  if(page==="landing")return(
    <div style={{minHeight:"100vh",background:"#f7f6f3"}}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 40px",borderBottom:"1px solid #f0eee9",fontFamily:"'Poppins',sans-serif"}}>
        <div style={{fontSize:20,fontWeight:700,color:settings.business?.accent||"#EFC01E"}}>{settings.business?.name||BRAND}</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setModal("designs")} style={{padding:"8px 16px",borderRadius:8,background:"transparent",border:"1px solid #d8d4cc",color:"#847e76",cursor:"pointer",fontSize:12}}>My Designs ({designs.length})</button>
          <button onClick={()=>setModal("admin")} style={{padding:"8px 16px",borderRadius:8,background:"transparent",border:"1px solid #d8d4cc",color:"#847e76",cursor:"pointer",fontSize:12}}>Settings</button>
          <div style={{position:"relative"}}>
            {acctStatus!=="active"&&(<span style={{padding:"4px 10px",borderRadius:10,fontSize:9.5,fontWeight:700,letterSpacing:"0.05em",color:acctStatus==="demo"?"#8a6c08":"#c62828",background:acctStatus==="demo"?"#fff3dd":"#fbeaea",border:"1px solid "+(acctStatus==="demo"?"#ecd9b0":"#f0c9c9"),marginRight:8,alignSelf:"center"}}>{acctStatus==="demo"?(settings.demoUsed?"DEMO USED":"DEMO — 1 FREE QUOTE"):"SUSPENDED"}</span>)}<button onClick={()=>setProfileOpen(!profileOpen)} style={{width:34,height:34,borderRadius:"50%",background:"#EFC01E",border:"none",color:"#111",fontSize:14,fontWeight:600,cursor:"pointer"}}>{user.name[0].toUpperCase()}</button>
            {profileOpen&&(<div style={{position:"absolute",top:42,right:0,width:180,background:"#f4f2ee",border:"1px solid #e4e1da",borderRadius:10,padding:8,zIndex:200,boxShadow:"0 12px 40px rgba(0,0,0,0.5)"}}><div style={{padding:"8px 10px",borderBottom:"1px solid #e4e1da",marginBottom:4}}><div style={{fontSize:13,color:"#1d1b18",fontWeight:500}}>{user.name}</div><div style={{fontSize:10,color:"#908a82"}}>{user.email}</div></div>{isSuper&&<button onClick={()=>{setModal("platform");setProfileOpen(false);}} style={{width:"100%",padding:"8px 10px",borderRadius:6,background:"transparent",border:"none",color:"#EFC01E",cursor:"pointer",fontSize:12,textAlign:"left",fontWeight:600}}>★ Platform (Super Admin)</button>}<button onClick={handleLogout} style={{width:"100%",padding:"8px 10px",borderRadius:6,background:"transparent",border:"none",color:"#d23b3b",cursor:"pointer",fontSize:12,textAlign:"left"}}>Sign out</button></div>)}
          </div>
        </div>
      </div>
      {modal==="designs"&&<DesignsModal designs={designs} onLoad={loadDesign} onDelete={deleteDesign} onClose={()=>setModal(null)}/>}
      {modal==="admin"&&<AdminModal settings={settings} onSave={handleSaveSettings} onClose={()=>setModal(null)}/>}
      {modal==="platform"&&isSuper&&<PlatformModal plans={settings.platformPlans||PLANS} addons={settings.socialAddons||SOCIAL_ADDONS} onSavePlans={async(pl,sa)=>{const ns={...settings,platformPlans:pl,socialAddons:sa};setSettings(ns);await dbSaveSettings(user.email,ns,user.name);}} onClose={()=>setModal(null)}/>}
      {modal==="ar"&&<ARModal config={config} settings={settings} user={user} onClose={()=>setModal(null)}/>}
      <LandingPage settings={settings} onStart={()=>setPage("configurator")} onPreset={p=>{loadPreset(p);setPage("configurator");}}/>
    </div>
  );

  // Configurator
  return(
    <div style={{width:"100%",height:"100vh",display:"flex",flexDirection:"column",background:"#ffffff",color:"#1d1b18",fontFamily:"'Poppins',sans-serif",overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      {modal==="whatsapp"&&<CaptureModal action="whatsapp" onSubmit={handleCapture} onClose={()=>setModal(null)}/>}
      {modal==="pdf"&&<CaptureModal action="pdf" onSubmit={handleCapture} onClose={()=>setModal(null)}/>}
      {modal==="admin"&&<AdminModal settings={settings} onSave={handleSaveSettings} onClose={()=>setModal(null)}/>}
      {modal==="platform"&&isSuper&&<PlatformModal plans={settings.platformPlans||PLANS} addons={settings.socialAddons||SOCIAL_ADDONS} onSavePlans={async(pl,sa)=>{const ns={...settings,platformPlans:pl,socialAddons:sa};setSettings(ns);await dbSaveSettings(user.email,ns,user.name);}} onClose={()=>setModal(null)}/>}
      {modal==="ar"&&<ARModal config={config} settings={settings} user={user} onClose={()=>setModal(null)}/>}
      {modal==="designs"&&<DesignsModal designs={designs} onLoad={loadDesign} onDelete={deleteDesign} onClose={()=>setModal(null)}/>}
      {fullDrawing&&<DrawingPage mode={fullDrawing} config={config} settings={settings} canvasRef={canvasRef} onClose={()=>setFullDrawing(null)}/>}

      {/* Top */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",borderBottom:"1px solid #e4e1da",background:"#ffffff",flexShrink:0,position:"relative",zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span onClick={()=>setPage("landing")} style={{fontSize:14,fontWeight:700,color:settings.business?.accent||"#EFC01E",cursor:"pointer"}}>{settings.business?.name||BRAND}</span>
          <div style={{position:"relative"}}>
            <button onClick={()=>setPresetOpen(!presetOpen)} style={{padding:"4px 10px",borderRadius:6,background:presetOpen?"#EFC01E22":"#f0eee9",border:presetOpen?"1px solid #EFC01E44":"1px solid #d8d4cc",color:presetOpen?"#EFC01E":"#847e76",cursor:"pointer",fontSize:10}}>Presets ▾</button>
            {presetOpen&&(<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,width:320,maxHeight:380,overflowY:"auto",background:"#f4f2ee",border:"1px solid #e4e1da",borderRadius:10,boxShadow:"0 12px 40px rgba(0,0,0,0.5)",padding:4,zIndex:200}}>{PRESETS.map(p=>(<button key={p.id} onClick={()=>loadPreset(p)} style={{display:"block",width:"100%",padding:"7px 8px",borderRadius:6,background:"transparent",border:"none",cursor:"pointer",textAlign:"left",color:"#1d1b18"}} onMouseEnter={e=>e.currentTarget.style.background="#eae7e1"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><div style={{fontSize:11,fontWeight:500}}>{p.name} <span style={{fontSize:9,color:"#9c968e"}}>{p.tag}</span></div><div style={{fontSize:9,color:"#908a82"}}>{toFI(p.width)}×{toFI(p.height)}</div></button>))}</div>)}
          </div>
        </div>
        <div style={{display:"flex",gap:1}}>{STEPS.map((s,i)=>(<button key={i} onClick={()=>{setStep(i);setPresetOpen(false);}} style={{padding:"4px 8px",borderRadius:5,background:step===i?"#EFC01E22":"transparent",border:step===i?"1px solid #EFC01E44":"1px solid transparent",color:step===i?"#EFC01E":i<step?"#847e76":"#aaa49c",cursor:"pointer",fontSize:10,fontWeight:step===i?500:400}}>{s.l}</button>))}</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={saveDesign} style={{background:"#EFC01E22",border:"1px solid #EFC01E44",borderRadius:6,padding:"5px 10px",cursor:"pointer",color:"#EFC01E",fontSize:10,fontWeight:500}}>{editingDesignId?"Update":"Save"}</button>
          <button onClick={()=>{if(canExport())setModal("whatsapp");}} style={{background:"#25D366",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",color:"#fff",fontSize:10,fontWeight:500}}>WhatsApp</button>
          <button onClick={()=>{if(canExport())setModal("pdf");}} style={{background:"transparent",border:"1px solid #d8d4cc",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:"#847e76",fontSize:10}}>PDF</button>
          <div style={{fontSize:13,color:"#EFC01E",fontWeight:600,marginLeft:4}}>Rs. {fmtLKR(price.total)}</div>
        </div>
      </div>
      {presetOpen&&<div onClick={()=>setPresetOpen(false)} style={{position:"fixed",inset:0,zIndex:50}}/>}

      {/* Main */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        <div style={{flex:1,position:"relative"}}>
          <div style={{position:"absolute",top:12,right:12,zIndex:10,display:"flex",gap:8,alignItems:"center"}}>
            {viewMode==="3d"&&hasDoors&&!editInt&&(<button onClick={()=>setDoorsOpen(o=>!o)} style={{padding:"7px 14px",fontSize:12,fontWeight:600,background:"#ffffffee",backdropFilter:"blur(10px)",color:doorsOpen?"#EFC01E":"#6b655d",border:"1px solid "+(doorsOpen?"#EFC01E":"#e4e1da"),borderRadius:8,cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>{doorsOpen?"Close Doors":"Open Doors"}</button>)}
            <div style={{display:"flex",background:"#ffffffee",backdropFilter:"blur(10px)",borderRadius:8,border:"1px solid #e4e1da",overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <button onClick={()=>setViewMode("3d")} style={{padding:"7px 14px",fontSize:12,fontWeight:viewMode==="3d"?600:400,background:viewMode==="3d"?"#EFC01E22":"transparent",color:viewMode==="3d"?"#9a7a0a":"#847e76",border:"none",cursor:"pointer",borderRight:"1px solid #e4e1da"}}>3D</button>
              <button onClick={()=>setViewMode("2d")} style={{padding:"7px 14px",fontSize:12,fontWeight:viewMode==="2d"?600:400,background:viewMode==="2d"?"#EFC01E22":"transparent",color:viewMode==="2d"?"#9a7a0a":"#847e76",border:"none",cursor:"pointer",borderRight:"1px solid #e4e1da"}}>2D</button>
              <button onClick={()=>setViewMode("dims")} style={{padding:"7px 14px",fontSize:12,fontWeight:viewMode==="dims"?600:400,background:viewMode==="dims"?"#EFC01E22":"transparent",color:viewMode==="dims"?"#9a7a0a":"#847e76",border:"none",cursor:"pointer",borderRight:"1px solid #e4e1da",whiteSpace:"nowrap"}}>Dimensions</button>
              <button onClick={()=>setFullDrawing(viewMode)} title="Fullscreen" style={{padding:"7px 12px",fontSize:12,background:"transparent",color:"#847e76",border:"none",cursor:"pointer"}}>⛶</button>
            </div>
          </div>
          <canvas ref={canvasRef} style={{width:"100%",height:"100%",display:viewMode==="3d"?"block":"none",cursor:"grab"}}/>
          {viewMode==="2d"&&(<div style={{flex:1,height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",padding:20}} dangerouslySetInnerHTML={{__html:gen2DSvg(config,settings.materials,600,480,settings.business?.name||BRAND)}}/>)}
          {viewMode==="dims"&&(<div style={{flex:1,height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",padding:20,overflow:"auto"}} dangerouslySetInnerHTML={{__html:genDimsSvg(config,settings.materials,760,560,settings.business?.name||BRAND)}}/>)}
          <div style={{position:"absolute",top:12,left:12,background:"#ffffffee",backdropFilter:"blur(10px)",borderRadius:8,padding:"7px 14px",border:"1px solid #e4e1da",fontSize:12,color:"#6b655d",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>{toFI(config.width)}×{toFI(config.height)}×{toFI(config.depth)} · <span style={{color:"#EFC01E",fontWeight:600}}>{price.sqft}sqft</span></div>
          {editInt&&hasDoors&&viewMode==="3d"&&(<div style={{position:"absolute",top:52,left:12,background:"#EFC01E22",borderRadius:6,padding:"4px 10px",border:"1px solid #EFC01E44",fontSize:10,color:"#9a7a0a"}}>Doors hidden — editing interior</div>)}
        </div>

        {/* Panel */}
        <div style={{width:384,background:"#ffffff",borderLeft:"1px solid #e4e1da",overflowY:"auto",flexShrink:0,padding:24}}>
          {step===0&&(<div><h3 style={{fontSize:18,fontWeight:600,marginBottom:20}}>Dimensions</h3>
            <div style={{marginBottom:20}}>
              <span style={sl}>Shape</span>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                {[["straight","Straight"],["L","L-Shape (corner)"]].map(([id,l])=>{const lock=id==="L"&&!isPro;return(<button key={id} onClick={()=>{if(id==="L"&&!proGate("L-shaped wardrobes"))return;upd({shape:id});}} style={{flex:1,padding:"11px 0",borderRadius:9,background:config.shape===id?"#EFC01E22":"#f0eee9",border:config.shape===id?"2px solid #EFC01E":"1px solid #d8d4cc",color:config.shape===id?"#9a7a0a":"#847e76",cursor:"pointer",fontSize:13,fontWeight:600,opacity:lock?0.7:1}}>{l}{lock?" 🔒 Pro":""}</button>);})}
              </div>
              {config.shape==="L"&&<div style={{fontSize:10,color:"#9c968e",marginTop:8,lineHeight:1.5}}>Two runs meeting at a 90° corner. Both share the same height &amp; depth. Set Leg A here; Leg B width below. (Per-leg interior editing comes next.)</div>}
            </div>
            {config.shape==="L"&&<div style={{fontSize:11,color:"#EFC01E",fontWeight:600,marginBottom:10}}>LEG A (this run)</div>}
            {[{k:"width",l:config.shape==="L"?"Leg A Width":"Width",mn:1219,mx:3048,s:10},{k:"height",l:"Height",mn:1524,mx:2438,s:10},{k:"depth",l:"Depth",mn:508,mx:610,s:5}].map(({k,l,mn,mx,s})=>(<div key={k} style={{marginBottom:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}><span style={sl}>{l}</span><div style={{display:"flex",alignItems:"center",gap:6}}><DimInput value={config[k]} min={mn} max={mx} onChange={v=>upd({[k]:v})} suffix="mm"/><span style={{fontSize:10,color:"#9c968e"}}>{toFI(config[k])}</span></div></div><input type="range" min={mn} max={mx} step={s} value={config[k]} onChange={e=>upd({[k]:Number(e.target.value)})} style={{width:"100%",accentColor:"#EFC01E",cursor:"pointer"}}/></div>))}
            <div><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={sl}>{config.shape==="L"?"Leg A Sections":"Sections"}</span><span style={{fontSize:10,color:"#9c968e"}}>{sectionW}mm ({toFI(sectionW)})</span></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Array.from({length:secRange.max-secRange.min+1},(_,i)=>secRange.min+i).map(n=>(<button key={n} onClick={()=>upd({sections:n})} style={{width:38,height:38,borderRadius:7,background:config.sections===n?"#EFC01E22":"#f0eee9",border:config.sections===n?"1px solid #EFC01E":"1px solid #d8d4cc",color:config.sections===n?"#EFC01E":"#847e76",cursor:"pointer",fontSize:15,fontWeight:500}}>{n}</button>))}</div></div>
            {config.shape==="L"&&(<div style={{marginTop:20,paddingTop:16,borderTop:"1px solid #e4e1da"}}>
              <div style={{fontSize:11,color:"#EFC01E",fontWeight:600,marginBottom:10}}>LEG B (corner run)</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}><span style={sl}>Leg B Width</span><div style={{display:"flex",alignItems:"center",gap:6}}><DimInput value={config.legB.width} min={1219} max={3048} onChange={v=>setConfig(p=>({...p,legB:{...p.legB,width:clamp(v,1219,3048)}}))} suffix="mm"/><span style={{fontSize:10,color:"#9c968e"}}>{toFI(config.legB.width)}</span></div></div>
              <input type="range" min={1219} max={3048} step={10} value={config.legB.width} onChange={e=>setConfig(p=>({...p,legB:{...p.legB,width:Number(e.target.value)}}))} style={{width:"100%",accentColor:"#EFC01E",cursor:"pointer"}}/>
              <div style={{display:"flex",justifyContent:"space-between",margin:"12px 0 8px"}}><span style={sl}>Leg B Sections</span></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{[1,2,3,4,5].map(n=>(<button key={n} onClick={()=>setConfig(p=>({...p,legB:{...p.legB,sections:n,modules:(p.legB.modules||[]).filter(m=>m.section<n)}}))} style={{width:38,height:38,borderRadius:7,background:config.legB.sections===n?"#EFC01E22":"#f0eee9",border:config.legB.sections===n?"1px solid #EFC01E":"1px solid #d8d4cc",color:config.legB.sections===n?"#EFC01E":"#847e76",cursor:"pointer",fontSize:15,fontWeight:500}}>{n}</button>))}</div>
            </div>)}
            <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid #e4e1da"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:config.topCupboard?12:0}}>
                <div><div style={{fontSize:13,color:"#34302b",fontWeight:500}}>Top Cupboard</div><div style={{fontSize:10,color:"#9c968e"}}>Overhead storage compartment</div></div>
                <button onClick={()=>upd({topCupboard:!config.topCupboard})} style={{width:44,height:24,borderRadius:12,background:config.topCupboard?"#EFC01E":"#d8d4cc",border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s"}}><div style={{position:"absolute",top:2,left:config.topCupboard?22:2,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/></button>
              </div>
              {config.topCupboard&&(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}><span style={sl}>Cupboard Height</span><div style={{display:"flex",alignItems:"center",gap:6}}><DimInput value={config.topCupboardHeight||457} min={250} max={Math.min(700,Math.round(config.height*0.4))} onChange={v=>upd({topCupboardHeight:v})} suffix="mm"/><span style={{fontSize:10,color:"#9c968e"}}>{toFI(config.topCupboardHeight||457)}</span></div></div><input type="range" min={250} max={Math.min(700,Math.round(config.height*0.4))} step={5} value={config.topCupboardHeight||457} onChange={e=>upd({topCupboardHeight:Number(e.target.value)})} style={{width:"100%",accentColor:"#EFC01E",cursor:"pointer"}}/><div style={{fontSize:10,color:"#9c968e",marginTop:4}}>Divider sits at {toFI(config.height-(config.topCupboardHeight||457))} from floor</div></div>)}
            </div>
          </div>)}
          {step===1&&(<div><h3 style={{fontSize:18,fontWeight:600,marginBottom:16}}>Material</h3>
            <div style={{fontSize:11,color:"#9c968e",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Exterior Color (doors &amp; carcass)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>{settings.materials.map(m=>(<button key={m.id} onClick={()=>upd({materialId:m.id})} style={{padding:10,borderRadius:8,background:config.materialId===m.id?"#f0eee9":"#faf9f7",border:config.materialId===m.id?"2px solid #EFC01E":"1px solid #e4e1da",cursor:"pointer",textAlign:"left"}}><div style={{width:"100%",height:28,borderRadius:5,background:m.color,marginBottom:6,border:"1px solid #ffffff15"}}/><div style={{fontSize:11,color:"#34302b",fontWeight:500}}>{m.name}</div></button>))}</div>
            <div style={{fontSize:11,color:"#9c968e",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Interior Color (shelves, dividers &amp; drawers)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{settings.materials.map(m=>(<button key={"i"+m.id} onClick={()=>upd({interiorMaterialId:m.id})} style={{padding:10,borderRadius:8,background:(config.interiorMaterialId||config.materialId)===m.id?"#f0eee9":"#faf9f7",border:(config.interiorMaterialId||config.materialId)===m.id?"2px solid #EFC01E":"1px solid #e4e1da",cursor:"pointer",textAlign:"left"}}><div style={{width:"100%",height:28,borderRadius:5,background:m.color,marginBottom:6,border:"1px solid #ffffff15"}}/><div style={{fontSize:11,color:"#34302b",fontWeight:500}}>{m.name}</div></button>))}</div></div>)}
          {step===2&&(<div><h3 style={{fontSize:18,fontWeight:600,marginBottom:20}}>Doors</h3>
            {isL&&(<div style={{display:"flex",gap:8,marginBottom:16}}>
              {[["A","Leg A"],["B","Leg B"]].map(([id,l])=>(<button key={id} onClick={()=>setEditLeg(id)} style={{flex:1,padding:"9px 0",borderRadius:8,background:actLeg===id?"#EFC01E22":"#f0eee9",border:actLeg===id?"2px solid #EFC01E":"1px solid #d8d4cc",color:actLeg===id?"#9a7a0a":"#847e76",cursor:"pointer",fontSize:12,fontWeight:600}}>{l}</button>))}
            </div>)}
            {(()=>{const legW=actLeg==="B"?config.legB.width:config.width;const curStyle=actLeg==="B"?config.legB.doorStyle:config.doorStyle;const setStyle=v=>{if(actLeg==="B")setConfig(p=>({...p,legB:{...p.legB,doorStyle:v}}));else upd({doorStyle:v});};
            return(<><div style={{display:"flex",flexDirection:"column",gap:8}}>{DOOR_STYLES.map(d=>{const dis=d.id==="sliding"&&legW<SLIDING_MIN_WIDTH;return(<button key={d.id} disabled={dis} onClick={()=>{if(!dis)setStyle(d.id);}} style={{padding:"12px 14px",borderRadius:8,background:curStyle===d.id?"#f0eee9":"#faf9f7",border:curStyle===d.id?"2px solid #EFC01E":"1px solid #e4e1da",cursor:dis?"not-allowed":"pointer",textAlign:"left",opacity:dis?0.45:1}}><span style={{fontSize:12,color:curStyle===d.id?"#EFC01E":"#4a4640",fontWeight:500}}>{d.name}</span>{dis&&<span style={{fontSize:9.5,color:"#9c968e",marginLeft:8}}>needs ≥ 4'0" (48") width</span>}{d.id==="sliding"&&!dis&&<span style={{fontSize:9.5,color:"#9c968e",marginLeft:8}}>each panel 24"–36"</span>}</button>);})}</div>
            {curStyle==="sliding"&&(()=>{const sr=getSlidingPanelRange(legW);const curP=actLeg==="B"?config.legB.slidingPanels:config.slidingPanels;const setP=n=>{if(actLeg==="B")setConfig(p=>({...p,legB:{...p.legB,slidingPanels:n}}));else upd({slidingPanels:n});};return(<div style={{marginTop:16}}><span style={sl}>Panels{isL?` (${actLeg==="A"?"Leg A":"Leg B"})`:""}</span><div style={{display:"flex",gap:6,marginTop:6}}>{Array.from({length:sr.max-sr.min+1},(_,i)=>sr.min+i).map(n=>(<button key={n} onClick={()=>setP(n)} style={{width:38,height:38,borderRadius:7,background:curP===n?"#EFC01E22":"#f0eee9",border:curP===n?"1px solid #EFC01E":"1px solid #d8d4cc",color:curP===n?"#EFC01E":"#847e76",cursor:"pointer",fontSize:15,fontWeight:500}}>{n}</button>))}</div></div>);})()}</>);})()}
          </div>)}
          {step===3&&(<div><h3 style={{fontSize:18,fontWeight:600,marginBottom:8}}>Interior</h3>
            {isL&&(<div style={{display:"flex",gap:8,marginBottom:14}}>
              {[["A","Leg A"],["B","Leg B"]].map(([id,l])=>(<button key={id} onClick={()=>setEditLeg(id)} style={{flex:1,padding:"9px 0",borderRadius:8,background:actLeg===id?"#EFC01E22":"#f0eee9",border:actLeg===id?"2px solid #EFC01E":"1px solid #d8d4cc",color:actLeg===id?"#9a7a0a":"#847e76",cursor:"pointer",fontSize:12,fontWeight:600}}>{l}</button>))}
            </div>)}
            {isL&&<div style={{fontSize:10,color:"#9c968e",marginBottom:12}}>Editing the interior of <b style={{color:"#9a7a0a"}}>{actLeg==="A"?"Leg A":"Leg B"}</b> ({actSections} section{actSections!==1?"s":""})</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:16}}>{MODULE_TYPES.map(m=>(<div key={m.id} style={{padding:8,borderRadius:6,background:"#f0eee9",border:"1px solid #e4e1da"}}><div style={{fontSize:16,marginBottom:3}}>{m.icon}</div><div style={{fontSize:10,color:"#4a4640",fontWeight:500}}>{m.name}</div><div style={{display:"flex",gap:2,marginTop:6,flexWrap:"wrap"}}>{Array.from({length:actSections},(_,i)=>{const ok=canAdd(m.id,i);return(<button key={i} onClick={()=>ok&&addMod(m.id,i)} disabled={!ok} style={{flex:"1 0 auto",minWidth:22,padding:"2px 0",borderRadius:3,fontSize:8,background:ok?"#EFC01E22":"#f4f2ee",border:ok?"1px solid #EFC01E44":"1px solid #2a2925",color:ok?"#EFC01E":"#555555",cursor:ok?"pointer":"not-allowed",opacity:ok?1:0.5}}>S{i+1}</button>);})}</div></div>))}</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>{actModules.map(m=>{const mty=MODULE_TYPES.find(t=>t.id===m.type);const hm=Math.round(m.yNorm*config.height);return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:6,background:"#f4f2ee",border:"1px solid #e4e1da"}}><span style={{fontSize:12,width:16}}>{mty?.icon}</span><div style={{flex:1}}><div style={{fontSize:11,color:"#4a4640"}}>{mty?.name}</div><div style={{fontSize:9,color:"#9c968e"}}>S{m.section+1}·{toFI(hm)}</div></div><button onClick={()=>setActModules(actModules.map(x=>x.id===m.id?{...x,yNorm:Math.min(0.92,x.yNorm+0.04)}:x))} style={{width:22,height:22,borderRadius:4,background:"#eae7e1",border:"1px solid #d8d4cc",color:"#78726a",cursor:"pointer",fontSize:11}}>↑</button><button onClick={()=>setActModules(actModules.map(x=>x.id===m.id?{...x,yNorm:Math.max(0.03,x.yNorm-0.04)}:x))} style={{width:22,height:22,borderRadius:4,background:"#eae7e1",border:"1px solid #d8d4cc",color:"#78726a",cursor:"pointer",fontSize:11}}>↓</button><button onClick={()=>setActModules(actModules.filter(x=>x.id!==m.id))} style={{width:22,height:22,borderRadius:4,background:"#fbeaea",border:"1px solid #f0c9c9",color:"#d23b3b",cursor:"pointer",fontSize:11}}>×</button></div>);})}</div>
          </div>)}
          {step===4&&(<div><h3 style={{fontSize:20,fontWeight:600,marginBottom:14}}>Add-ons</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{settings.accessories.map(acc=>{const a=(config.accessories||[]).includes(acc.id);return(<button key={acc.id} onClick={()=>toggleAcc(acc.id)} style={{display:"flex",flexDirection:"column",padding:0,borderRadius:12,textAlign:"left",background:"#fff",border:a?"2px solid #EFC01E":"1px solid #e4e1da",cursor:"pointer",overflow:"hidden",boxShadow:a?"0 4px 14px rgba(239,192,30,0.18)":"0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{position:"relative",width:"100%",height:96,background:"#f4f2ee",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {acc.image?<img src={acc.image} alt={acc.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:44,height:44,borderRadius:10,background:"#EFC01E22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#EFC01E",fontWeight:700}}>{acc.icon}</div>}
                {a&&<div style={{position:"absolute",top:8,right:8,width:22,height:22,borderRadius:"50%",background:"#EFC01E",color:"#1d1b18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700}}>✓</div>}
              </div>
              <div style={{padding:"10px 12px"}}>
                <div style={{fontSize:13,color:a?"#9a7a0a":"#1d1b18",fontWeight:600}}>{acc.name}</div>
                <div style={{fontSize:10.5,color:"#9c968e",marginTop:2,lineHeight:1.4,minHeight:28}}>{acc.desc}</div>
                <div style={{fontSize:13,color:"#EFC01E",fontWeight:600,marginTop:6}}>Rs. {fmtLKR(acc.price)} <span style={{fontSize:9,color:"#9c968e",fontWeight:400}}>{acc.per}</span></div>
              </div>
            </button>);})}</div>
            <div style={{marginTop:20}}><span style={sl}>Notes</span><textarea value={config.notes||""} onChange={e=>upd({notes:e.target.value})} placeholder="Special instructions..." rows={3} style={{width:"100%",marginTop:6,padding:10,borderRadius:6,background:"#f4f2ee",border:"1px solid #e4e1da",color:"#4a4640",fontSize:11,fontFamily:"inherit",resize:"vertical",outline:"none"}}/></div>
          </div>)}
          {step===5&&(<div><h3 style={{fontSize:18,fontWeight:600,marginBottom:20}}>Summary</h3>
            <div style={{background:"#f4f2ee",borderRadius:10,border:"1px solid #e4e1da",padding:14,marginBottom:14}}>{[["Size",`${toFI(config.width)}×${toFI(config.height)}×${toFI(config.depth)}`],["Area",`${price.sqft} sqft`],["Sections",`${config.sections}`],["Doors",DOOR_STYLES.find(d=>d.id===config.doorStyle)?.name],["Color",settings.materials.find(m=>m.id===config.materialId)?.name],["Modules",`${config.modules.length}`]].map(([k,v],i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #e4e1da"}}><span style={{fontSize:11,color:"#847e76"}}>{k}</span><span style={{fontSize:11,color:"#4a4640"}}>{v}</span></div>))}</div>
            <div style={{background:"#f4f2ee",borderRadius:10,border:"1px solid #e4e1da",padding:14,marginBottom:14}}>{price.isL?(<>
            <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #e4e1da"}}><span style={{fontSize:11,color:"#847e76"}}>Leg A ({price.legA.sqft}sqft × Rs.{fmtLKR(price.legA.rate)} · {(DOOR_STYLES.find(d=>d.id===config.doorStyle)||{}).name})</span><span style={{fontSize:11,color:"#4a4640"}}>Rs. {fmtLKR(price.legA.price)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #e4e1da"}}><span style={{fontSize:11,color:"#847e76"}}>Leg B ({price.legB.sqft}sqft × Rs.{fmtLKR(price.legB.rate)} · {(DOOR_STYLES.find(d=>d.id===config.legB.doorStyle)||{}).name})</span><span style={{fontSize:11,color:"#4a4640"}}>Rs. {fmtLKR(price.legB.price)}</span></div>
            {price.cornerCharge>0&&(<div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #e4e1da"}}><span style={{fontSize:11,color:"#847e76"}}>Corner (post, filler &amp; joining)</span><span style={{fontSize:11,color:"#4a4640"}}>Rs. {fmtLKR(price.cornerCharge)}</span></div>)}
            </>):(<div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #e4e1da"}}><span style={{fontSize:11,color:"#847e76"}}>Base ({price.sqft}sqft × Rs.{fmtLKR(price.perSqft)} · {(DOOR_STYLES.find(d=>d.id===config.doorStyle)||{}).name})</span><span style={{fontSize:11,color:"#4a4640"}}>Rs. {fmtLKR(price.basePrice)}</span></div>)}{price.accBreakdown.map((a,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #e4e1da"}}><span style={{fontSize:11,color:"#847e76"}}>{a.label}</span><span style={{fontSize:11,color:"#4a4640"}}>Rs. {fmtLKR(a.cost)}</span></div>))}{payCalc.disc>0&&(<div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #e4e1da"}}><span style={{fontSize:11,color:"#847e76"}}>Discount ({payCalc.discountPct}%)</span><span style={{fontSize:11,color:"#2e7d32"}}>− Rs. {fmtLKR(payCalc.disc)}</span></div>)}<div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:4}}><span style={{fontSize:13,fontWeight:600}}>{payCalc.disc>0?"Net Total":"Total"}</span><span style={{fontSize:18,color:"#EFC01E",fontWeight:700}}>Rs. {fmtLKR(payCalc.net)}</span></div>{payCalc.advancePct>0&&(<div style={{marginTop:8,paddingTop:8,borderTop:"1px dashed #d8d4cc"}}><div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:11,color:"#8a6c08",fontWeight:600}}>Advance to confirm ({payCalc.advancePct}%)</span><span style={{fontSize:12,color:"#8a6c08",fontWeight:700}}>Rs. {fmtLKR(payCalc.adv)}</span></div><div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{fontSize:10.5,color:"#9c968e"}}>Balance on completion</span><span style={{fontSize:11,color:"#847e76"}}>Rs. {fmtLKR(payCalc.bal)}</span></div></div>)}</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <button onClick={()=>setFullDrawing("3d")} style={{flex:1,padding:"10px 0",borderRadius:8,background:"#f0eee9",border:"1px solid #d8d4cc",color:"#6b655d",fontSize:11,cursor:"pointer"}}>View 3D Page</button>
              <button onClick={()=>setFullDrawing("2d")} style={{flex:1,padding:"10px 0",borderRadius:8,background:"#f0eee9",border:"1px solid #d8d4cc",color:"#6b655d",fontSize:11,cursor:"pointer"}}>View 2D Page</button>
              <button onClick={()=>setFullDrawing("dims")} style={{flex:1,padding:"10px 0",borderRadius:8,background:"#f0eee9",border:"1px solid #d8d4cc",color:"#6b655d",fontSize:11,cursor:"pointer"}}>Full Measurements</button>
            </div>
            <button onClick={()=>{if(canExport())setModal("whatsapp");}} style={{width:"100%",padding:"14px 0",borderRadius:10,background:"#25D366",border:"none",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Send Quote via WhatsApp</button>
            <button onClick={()=>{if(canExport())setModal("pdf");}} style={{width:"100%",padding:"12px 0",borderRadius:10,marginTop:8,background:"linear-gradient(135deg,#EFC01E,#caa10c)",border:"none",color:"#111",fontSize:13,fontWeight:600,cursor:"pointer"}}>Download PDF Quote (5 pages)</button>
            <button onClick={()=>{if(!proGate("The Cut List"))return;if(acctStatus!=="active"){alert("Cut list export is available on an active plan.\n\nContact Plan My Wardrobe to activate your account.");return;}generateCutList(config,settings);}} style={{width:"100%",padding:"12px 0",borderRadius:10,marginTop:8,background:"#f0eee9",border:"1px solid #555555",color:"#34302b",fontSize:13,fontWeight:500,cursor:"pointer"}}>⚙ Download Cut List (Workshop){!isPro?" 🔒 Pro":""}</button>
            <button onClick={()=>{if(!proGate('AR "View in My Room"'))return;setModal("ar");}} style={{width:"100%",padding:"12px 0",borderRadius:10,marginTop:8,background:"#fff",border:"1px solid #EFC01E",color:"#9a7a0a",fontSize:13,fontWeight:600,cursor:"pointer"}}>📷 View in My Room (AR){!isPro?" 🔒 Pro":""}</button>
            <button onClick={saveDesign} style={{width:"100%",padding:"12px 0",borderRadius:10,marginTop:8,background:"transparent",border:"1px solid #EFC01E44",color:"#EFC01E",fontSize:12,cursor:"pointer"}}>{editingDesignId?"Update Saved Design":"Save to My Designs"}</button>
          </div>)}
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 18px",borderTop:"1px solid #e4e1da",background:"#ffffff",flexShrink:0}}>
        <button onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0} style={{padding:"7px 18px",borderRadius:7,background:step===0?"#f4f2ee":"#f0eee9",border:"1px solid #d8d4cc",color:step===0?"#555555":"#78726a",cursor:step===0?"not-allowed":"pointer",fontSize:11}}>Back</button>
        <div style={{fontSize:10,color:"#aaa49c"}}>Step {step+1}/6</div>
        <button onClick={()=>setStep(Math.min(5,step+1))} disabled={step===5} style={{padding:"7px 18px",borderRadius:7,background:step===5?"#f4f2ee":"#EFC01E22",border:step===5?"1px solid #d8d4cc":"1px solid #EFC01E44",color:step===5?"#555555":"#EFC01E",cursor:step===5?"not-allowed":"pointer",fontSize:11,fontWeight:500}}>Next</button>
      </div>
    </div>
  );
}
