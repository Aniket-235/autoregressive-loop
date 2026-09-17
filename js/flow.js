/* the flow chart on the left: building the SVG once, then lighting the node
   and edge for whichever stage the loop is on */
import { $ } from "./util.js";
import { S } from "./state.js";

const BX = 130, BW = 300;
const NODES = [
  {id:"prompt", y:12,  h:46, t:"Prompt",                 s:["the text you start from"]},
  {id:"tok",    y:76,  h:46, t:"Tokenize",               s:["text into integer token ids"]},
  {id:"emb",    y:140, h:46, t:"Embed + position",       s:["ids into vectors, plus where they sit"]},
  {id:"fwd",    y:204, h:74, t:"Transformer stack",      s:["N layers of self-attention","every earlier token is read"]},
  {id:"log",    y:296, h:46, t:"Logits",                 s:["one raw score per vocabulary entry"]},
  {id:"smp",    y:360, h:74, t:"Shape the distribution", s:["temperature, then softmax","top-k, top-p, renormalise"]},
  {id:"draw",   y:452, h:46, t:"Draw one token",         s:["a die weighted by probability"]},
  {id:"app",    y:516, h:46, t:"Append to the sequence", s:["the output becomes the input"]}
];
const FEEDBACK = "M188,614 H80 Q60,614 60,594 V183 Q60,163 80,163 H122";

export function buildFlow(){
  let g = "";
  const box = (id, x, y, w, h, t, subs, cls) => {
    const tall = h > 60;
    let inner = '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10"/>';
    inner += '<text class="t" x="'+(x+w/2)+'" y="'+(y + (tall ? 27 : 22))+'" text-anchor="middle">'+t+'</text>';
    subs.forEach((s,i)=> inner += '<text class="s" x="'+(x+w/2)+'" y="'+(y + (tall ? 45 : 37) + i*14)+'" text-anchor="middle">'+s+'</text>');
    return '<g class="node '+(cls||"")+'" id="n-'+id+'">'+inner+'</g>';
  };
  NODES.forEach(n => g += box(n.id, BX, n.y, BW, n.h, n.t, n.s));
  g += '<g class="node" id="n-chk"><polygon points="280,580 372,614 280,648 188,614"/>'
     + '<text class="t" x="280" y="612" text-anchor="middle">stop?</text>'
     + '<text class="s" x="280" y="627" text-anchor="middle">eos, or budget spent</text></g>';
  g += box("done", 400, 590, 180, 48, "Done", ["nothing more runs"]);
  g += box("kv", 452, 214, 118, 54, "KV cache", ["keys + values kept"], "cache");

  const down  = (x,y) => '<polygon points="'+(x-6)+','+(y-9)+' '+(x+6)+','+(y-9)+' '+x+','+y+'"/>';
  const right = (x,y) => '<polygon points="'+(x-9)+','+(y-6)+' '+(x-9)+','+(y+6)+' '+x+','+y+'"/>';
  const lft   = (x,y) => '<polygon points="'+(x+9)+','+(y-6)+' '+(x+9)+','+(y+6)+' '+x+','+y+'"/>';
  const E = (id, d, head) => '<g class="edge" id="'+id+'"><path d="'+d+'"/>'+head+'</g>';
  g += E("e1", "M280,58 V68",   down(280,76));
  g += E("e2", "M280,122 V132", down(280,140));
  g += E("e3", "M280,186 V196", down(280,204));
  g += E("e4", "M280,278 V288", down(280,296));
  g += E("e5", "M280,342 V352", down(280,360));
  g += E("e6", "M280,434 V444", down(280,452));
  g += E("e7", "M280,498 V508", down(280,516));
  g += E("e8", "M280,562 V572", down(280,580));
  g += '<g class="edge" id="e9"><path d="M372,614 H392"/>'+right(400,614)
     + '<text x="386" y="604" text-anchor="middle">yes</text></g>';
  g += '<g class="edge fb" id="e10"><path d="'+FEEDBACK+'"/>'+right(130,163)
     + '<text x="208" y="604" text-anchor="middle">no</text>'
     + '<text x="42" y="400" text-anchor="middle" transform="rotate(-90 42 400)" style="font-size:12px">the new token joins the input</text></g>';
  g += '<g class="edge mem" id="e11"><path d="M432,235 H444"/>'+right(452,235)
     + '<path d="M450,249 H438"/>'+lft(430,249)+'</g>';
  g += '<circle class="spark" id="spark" r="6" cx="0" cy="0">'
     + '<animateMotion id="sparkMo" dur="0.95s" begin="indefinite" fill="freeze" path="'+FEEDBACK+'"/></circle>';
  document.getElementById("flow").innerHTML = g;
}

/* ---------- lighting it up ---------- */
const NODE_OF = { prompt:"prompt", tokenize:"tok", embed:"emb", forward:"fwd", logits:"log",
  temperature:"smp", softmax:"smp", topk:"smp", topp:"smp", sample:"draw", append:"app", check:"chk" };
const EDGE_OF = { tokenize:"e1", embed:"e2", forward:"e3", logits:"e4", temperature:"e5",
  sample:"e6", append:"e7", check:"e8" };
export function setActive(stage){
  document.querySelectorAll("#flow .node.on").forEach(n=>n.classList.remove("on"));
  document.querySelectorAll("#flow .edge.on").forEach(n=>n.classList.remove("on"));
  const n = $("n-" + NODE_OF[stage]); if(n) n.classList.add("on");
  const id = stage === "embed" && S.gen > 0 ? "e10" : EDGE_OF[stage];
  const e = id ? $(id) : null; if(e) e.classList.add("on");
  if(stage === "forward" && S.cache && S.gen > 0){ $("n-kv").classList.add("on"); $("e11").classList.add("on"); }
}
export function fireSpark(){
  const c = $("spark"), mo = $("sparkMo");
  $("e10").classList.add("on");
  c.classList.remove("go"); void c.getBoundingClientRect();
  c.classList.add("go");
  try{ mo.beginElement(); }catch(err){}
}
