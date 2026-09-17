/* the maths that turns raw logits into the distribution the draw is made from:
   temperature, softmax, top-k, top-p, each renormalising as a real decoder does */
import { S } from "./state.js";

export function pipeline(){
  const n = S.full.length, z = new Array(n), prob = new Array(n);
  /* only the top few are drawn, but the softmax must be normalised over
     every last one of the model's tokens or the percentages would lie */
  const A = S.allLogits;
  let hi = -Infinity;
  for(let i=0;i<A.length;i++) if(A[i] > hi) hi = A[i];
  const zm = hi / S.temp;
  let tot = 0;
  for(let i=0;i<A.length;i++) tot += Math.exp(A[i]/S.temp - zm);
  for(let i=0;i<n;i++){ z[i] = S.full[i].logit / S.temp; prob[i] = Math.exp(z[i] - zm) / tot; }
  /* top-k first, and it renormalises: the survivors are re-softmaxed so they
     add to 1 again. top-p then walks down THAT distribution, not the model's
     original one — which is what a real implementation does, and why the
     percentages jump the moment top-k bites. */
  const keptK = [];
  let sk = 0;
  for(let i=0;i<n;i++){ const inK = i < S.k; keptK.push(inK); if(inK) sk += prob[i]; }
  const pk = prob.map((v,i)=> keptK[i] ? v/sk : 0);

  /* top-p keeps the smallest set whose running total first reaches p. the token
     that crosses the line is kept, which is why the survivors usually add up to
     a little more than p rather than exactly p. */
  const keptP = [], run = new Array(n).fill(NaN);
  let cum = 0, lastKept = -1;
  for(let i=0;i<n;i++){
    if(!keptK[i]){ keptP.push(false); continue; }
    const take = cum < S.p;
    cum += pk[i];
    run[i] = cum;
    keptP.push(take);
    if(take) lastKept = i;
  }
  let sp = 0; for(let i=0;i<n;i++) if(keptP[i]) sp += pk[i];
  const fin = pk.map((v,i)=> keptP[i] ? v/sp : 0);
  return { z, prob, pk, run, lastKept, keptK, keptP, fin, cum,
           nK: Math.min(S.k, n), nP: keptP.reduce((a,b)=>a+(b?1:0),0) };
}
