/* the stage machine: one micro-step at a time through the decoding loop,
   with play/pause, whole-token stepping, reset, and the live re-shaping when a
   slider moves mid-pass */
import { $, esc, mulberry32 } from "./util.js";
import { S, HF } from "./state.js";
import { pipeline } from "./pipeline.js";
import { setActive, fireSpark } from "./flow.js";
import { dropCache, hfMessage, hfScores, promptTokens, mkToken } from "./hf.js";
import { renderOut, renderTape, buildRows, updateRows, renderCum, updateMetrics } from "./readouts.js";
import { setCaption } from "./captions.js";

const SEQ = ["embed","forward","logits","temperature","softmax","topk","topp","sample","append","check"];
function startToken(){
  S.stages = S.firstPass ? ["prompt","tokenize"].concat(SEQ) : SEQ.slice();
  S.firstPass = false;
  S.si = 0;
}
async function applyStage(stage){
  setActive(stage);
  switch(stage){
    case "prompt":
      renderOut(); break;
    case "tokenize":
      S.tokens = promptTokens($("promptIn").value.trim() || "The");
      S.promptLen = S.tokens.length;
      renderTape(true); renderOut(); break;
    case "embed": break;
    case "forward": {
      const fwd = $("n-fwd"); fwd.classList.add("busy");
      try{ S.full = await hfScores(); } finally{ fwd.classList.remove("busy"); }
      S.pipe = null; S.winner = -1;
      buildRows(); updateRows("logits"); break; }
    case "logits":
      updateRows("logits"); break;
    case "temperature":
      S.pipe = pipeline(); updateRows("temperature"); break;
    case "softmax":
      updateRows("softmax"); renderCum(false); break;
    case "topk":
      updateRows("topk"); break;
    case "topp":
      updateRows("topp"); renderCum(false); break;
    case "sample": {
      S.u = S.rng();
      let acc = 0, w = -1;
      for(let i=0;i<S.full.length;i++){ acc += S.pipe.fin[i]; if(S.u <= acc){ w = i; break; } }
      if(w < 0) for(let i=S.full.length-1;i>=0;i--){ if(S.pipe.keptP[i]){ w = i; break; } }
      S.winner = w;
      if(S.dispIdx.indexOf(w) === -1) S.dispIdx[S.dispIdx.length-1] = w;
      updateRows("sample"); renderCum(true); break; }
    case "append": {
      const c = S.full[S.winner];
      if(HF.eos.has(c.id)){ S.eos = true; S.stopTok = c.key; }
      S.tokens.push(mkToken(c.key, true, c.id));
      S.gen++;
      renderTape(); renderOut(); break; }
    case "check":
      if(S.eos){ S.stopWhy = "eos"; finish(); }
      else if(S.gen >= S.max){ S.stopWhy = "budget"; finish(); }
      else fireSpark();
      break;
  }
  setCaption(stage);
  updateMetrics();
}
function finish(){
  S.finished = true;
  setPlaying(false);
  $("n-done").classList.add("on");
  $("e9").classList.add("on");
  renderOut();
}
export async function advance(){
  if(S.busy || S.finished) return;
  if(S.si >= S.stages.length) startToken();
  const stage = S.stages[S.si];
  S.busy = true;
  try{
    await applyStage(stage);
    S.si++; S.micro++;
    updateMetrics();
  }catch(err){
    setPlaying(false);
    $("capStage").textContent = "no answer";
    $("capText").innerHTML = esc(hfMessage(err));
  }finally{ S.busy = false; }
}
export async function wholeToken(){
  setPlaying(false);
  for(let guard = 0; guard < 40; guard++){
    const stage = S.si >= S.stages.length ? null : S.stages[S.si];
    await advance();
    if(S.finished || stage === "check") break;
  }
}
function tick(){
  if(!S.playing) return;
  advance().then(()=>{
    if(!S.playing || S.finished) return;
    S.timer = setTimeout(tick, S.dwell === 0 ? 14 : S.dwell);
  });
}
export function setPlaying(v){
  S.playing = v && !S.finished;
  clearTimeout(S.timer);
  $("playBtn").innerHTML = S.playing ? '&#9611;&#9611; Pause <kbd>space</kbd>' : '&#9654; Play <kbd>space</kbd>';
  $("pulse").classList.toggle("live", S.playing);
  if(S.playing) tick();
}
export function reset(){
  clearTimeout(S.timer);
  S.playing = false; S.finished = false; S.eos = false; S.busy = false;
  S.tokens = []; S.promptLen = 0; S.gen = 0; S.micro = 0; S.taped = 0;
  S.full = null; S.pipe = null; S.winner = -1; S.u = 0; S.firstPass = true; S.allLogits = null;
  if(HF.cache){ dropCache(HF.cache); HF.cache = null; HF.cacheLen = 0; }
  S.rng = mulberry32(S.seed); S.stopTok = "";
  startToken();
  $("rows").innerHTML = ""; S.rowEls = null;
  $("cumSeg").innerHTML = ""; $("dart").classList.remove("on");
  $("cumL").textContent = "Probability mass, laid end to end";
  $("cumR").textContent = "random draw u = —";
  $("scopeTitle").textContent = "Next-token distribution";
  $("scopeHint").textContent = "waiting for a forward pass";
  renderTape(true); renderOut();
  document.querySelectorAll("#flow .on").forEach(n=>n.classList.remove("on"));
  setPlaying(false);
  setCaption("prompt");
  $("capStage").textContent = "ready";
  updateMetrics();
}

/* re-run the shaping stages live when a slider moves mid-pass */
export function refreshScope(){
  if(!S.full || S.busy) return;
  const done = S.stages[S.si-1];
  if(["temperature","softmax","topk","topp","sample"].indexOf(done) === -1) return;
  S.pipe = pipeline();
  const stage = done === "sample" ? "topp" : done;
  if(done === "sample"){ S.winner = -1; S.si = S.stages.indexOf("sample"); }
  updateRows(stage); renderCum(false); setCaption(stage); updateMetrics();
}
