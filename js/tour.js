/* a guided tour for first-time visitors: a spotlight on each part of the page
   and a card beside it saying what that part is for. runs once on the first
   visit, and again from the Tour button in the header */
import { $ } from "./util.js";
import { HF } from "./state.js";
import { setZoom } from "./ui.js";

const SEEN = "autoregressive-loop:tour-seen";

/* sel is a CSS selector; several matches are framed together. no sel = a
   centred card with everything dimmed */
const STEPS = [
  { title:"How a language model writes",
    text: () => "One token at a time — and every token it writes is fed straight back in as input for the next. " +
      "This page shows that loop turning, with the real numbers from a real model on your GPU. " +
      "<em>" + (STEPS.length - 1) + " quick stops</em>, or press <code>Esc</code> to skip." },
  { sel:"#p-loop", title:"The loop",
    text:"This flow chart is the whole algorithm. Each node lights up as the model reaches it, and the long arrow on the left " +
      "carries the new token back to the top — that feedback is what <em>autoregressive</em> means. " +
      "The button in any panel's corner, or keys <code>1</code>–<code>4</code>, expands it to the whole window." },
  { sel:"#p-out", title:"Output",
    text:"Type your prompt here. Grey is what you wrote, marigold is what the model wrote, and special tokens such as " +
      "turn markers show up in small boxes rather than vanishing. <code>↵</code> in the box starts over." },
  { sel:"#p-tape", title:"Token tape",
    text:"The same text as the model sees it: one chip per token, numbered by position. A leading <code>·</code> stands in " +
      "for a space — <code>·the</code> and <code>the</code> are different tokens. An underline means that token is already " +
      "sitting in the KV cache." },
  { sel:"#p-draw", title:"Next-token distribution",
    text:"After every forward pass: the twenty most likely next tokens and what the sampler does to them. The columns fill in " +
      "as the loop shapes the scores — the model's own probability, then after top-k, the running total top-p reads, and " +
      "what is left <em>in play</em>. The bar at the bottom is where the random draw lands." },
  { sel:".caption", title:"The caption",
    text:"Every stage explains itself here in plain words, using the actual numbers on screen. When something above looks " +
      "odd, read this first." },
  { sel:"#playBtn, #stepBtn, #tokBtn, #resetBtn", title:"Driving the loop",
    text:"<em>Play</em> runs continuously. <em>Step</em> moves one node of the chart at a time. <em>Whole token</em> runs one " +
      "full pass. Keys: <code>space</code>, <code>→</code>, <code>↵</code>, and <code>R</code> to reset. " +
      "<em>Pace</em> sets how long each stage lingers." },
  { sel:".grp:has(#tempR), .grp:has(#kR), .grp:has(#pR)", title:"Shaping the draw",
    text:"Temperature stretches or squeezes the scores; top-k and top-p cut the tail. Move them while a distribution is on " +
      "screen and the table re-shapes live. Try <code>T = 0.05</code>, then <code>2</code>." },
  { sel:".grp:has(#seedI), .sw", title:"Seed and cache",
    text:"The seed fixes the random draws — same seed, same settings, same text every time. The KV cache switch controls " +
      "the model's real cache: switch it off and every pass recomputes everything from scratch." },
  { sel:"#modelBtn", title:"Load a model to begin",
    text:"Nothing runs until a model is loaded. Open <em>Model…</em>, pick one — SmolLM2 135M is the quickest — and click " +
      "<em>Download and load</em>. Weights download once from Hugging Face and run on your GPU from then on." }
];

const T = { i:0, on:false };
let root, hole, card;

function build(){
  root = document.createElement("div");
  root.className = "tour"; root.hidden = true;
  root.innerHTML =
    '<div class="tour-hole"></div>' +
    '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle">' +
      '<h3 id="tourTitle"></h3><p id="tourText"></p>' +
      '<div class="tour-foot"><span class="n" id="tourN"></span>' +
        '<button class="btn" id="tourSkip">Skip</button>' +
        '<button class="btn" id="tourBack">Back</button>' +
        '<button class="btn primary" id="tourNext">Next</button>' +
    '</div></div>';
  document.body.appendChild(root);
  hole = root.firstChild; card = root.lastChild;
  $("tourSkip").onclick = end;
  $("tourBack").onclick = () => show(T.i - 1);
  $("tourNext").onclick = next;
  window.addEventListener("resize", () => { if(T.on) place(STEPS[T.i]); });
  /* capture phase, so the page's own shortcuts never see a key while the tour is up */
  document.addEventListener("keydown", onKey, true);
}

