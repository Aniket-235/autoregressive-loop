# Autoregressive Loop

An interactive walk through how a language model writes text — one token at a time, with a real open model running in your browser.

Every large language model produces text the same way: read everything so far, score every token in the vocabulary, shape those scores into a probability distribution, draw one token, append it, and go round again. This page shows that loop happening, stage by stage, with the real numbers a real model is producing on your own GPU.

## What you need

- **A browser with WebGPU.** Chrome or Edge on any recent desktop, Safari 26 or later on macOS. Firefox has it behind a flag. Without WebGPU the page still runs on WASM, just much more slowly — the **Runs on** box in the model sheet tells you which you've got.
- **A one-time download.** The model weights (100–400 MB depending on the model) come from Hugging Face the first time you load a model, and are cached by the browser afterwards.
- **A few hundred MB of GPU memory** for the smaller models; the 0.5B model wants more.

Everything runs locally. Nothing you type leaves your machine.

## Getting started

1. Click **Model…** in the top-right corner.
2. Pick a model from the list — **SmolLM2 · 135M · instruction tuned** is the quickest to load and the fastest to run.
3. Click **Download and load** and wait for the progress bar to say *Ready*.
4. Click **Done**, type a prompt into the box at the top of the *Output* panel, and press **▶ Play**.

The loop starts turning, and every panel on the screen lights up in step with it.

## The screen

**The loop** (left) is a flow chart of the decoding loop. The lit-up node is the stage the model is on right now. Once the first token has been drawn, the long arrow on the left carries it back up to the input — the spark travelling along it is the whole idea of the page.

**Output** shows the text as it grows. Grey is your prompt, marigold is what the model has written, and the freshest token flashes as it lands. Special tokens (turn markers, end-of-text) appear in small boxes so you can see them rather than wonder where the text went.

**Token tape** shows the same sequence as the model sees it: one chip per token, numbered by position. A `·` stands in for a leading space — `·the` and `the` are different tokens with different scores. The green underline under a chip means its keys and values are sitting in the KV cache.

**Next-token distribution** is the heart of it. After each forward pass it lists the twenty most likely next tokens, and the columns fill in from left to right as the loop shapes them:

| Column | What it is |
|---|---|
| **model** | the model's own probability for this token, straight from the softmax |
| **after k** | the same, renormalised after top-k has thrown the tail away |
| **cml** | the running total top-p reads down until it reaches the threshold |
| **in play** | what's actually left to draw from, once everything has been cut and renormalised |

Struck-through rows have been cut. The dashed line is where top-p stopped counting. The bar underneath lays the surviving tokens end to end by probability, and the dart above it marks the random number that picked the winner.

**The caption** along the bottom describes the current stage in plain English, using the actual numbers on screen.

## Controls

| Control | What it does |
|---|---|
| **▶ Play** / **Pause** | run the loop continuously (`space`) |
| **Step** | advance one micro-step — one node of the flow chart (`→`) |
| **Whole token** | run through to the end of the current pass (`↵`) |
| **Reset** | start over from the prompt (`R`) |
| **Pace** | how long each stage lingers: Teaching, Steady, Brisk, or Full speed |
| **Temp** | temperature, 0.05–2. Below 1 sharpens the distribution; above 1 flattens it |
| **Top-k** | keep only the *k* highest-scoring tokens, 1–60 |
| **Top-p** | keep the smallest set of tokens whose probability adds up to *p*, 0.05–1 |
| **Max new** | stop after this many generated tokens, 4–500 |
| **Seed** | the random number generator's seed. Same seed, same prompt, same settings → same text |
| **KV cache** | when on, the model reuses the attention it has already computed and only processes the new token each pass; when off, it recomputes everything |

The sliders work mid-pass: nudge **Temp**, **Top-k** or **Top-p** while the distribution is on screen and the table re-shapes live.

Press **1** – **4** to expand a panel to the full window, and **Esc** to put it back. **Daylight** / **Studio dark** switches the theme.

## The model sheet

- **Model** — six ready-made choices. The *instruction tuned* ones answer a question; the *base* ones (SmolLM 1, GPT-2) just carry on writing whatever you started.
- **Hugging Face repository** — edit this to load any other repository that has ONNX weights, in the form `owner/name`.
- **Weights** — the quantisation. `q4f16` is the smallest and quickest to download; `fp32` is the largest and most exact. If the format you ask for isn't on the repository, the page falls back through q4 → q8 → fp32.
- **Wrap the prompt in this model's chat template** — for instruction-tuned models. On, your prompt becomes a user turn and the model writes its reply; off, it's plain text the model continues. Base models have no template and the switch is disabled.
- **Stops at** — the model's own end-of-sequence tokens. When it draws one of these, the loop halts on its own.

## Things to try

- **Temperature at 0.05 versus 2.** Low, and the model recites the same thing every time; high, and it wanders into nonsense. Watch the *model* column stretch apart and squash together.
- **Top-k at 1.** Now there is never a choice — the seed makes no difference. This is greedy decoding.
- **Top-p at 0.05 versus 1.** At 1 the tail of unlikely tokens is never cut; at 0.05 only the leader survives.
- **The same seed twice.** Reset and play again with everything unchanged — the text comes out identical. Change the seed by one and see where the runs diverge.
- **KV cache off.** Look at the caption on the forward-pass stage: every token is recomputed each pass instead of just the new one. This is why real inference servers are so careful about their cache.
- **Chat template on and off** with an instruction-tuned model and a question as the prompt. With it on, the model answers; with it off, it's likely to keep writing the question.
- **Step through one pass with the pace on Teaching**, reading the caption at each stage. It is a complete explanation of sampling in about a dozen sentences.

## Trouble

- **"Runs on: WASM — no WebGPU here."** Your browser isn't exposing WebGPU. Try Chrome or Edge, or check `chrome://gpu` for whether WebGPU is enabled.
- **"The browser refused the download."** The page is being served from somewhere that blocks requests to Hugging Face. Serve it from a plain static host, or locally.
- **"That repository has no ONNX weights in the format asked for."** Not every Hugging Face repository has been converted to ONNX. Try one of the built-in choices, or look for the same model under the `onnx-community` or `Xenova` accounts.
- **"The GPU ran out of memory."** Pick a smaller model or the `q4` weights, and close other tabs that are using the GPU.
- **A blank page when opened from disk.** The page is built from JavaScript modules, which browsers won't load from `file://`. Serve the folder instead — from the project directory, `python3 -m http.server 8765` and open `http://localhost:8765`.

## Under the hood

The model runs through [transformers.js](https://github.com/huggingface/transformers.js), Hugging Face's port of the Transformers library to the browser, with ONNX Runtime on WebGPU underneath. The page pulls the full set of logits after each forward pass and does the temperature, softmax, top-k and top-p arithmetic itself, so what the table shows is exactly what a real sampler computes — including the renormalisation steps that make the percentages jump when a cut bites.

The source is a plain static site — one HTML file, a handful of stylesheets, and JavaScript modules — with no build step.
