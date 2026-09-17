/* the model, running in this tab through transformers.js on WebGPU (or WASM
   when there is no GPU): loading it, cutting the prompt into its tokens, and
   one forward pass that hands back the logits over the whole vocabulary */
import { $ } from "./util.js";
import { S, HF } from "./state.js";

/* the /+esm build is the one that comes with its onnxruntime dependency resolved;
   dist/transformers.web.js leaves a bare "onnxruntime-web/webgpu" import behind */
const HF_LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm";
/* apply_chat_template and the tokenizer can hand back a tensor, a nested array
   or a flat one depending on the options; take ids out of any of them */
function idsFrom(x){
  if(!x) return [];
  if(x.data) return Array.from(x.data).map(Number);
  if(Array.isArray(x) && Array.isArray(x[0])) return x[0].map(Number);
  return Array.from(x).map(Number);
}
export const hfSpecial = id => HF.special.has(id) ||
  (HF.special.size === 0 && /^<[^\s>]*>$|^<\|[^\s|]*\|>$/.test(hfDecode(id)));

function prog(msg, pct, cls){
  const t = $("progText");
  t.textContent = msg; t.className = "pnote" + (cls ? " " + cls : "");
  const bar = $("prog");
  if(pct === null || pct === undefined) bar.hidden = true;
  else { bar.hidden = false; $("progBar").style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + "%"; }
}
export async function pickDevice(){
  if(!navigator.gpu) return "wasm";
  try{ return (await navigator.gpu.requestAdapter()) ? "webgpu" : "wasm"; }catch(e){ return "wasm"; }
}
export function hfMessage(err){
  const m = (err && err.message) || String(err);
  if(/Failed to fetch|NetworkError|Content Security|blocked|CORS/i.test(m))
    return "The browser refused the download. Wherever this page is hosted is not allowed to reach Hugging Face — serve it from a plain static host, or locally.";
  if(/404|Could not locate|no such file|Unauthorized|401/i.test(m))
    return "That repository has no ONNX weights in the format asked for. Try another weight format, or another repository.";
  if(/out of memory|OOM|allocat/i.test(m))
    return "The GPU ran out of memory. Try a smaller model, or the q4 weights.";
  return m.slice(0, 240);
}
/* resolves true once the model is ready to score and the caller can reset the
   loop onto it. false means the note under the progress bar says what went wrong */