/* one rectangle around every element the selector matches, padded a little */
function rectOf(sel){
  const els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null);
  if(!els.length) return null;
  els[0].scrollIntoView({ block:"nearest", inline:"nearest" });
  let t = Infinity, l = Infinity, b = -Infinity, r = -Infinity;
  for(const e of els){
    const q = e.getBoundingClientRect();
    t = Math.min(t, q.top); l = Math.min(l, q.left); b = Math.max(b, q.bottom); r = Math.max(r, q.right);
  }
  const P = 6;
  return { top:t - P, left:l - P, bottom:b + P, right:r + P, width:r - l + 2*P, height:b - t + 2*P };
}

/* the spotlight goes over the target; the card goes on whichever side has room,
   trying below, above, right, left in that order, and never leaves the viewport */
function place(step){
  const vw = innerWidth, vh = innerHeight, M = 12, GAP = 14;
  const r = step.sel ? rectOf(step.sel) : null;
  hole.classList.toggle("none", !r);
  if(r) Object.assign(hole.style, { top:r.top + "px", left:r.left + "px", width:r.width + "px", height:r.height + "px" });
  const cw = card.offsetWidth, ch = card.offsetHeight;
  let top, left;
  if(!r){ top = (vh - ch) / 2; left = (vw - cw) / 2; }
  else {
    const cx = r.left + r.width / 2 - cw / 2, cy = r.top + r.height / 2 - ch / 2;
    if(r.bottom + GAP + ch <= vh - M)      { top = r.bottom + GAP;   left = cx; }
    else if(r.top - GAP - ch >= M)         { top = r.top - GAP - ch; left = cx; }
    else if(r.right + GAP + cw <= vw - M)  { top = cy; left = r.right + GAP; }
    else if(r.left - GAP - cw >= M)        { top = cy; left = r.left - GAP - cw; }
    else                                   { top = vh - ch - M; left = (vw - cw) / 2; }
  }
  card.style.top  = Math.max(M, Math.min(vh - ch - M, top))  + "px";
  card.style.left = Math.max(M, Math.min(vw - cw - M, left)) + "px";
}

function show(i){
  T.i = Math.max(0, Math.min(STEPS.length - 1, i));
  const s = STEPS[T.i], last = T.i === STEPS.length - 1;
  $("tourTitle").textContent = s.title;
  $("tourText").innerHTML = typeof s.text === "function" ? s.text() : s.text;
  $("tourN").textContent = (T.i + 1) + " / " + STEPS.length;
  $("tourBack").disabled = T.i === 0;
  $("tourSkip").hidden = last;
  $("tourNext").textContent = last ? (HF.model ? "Finish" : "Open Model…") : "Next";
  place(s);
  $("tourNext").focus();
}
function next(){
  if(T.i < STEPS.length - 1){ show(T.i + 1); return; }
  const open = !HF.model;
  end();
  if(open) $("modelBtn").click();
}
function end(){
  root.hidden = true; T.on = false;
  try{ localStorage.setItem(SEEN, "1"); }catch(e){}
  $("tourBtn").focus();
}
function onKey(e){
  if(!T.on) return;
  e.stopPropagation();
  if(e.key === "ArrowRight"){ e.preventDefault(); next(); }
  else if(e.key === "ArrowLeft"){ e.preventDefault(); show(T.i - 1); }
  else if(e.key === "Escape"){ e.preventDefault(); end(); }
  else if(e.key === "Tab"){
    /* keep focus inside the card */
    const f = [...card.querySelectorAll("button:not([hidden]):not(:disabled)")];
    const at = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
}

export function startTour(){
  if(!root) build();
  setZoom(null);
  $("sheet").hidden = true;
  root.hidden = false; T.on = true;
  show(0);
}

/* the Tour button replays it; the first visit gets it unasked, once the fonts
   and layout have had a moment to settle */
export function initTour(){
  $("tourBtn").onclick = startTour;
  let seen = false;
  try{ seen = !!localStorage.getItem(SEEN); }catch(e){}
  if(!seen) setTimeout(startTour, 600);
}
