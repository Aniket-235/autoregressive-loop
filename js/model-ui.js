/* reflecting the loaded model across the page: the tag in the header, the
   stop-token hints, and the chat-template switch in the sheet */
import { $ } from "./util.js";
import { HF } from "./state.js";
import { hfDecode } from "./hf.js";

function stopHint(){
  const h = $("tapeHint");
  let t = "· marks a leading space";
  if(HF.model && HF.eos.size)
    t += " · stops at " + [...HF.eos].map(id => hfDecode(id) + " " + id).join(", ");
  h.textContent = t; h.title = t;
}

/* the prompt the box starts with: a question for a model that will answer,
   an opening to continue for one that will not */
const PROMPT = { chat:"What is a transformer? Explain very briefly.", plain:"A transformer is" };

export function syncChatUI(){
  const row = $("chatRow"), box = $("chatChk");
  box.disabled = !HF.tmpl;
  box.checked = HF.chat && HF.tmpl;
  row.classList.toggle("off", !HF.tmpl);
  $("chatLabel").textContent = HF.tmpl
    ? "Wrap the prompt in this model's chat template"
    : "This model has no chat template — it only continues text";
  const line = $("stopLine");
  if(HF.model && HF.eos.size){
    line.className = "pnote ok";
    line.textContent = "Stops at " + [...HF.eos].map(id => hfDecode(id) + "  id " + id).join("   ");
  } else { line.className = "pnote"; line.textContent = ""; }
  /* follow the switch only while the box still holds a default, so a prompt
     you typed survives flipping the template on and off to compare */
  const p = $("promptIn"), cur = p.value.trim();
  if(!cur || cur === PROMPT.chat || cur === PROMPT.plain) p.value = HF.chat && HF.tmpl ? PROMPT.chat : PROMPT.plain;
  stopHint();
}

export function syncModelUI(){
  $("modelTag").textContent = HF.id
    ? HF.id.split("/").pop() + " · " + HF.dev + " · " + HF.dtype
    : "no model loaded yet";
  stopHint();
}
