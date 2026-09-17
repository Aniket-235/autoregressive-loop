/* ============================================================
   Autoregressive Loop - an instrument for explaining decoding
   ============================================================
   the entry point: draw the chart, wire the controls, and reset into the
   first pass. everything else lives in the module named for it:

     util.js       $, escaping, the seeded PRNG
     state.js      S (the loop) and HF (the model), mutated everywhere
     hf.js         the model: loading, tokenizing the prompt, one forward pass
     pipeline.js   temperature → softmax → top-k → top-p
     flow.js       the SVG flow chart and its highlighting
     readouts.js   text, tape, candidate rows, cumulative bar, metrics
     model-ui.js   the header tag, stop hints, chat-template switch
     captions.js   the running caption for each stage
     loop.js       the stage machine: advance, play, reset
     ui.js         control wiring, pop-out zoom, the model sheet
*/
import { buildFlow } from "./flow.js";
import { syncChatUI, syncModelUI } from "./model-ui.js";
import { reset } from "./loop.js";
import { wire } from "./ui.js";

buildFlow();
wire();
syncChatUI();
syncModelUI();
reset();
