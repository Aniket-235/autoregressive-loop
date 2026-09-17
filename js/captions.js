/* the caption under the panels: one paragraph per stage, written from the
   live numbers so it always describes exactly what is on screen */
import { $, esc } from "./util.js";
import { S, HF } from "./state.js";
import { chipOf } from "./readouts.js";

export function caption(stage){
  const n = S.tokens.length, P = S.pipe;
  const winKey = S.winner >= 0 && S.full ? chipOf(S.full[S.winner].key) : "";
  const mono = t => "<code>" + esc(t) + "</code>";
  switch(stage){
    case "prompt": return ["prompt",
      "Everything starts as plain text. Nothing has been predicted yet — this is only the seed the loop runs on."];
    case "tokenize": return ["tokenize",
      "The text is cut into <em>tokens</em>: word pieces, not letters and not whole words. " + n +
      " of them here. A leading " + mono("·") + " means the piece begins with a space, which is why " +
      mono("·the") + " and " + mono("the") + " are different tokens."];
    case "embed": return ["embed",
      (S.gen === 0 || !S.cache)
        ? "Every token id becomes a vector, and a position signal is added — attention alone has no sense of order."
        : "Only the <em>one new token</em> has to be embedded. Everything before it is already sitting in the cache."];
    case "forward": {
      const where = " on your " + (HF.dev === "webgpu" ? "GPU" : "CPU");
      return ["forward pass",
        (S.cache && S.gen > 0)
          ? "Attention reads the cached keys and values for the first " + (n-1) +
            " tokens and computes just the new one" + where + ". Same maths, a fraction of the work."
          : "Every layer looks back across all " + n + " tokens" + where +
            ". Only the vector at the <em>last</em> position matters — that is the one that predicts what comes next."];
    }
    case "logits": return ["logits",
      "The last position emits one raw score — a <em>logit</em> — for every token in the vocabulary, all " +
      S.vocabN.toLocaleString() + " of them. Only the highest " + S.full.length +
      " are worth drawing; the rest are accounted for in the last row."];
    case "temperature": return ["temperature",
      S.temp < 0.5
        ? "Dividing by a low T = " + S.temp.toFixed(2) + " <em>stretches the gaps apart</em>. The leader pulls away, and the model will mostly recite what it knows."
        : S.temp > 1.15
          ? "Dividing by a high T = " + S.temp.toFixed(2) + " <em>squeezes the scores together</em>. Weak candidates get a real chance, and the model starts to wander."
          : "Every logit is divided by the temperature, T = " + S.temp.toFixed(2) + ". Below 1 exaggerates the differences; above 1 flattens them."];
    case "softmax": return ["softmax",
      "Softmax turns scores into probabilities that add up to 1. The leader holds " +
      (P.prob[S.dispIdx[0]]*100).toFixed(1) + "% of the mass."];
    case "topk": {
      const bit = P.nK < S.full.length && P.prob[S.dispIdx[0]] < P.pk[S.dispIdx[0]] - 1e-9;
      return ["top-k",
        "Top-k throws away everything below rank " + S.k + ", however plausible the rest looked, and then " +
        "<em>renormalises what is left back to 1</em>. " +
        (bit ? "Watch <code>model</code> and <code>after k</code> come apart — the discarded mass gets shared out among the survivors. "
             : "Nothing on screen was below rank " + S.k + ", so <code>model</code> and <code>after k</code> still agree. ") +
        "The <code>cml</code> column is that running total, and it is what top-p will threshold against next." +
        (S.k >= 20 ? " Real settings are often 40 or so, which almost never bites — top-p does the cutting." : "")];
    }
    case "topp": return ["top-p",
      "Read the <code>cml</code> column down until it first reaches " + S.p.toFixed(2) + ". That token is <em>kept</em>, " +
      "and the dashed line under it is the cut — which is why the survivors add up to " +
      (P.lastKept >= 0 && isFinite(P.run[P.lastKept]) ? P.run[P.lastKept].toFixed(3) : "?") +
      " rather than exactly " + S.p.toFixed(2) + ". " + P.nP + " token" + (P.nP === 1 ? "" : "s") +
      " survive, renormalised once more into <code>in play</code>."];
    case "sample": {
      const w = P.fin[S.winner] * 100;
      return ["sample",
        "Roll " + mono("u = " + S.u.toFixed(4)) + " and walk along the mass until it lands. It chose <em>" +
        esc(winKey) + "</em>, holding " + w.toFixed(1) + "% of what was left. " +
        (w > 97 ? "Nothing else survived the mask, so there was no real choice to make here."
                : w < 15 ? "A long shot — this is where a run stops being predictable."
                : "Likely, but never certain: the same distribution can hand you a different word.")];
    }
    case "append": return ["append",
      "The chosen token is appended to the sequence. <em>This is the whole trick</em> — what the model just wrote is now part of what it reads."];
    case "check": return ["stop?",
      S.finished
        ? (S.stopWhy === "eos"
            ? "The model emitted " + mono(S.stopTok || "<eos>") + ", one of its own <em>stop tokens</em>. Nothing cut it off — it decided it was finished."
            : "The budget of " + S.max + " new tokens is spent, so the loop halts. The model itself would happily continue.")
        : "No stop token, and " + S.gen + " of " + S.max + " tokens used. Round the loop again — one whole forward pass for one more token."];
  }
  return ["", ""];
}
export function setCaption(stage){
  const [st, cx] = caption(stage);
  $("capStage").textContent = st;
  $("capText").innerHTML = cx;
}
