/* wiring the controls: sliders, buttons, the keyboard, the theme switch, the
   pop-out zoom, and the model sheet */
import { $, mulberry32 } from "./util.js";
import { S, HF } from "./state.js";
import { dropCache, pickDevice, hfLoad } from "./hf.js";
import { renderTape, updateMetrics } from "./readouts.js";
import { syncChatUI, syncModelUI } from "./model-ui.js";
import { setCaption } from "./captions.js";
import { advance, wholeToken, setPlaying, reset, refreshScope } from "./loop.js";

/* ---------- pop-out ---------- */
const PANELS = ["p-loop","p-out","p-tape","p-draw"];
function setZoom(id){
  const app = document.querySelector(".app"), cur = app.getAttribute("data-zoom");
  document.querySelectorAll(".panel.zoomed").forEach(p => p.classList.remove("zoomed"));
  if(!id || cur === id) app.removeAttribute("data-zoom");
  else { app.setAttribute("data-zoom", id); $(id).classList.add("zoomed"); }
  /* the tape scrolls sideways in a strip and downwards once it wraps */
  requestAnimationFrame(()=>{
    const w = $("tapeWrap");
    w.scrollLeft = w.scrollWidth; w.scrollTop = w.scrollHeight;
    $("outText").scrollTop = $("outText").scrollHeight;
    const r = $("rows"); if(r) r.scrollTop = 0;
  });
}


/* ---------- controls ---------- */
export function wire(){
  const bind = (id, out, fmt, key, after) => {
    const el = $(id);
    const push = () => { S[key] = parseFloat(el.value); $(out).textContent = fmt(S[key]); if(after) after(); };
    el.addEventListener("input", push); push();
  };
  bind("tempR","tempO", v=>v.toFixed(2), "temp", refreshScope);
  bind("kR","kO", v=>String(v), "k", refreshScope);
  bind("pR","pO", v=>v.toFixed(2), "p", refreshScope);
  bind("maxR","maxO", v=>String(v), "max", updateMetrics);
  bind("seedI","seedO", v=>String(v), "seed", ()=>{ if(S.gen === 0) S.rng = mulberry32(S.seed); });

  const fresh = () => { if(S.finished) reset(); };
  $("playBtn").onclick = ()=>{ fresh(); setPlaying(!S.playing); };
  $("stepBtn").onclick = ()=>{ setPlaying(false); fresh(); advance(); };
  $("tokBtn").onclick = ()=>{ fresh(); wholeToken(); };
  $("resetBtn").onclick = reset;
  $("restartBtn").onclick = reset;
  $("promptIn").addEventListener("keydown", e=>{ if(e.key === "Enter"){ e.preventDefault(); reset(); } });
  $("speedSel").onchange = e => { S.dwell = parseInt(e.target.value, 10); };
  $("cacheChk").onchange = e => { S.cache = e.target.checked;
    if(!S.cache && HF.cache){ dropCache(HF.cache); HF.cache = null; HF.cacheLen = 0; }
    renderTape(); if(!S.busy) setCaption(S.stages[Math.max(0,S.si-1)] || "prompt"); };
  $("themeBtn").onclick = ()=>{
    const root = document.documentElement, day = root.getAttribute("data-mode") === "day";
    root.classList.add("snap");
    root.setAttribute("data-mode", day ? "night" : "day");
    $("themeBtn").textContent = day ? "Daylight" : "Studio dark";
    requestAnimationFrame(()=> requestAnimationFrame(()=> root.classList.remove("snap")));
  };
  document.querySelectorAll(".xp").forEach(b => { b.onclick = ()=> setZoom(b.dataset.p); });
  $("modelBtn").onclick = async ()=>{
    $("sheet").hidden = false;
    $("hfDev").textContent = (await pickDevice()) === "webgpu" ? "WebGPU" : "WASM — no WebGPU here";
  };
  $("closeSheet").onclick = ()=>{ $("sheet").hidden = true; };
  $("hfSel").onchange = e => { $("hfId").value = e.target.value; };
  $("loadBtn").onclick = async ()=>{
    if(!await hfLoad($("hfId").value.trim(), $("hfDtype").value)) return;
    /* the model is up: start over on its vocabulary */
    syncChatUI(); syncModelUI(); reset();
  };
  $("chatChk").onchange = e =>{ HF.chat = e.target.checked; syncChatUI(); reset(); };
  document.addEventListener("keydown", e=>{
    if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if(e.key === " "){ e.preventDefault(); $("playBtn").click(); }
    else if(e.key === "ArrowRight"){ e.preventDefault(); $("stepBtn").click(); }
    else if(e.key === "Enter"){ e.preventDefault(); $("tokBtn").click(); }
    else if(e.key === "r" || e.key === "R"){ reset(); }
    else if(e.key === "Escape"){ setZoom(null); }
    else if(e.key >= "1" && e.key <= "4"){ e.preventDefault(); setZoom(PANELS[+e.key - 1]); }
  });
}