export async function hfLoad(id, dtype){
  if(HF.loading || !id) return false;
  HF.loading = true; $("loadBtn").disabled = true;
  try{
    if(!HF.lib){
      prog("Fetching the transformers.js runtime…", 2);
      HF.lib = await import(HF_LIB);
      HF.lib.env.allowLocalModels = false;
      class Grab extends HF.lib.LogitsProcessor {
        _call(ids, logits){ HF.last = logits.data.slice(); return logits; }
      }
      HF.grab = new Grab();
    }
    const T = HF.lib;
    HF.dev = await pickDevice();
    $("hfDev").textContent = HF.dev === "webgpu" ? "WebGPU" : "WASM — no WebGPU here";

    const files = new Map();
    const onProgress = d => {
      if(d.status === "progress" && d.total){
        files.set(d.file, [d.loaded, d.total]);
        let l = 0, t = 0; files.forEach(v => { l += v[0]; t += v[1]; });
        prog("Downloading " + id + " — " + (l/1048576).toFixed(0) + " of " + (t/1048576).toFixed(0) + " MB", 100*l/t);
      } else if(d.status === "initiate"){ prog("Fetching " + d.file + " …", 1); }
    };
    prog("Reading the tokenizer…", 1);
    HF.tok = await T.AutoTokenizer.from_pretrained(id, { progress_callback:onProgress });

    const chain = [dtype, "q4", "q8", "fp32"].filter((v,i,a)=> a.indexOf(v) === i);
    let used = null, lastErr = null;
    for(const dt of chain){
      try{
        files.clear();
        prog("Loading the " + dt + " weights on " + HF.dev + " …", 2);
        HF.model = await T.AutoModelForCausalLM.from_pretrained(id, { device:HF.dev, dtype:dt, progress_callback:onProgress });
        used = dt; break;
      }catch(err){ lastErr = err; }
    }
    if(!used) throw lastErr || new Error("none of the weight formats on that repository would load");

    HF.id = id; HF.dtype = used; HF.eos = new Set();
    /* an instruction-tuned model carries its turn terminator in generation_config;
       a base model has none there and falls back to the tokenizer's eos */
    const gc = HF.model.generation_config || {};
    [].concat(gc.eos_token_id ?? [], HF.tok.eos_token_id ?? [])
      .forEach(v => { if(v !== null && v !== undefined) HF.eos.add(Number(v)); });
    HF.special = new Set((HF.tok.all_special_ids || []).map(Number));
    HF.eos.forEach(v => HF.special.add(v));
    HF.tmpl = !!HF.tok.chat_template;
    HF.chat = HF.tmpl;
    HF.dec.clear(); await dropCache(HF.cache); HF.cache = null; HF.cacheLen = 0;
    HF.vocab = (HF.model.config && HF.model.config.vocab_size) || 0;
    prog("Ready — " + id.split("/").pop() + " · " + used + " · " + HF.dev +
         (HF.vocab ? " · vocabulary " + HF.vocab.toLocaleString() : ""), null, "ok");
    return true;
  }catch(err){
    prog(hfMessage(err), null, "err");
    return false;
  }finally{ HF.loading = false; $("loadBtn").disabled = false; }
}
export const hfDecode = id => {
  if(HF.dec.has(id)) return HF.dec.get(id);
  let s;
  try{ s = HF.tok.decode([id], { skip_special_tokens:false, clean_up_tokenization_spaces:false }); }
  catch(e){ s = "[" + id + "]"; }
  HF.dec.set(id, s); return s;
};
/* the highest N of a whole vocabulary, without sorting a quarter of a million floats */
function topOf(arr, N){
  const best = []; let worst = -Infinity;
  for(let i=0;i<arr.length;i++){
    const v = arr[i];
    if(best.length === N && v <= worst) continue;
    let lo = 0, hi = best.length;
    while(lo < hi){ const mid = (lo + hi) >> 1; if(best[mid].logit < v) hi = mid; else lo = mid + 1; }
    best.splice(lo, 0, { id:i, logit:v });
    if(best.length > N) best.pop();
    worst = best[best.length-1].logit;
  }
  return best;
}
export async function dropCache(c){ try{ if(c && c.dispose) await c.dispose(); }catch(e){} }
export async function hfScores(){
  if(!HF.model) throw new Error("No model is loaded yet. Open Model… and load one.");
  const T = HF.lib, ids = S.tokens.map(t => t.id), n = ids.length;
  const i64 = a => new T.Tensor("int64", BigInt64Array.from(a.map(v => BigInt(v))), [1, a.length]);
  const opts = { input_ids:i64(ids), attention_mask:i64(new Array(n).fill(1)),
                 max_new_tokens:1, do_sample:false, return_dict_in_generate:true,
                 logits_processor:[HF.grab] };
  /* the cache is only usable if it covers exactly everything but the newest token */
  if(S.cache && HF.cache && HF.cacheLen === n - 1) opts.past_key_values = HF.cache;
  else if(HF.cache){ await dropCache(HF.cache); HF.cache = null; HF.cacheLen = 0; }
  HF.last = null;
  const out = await HF.model.generate(opts);
  if(S.cache){ HF.cache = out.past_key_values; HF.cacheLen = n; }
  else { await dropCache(out.past_key_values); HF.cache = null; HF.cacheLen = 0; }
  if(!HF.last) throw new Error("The model ran but handed back no logits.");
  S.allLogits = HF.last; S.vocabN = HF.last.length;
  return topOf(HF.last, 64).map(c => ({ id:c.id, logit:c.logit, key:hfDecode(c.id) }));
}

export const mkToken = (key, gen, id) => ({ key, gen, id });
export function promptTokens(text){
  if(!HF.tok) throw new Error("No model is loaded yet. Open Model… and load one.");
  let ids;
  if(HF.chat && HF.tmpl){
    /* the template adds the turn markers and the opening of the model's own
       turn, which is what makes an instruction-tuned model answer rather
       than carry on writing the question */
    ids = idsFrom(HF.tok.apply_chat_template([{ role:"user", content:text }],
      { tokenize:true, return_dict:false, return_tensor:false, add_generation_prompt:true }));
  } else {
    ids = idsFrom(HF.tok(text).input_ids);
  }
  return ids.map(id => mkToken(hfDecode(id), false, id));
}
