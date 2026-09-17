/* the two mutable singletons every module reads: the loop's state and the
   model's handles. nothing here is a function — mutate in place */
import { mulberry32 } from "./util.js";

export const S = {
  /* the sequence so far and where the stage machine is within it */
  tokens:[], promptLen:0, gen:0, stages:[], si:0, micro:0,
  playing:false, timer:null, busy:false, finished:false,
  /* the current forward pass: candidates, every logit, shaped distribution, the draw */
  full:null, allLogits:null, vocabN:0, pipe:null, disp:[], winner:-1, u:0, stopWhy:"",
  /* the knobs on the control bar */
  temp:0.8, k:8, p:0.92, max:500, seed:7, cache:true, dwell:620,
  rng:mulberry32(7)
};

/* the open model running in this tab, once one is loaded */
export const HF = { lib:null, model:null, tok:null, id:"", dtype:"", dev:"", cache:null, cacheLen:0,
             eos:new Set(), vocab:0, grab:null, dec:new Map(), last:null, loading:false,
             tmpl:false, chat:false, special:new Set() };
