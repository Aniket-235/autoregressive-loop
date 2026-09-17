/* the readouts that repaint after every micro-step: the running text, the
   token tape, the candidate rows, the cumulative bar, and the header metrics */
import { $, esc, showKey } from "./util.js";
import { S, HF } from "./state.js";
import { hfSpecial } from "./hf.js";

/* how many candidate rows the readout draws; the rest collapse into "others" */
const NROWS = 20;
/* the tape and the rows stand an interpunct in for a token's leading space */
const DOT = "·";
export const chipOf = key => key.replace(/^ /, DOT);

export function renderOut(){
  const el = $("outText");
  if(!S.tokens.length){
    el.innerHTML = '<span class="p">' + esc($("promptIn").value) + '</span>' +
                   (S.finished ? "" : '<span class="caret"></span>');
    return;
  }
  const last = S.tokens.length - 1;
  let html = "";
  S.tokens.forEach((t,i)=>{
    const sp = HF.eos.has(t.id) || hfSpecial(t.id);
    const cls = sp ? ("sp" + (t.gen && i === last ? " n" : ""))
                   : (!t.gen ? "p" : i === last ? "n" : "g");
    html += '<span class="' + cls + '">' + esc(t.key) + '</span>';
  });
  if(!S.finished) html += '<span class="caret"></span>';
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}
export function renderTape(rebuild){
  const el = $("tape");
  if(rebuild){ el.innerHTML = ""; S.taped = 0; }
  const prev = el.querySelectorAll(".chip.new");
  for(let i=0;i<prev.length;i++) prev[i].classList.remove("new");
  for(let i = S.taped || 0; i < S.tokens.length; i++){
    const t = S.tokens[i], d = document.createElement("div");
    const isEnd = HF.eos.has(t.id);
    const isSp  = !isEnd && hfSpecial(t.id);
    d.className = "chip " + (t.gen ? "gn" : "pr") + (isEnd ? " eos" : isSp ? " spec" : "") + (t.gen ? " new" : "");
    d.innerHTML = showKey(chipOf(t.key)) + "<u>" + i + "</u>";
    el.appendChild(d);
  }
  S.taped = S.tokens.length;
  const kids = el.children;
  for(let i=0;i<kids.length;i++) kids[i].classList.toggle("cached", S.cache && i < kids.length - 1);
  const w = $("tapeWrap");
  w.scrollLeft = w.scrollWidth; w.scrollTop = w.scrollHeight;
}
export function buildRows(){
  const n = Math.min(NROWS, S.full.length);
  S.dispIdx = Array.from({length:n}, (_,i)=>i);
  const cells = '<span class="tk"></span><span class="bar"><i></i><b></b></span>' +
                '<span class="vm"></span><span class="vk"></span><span class="vc"></span><span class="vl"></span>';
  let html = '<div class="rowhead"><span>token</span><span></span><span>model</span>' +
             '<span>after k</span><span>cml</span><span>in play</span></div>';
  for(let i=0;i<n;i++) html += '<div class="row">' + cells + '</div>';
  if(S.full.length > n) html += '<div class="row other">' + cells + '</div>';
  $("rows").innerHTML = html;
  S.rowEls = [...$("rows").querySelectorAll(".row")];
}
const SCOPE_TITLE = {
  logits:      () => "Raw logits, exactly as the model produced them",
  temperature: () => "Every logit divided by T = " + S.temp.toFixed(2),
  softmax:     () => "Softmax turns scores into probabilities",
  topk:        () => "Top-k keeps the " + S.k + " highest",
  topp:        () => "Top-p keeps the smallest set worth " + S.p.toFixed(2),
  sample:      () => "The draw"
};
export function updateRows(stage){
  if(!S.full || !S.rowEls) return;
  const idx = S.dispIdx, P = S.pipe;
  const isLog = stage === "logits" || stage === "temperature";
  /* what is actually in play at this stage: the model's own probabilities until
     top-k renormalises them, then the top-p distribution */
  const cur = i => stage === "softmax" ? P.prob[i] : stage === "topk" ? P.pk[i] : P.fin[i];
  const vals = idx.map(i => isLog ? (stage === "logits" ? S.full[i].logit : P.z[i]) : cur(i));
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  const w = v => isLog ? 0.08 + 0.92 * (v - lo) / ((hi - lo) || 1) : v / (hi || 1);
  const pct = v => (v*100).toFixed(1) + "%";
  let shown = 0, live = 0;
  idx.forEach((fi, r) => {
    const el = S.rowEls[r]; if(!el) return;
    const cut = (stage === "topk" && !P.keptK[fi]) || ((stage === "topp" || stage === "sample") && !P.keptP[fi]);
    const win = stage === "sample" && fi === S.winner;
    el.className = "row" + (cut ? " cut" : "") + (win ? " win" : "") + (!isLog && !cut && !win ? " live" : "");
    el.children[0].innerHTML = showKey(chipOf(S.full[fi].key));
    /* ghost keeps the model's own probability on the same scale, so the solid
       bar visibly grows past it the moment anything is renormalised */
    el.children[1].children[0].style.width = (isLog || !P ? 0 : Math.max(0, w(P.prob[fi])) * 100).toFixed(1) + "%";
    el.children[1].children[1].style.width = (Math.max(0, w(vals[r])) * 100).toFixed(1) + "%";
    /* each column appears at the step that creates it, so the pipeline fills in
       left to right as you walk through it */
    const seenK = !isLog && stage !== "softmax";
    el.children[2].textContent = (isLog || !P) ? "" : pct(P.prob[fi]);
    el.children[3].textContent = (seenK && P.keptK[fi]) ? pct(P.pk[fi]) : "";
    el.children[4].textContent = (seenK && isFinite(P.run[fi])) ? P.run[fi].toFixed(3) : "";
    el.children[5].textContent = cut ? "cut" : (isLog ? vals[r].toFixed(2) : pct(vals[r]));
    /* the dashed rule is literally where top-p stopped counting */
    if((stage === "topp" || stage === "sample") && fi === P.lastKept) el.classList.add("edge");
    if(P){ shown += P.prob[fi]; live += cur(fi); }
  });
  const rest = S.rowEls[idx.length];
  if(rest){
    const op = P ? Math.max(0, 1 - shown) : 0, ol = P ? Math.max(0, 1 - live) : 0;
    rest.children[0].textContent = (S.full.length - idx.length) + " others";
    rest.children[1].children[0].style.width = (P && !isLog ? (op / (hi||1) * 100).toFixed(1) : "0") + "%";
    rest.children[1].children[1].style.width = (P && !isLog ? (ol / (hi||1) * 100).toFixed(1) : "0") + "%";
    const ok = P ? Math.max(0, 1 - idx.reduce((a,i)=> a + (P.keptK[i] ? P.pk[i] : 0), 0)) : 0;
    rest.children[2].textContent = (isLog || !P) ? "" : pct(op);
    rest.children[3].textContent = (isLog || !P || stage === "softmax") ? "" : pct(ok);
    rest.children[4].textContent = "";
    rest.children[5].textContent = (isLog || !P) ? "—" : pct(ol);
  }
  $("scopeTitle").textContent = (SCOPE_TITLE[stage] || (()=>"Next-token distribution"))();
  $("scopeHint").textContent = idx.length + " drawn · top " + S.full.length + " of " + S.vocabN.toLocaleString();
}
export function renderCum(dart){
  const P = S.pipe; if(!P) return;
  let segs = "";
  for(let i=0;i<S.full.length;i++){
    if(!P.keptP[i]) continue;
    const win = dart && i === S.winner;
    segs += '<s style="width:' + (P.fin[i]*100).toFixed(3) + '%;background:' +
            (win ? "var(--flare)" : (i % 2 ? "var(--rule)" : "var(--dim)")) + '"></s>';
  }
  $("cumSeg").innerHTML = segs;
  const d = $("dart");
  d.style.left = (S.u * 100).toFixed(2) + "%";
  d.classList.toggle("on", !!dart);
  $("cumL").textContent = P.nP + " surviving tokens, laid end to end";
  $("cumR").textContent = dart ? "random draw u = " + S.u.toFixed(4) : "random draw u = —";
}
export function updateMetrics(){
  $("mStage").textContent = S.micro;
  $("mTok").textContent = S.gen;
  $("mCtx").textContent = S.tokens.length;
  $("mVocab").textContent = S.vocabN ? S.vocabN.toLocaleString() : "—";
  $("passHint").textContent = S.finished ? "loop halted" : "pass " + (S.gen + 1) + " of at most " + S.max;
}
