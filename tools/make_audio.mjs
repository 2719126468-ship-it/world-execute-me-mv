#!/usr/bin/env node
/**
 * tools/make_audio.mjs
 * ---------------------------------------------------------------------------
 * Deterministic placeholder soundtrack for the 130 BPM "world.execute(me);" MV.
 *
 *   node tools/make_audio.mjs     ->  audio/track.wav
 *
 * 44.1 kHz / 16-bit PCM / mono / 212.0 s. Zero dependencies (node:fs only),
 * no samples, no network. Every voice is synthesised from oscillators and
 * envelopes; all randomness comes from a seeded PRNG so two runs are bit
 * identical. Goals:
 *   - grid: 130 BPM, beat = 0.4615384615 s, beat 0 at 0.344 s, 4/4
 *   - arrangement with real dynamics (section RMS spread), no clipping
 *   - beat / accent transients loud enough for tools/check_sync.py onsets
 *   - vocal formant "hum" track with energy concentrated 300-3400 Hz
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WAV_PATH = path.join(ROOT, 'audio', 'track.wav');

/* ------------------------------------------------------------------ timing */

const SR = 44100;
const DUR = 212.0;
const NS = Math.round(SR * DUR); // 9 349 200 samples
const BPM = 130;
const BEAT = 60 / BPM; // 0.46153846153846156
const BAR = BEAT * 4; // 1.8461538461538463
const T0 = 0.344; // song time of beat 0
const TAU = Math.PI * 2;

const tBeat = (b) => T0 + b * BEAT;
const tBar = (k) => T0 + k * BAR;
const barOfBeat = (b) => Math.floor(b / 4);
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-12));

/* --------------------------------------------------------- fast sine table */

const TS = 8192;
const SIN = new Float32Array(TS + 1);
for (let i = 0; i <= TS; i++) SIN[i] = Math.sin((TAU * i) / TS);

function sin01(p) {
  if (p >= 1 || p < 0) p -= Math.floor(p);
  const q = p * TS;
  let i = q | 0;
  if (i > TS - 1) i = TS - 1;
  const f = q - i;
  return SIN[i] + (SIN[i + 1] - SIN[i]) * f;
}

/* -------------------------------------------------------------------- prng */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x5eed1305);

/* ---------------------------------------------------------------- sections */

const SEC = [
  ['intro', 0.0, 15.0],
  ['build', 15.0, 59.42],
  ['chorus1', 59.42, 74.19],
  ['verse2', 74.19, 88.96],
  ['pre2', 88.96, 103.73],
  ['chorus2', 103.73, 125.65],
  ['error', 125.65, 148.04],
  ['twelve', 148.04, 159.11],
  ['count', 159.11, 161.88],
  ['lasthit', 161.88, 162.81],
  ['final', 162.81, 192.34],
  ['outro', 192.34, 211.96],
  ['end', 211.96, 212.0],
];

function sectionAt(t) {
  for (let i = 0; i < SEC.length; i++) if (t >= SEC[i][1] && t < SEC[i][2]) return SEC[i][0];
  return 'end';
}

/* ---------------------------------------------------------------- harmony */

// A minor, two bars per chord: Am - F - C - G
const CHORDS = ['Am', 'F', 'C', 'G'];
const VOICE = {
  Am: { root: 55.0, pad: [220.0, 261.63, 329.63] }, // A3 C4 E4
  F: { root: 43.65, pad: [174.61, 220.0, 261.63] }, // F3 A3 C4
  C: { root: 65.41, pad: [261.63, 329.63, 392.0] }, // C4 E4 G4
  G: { root: 49.0, pad: [196.0, 246.94, 293.66] }, // G3 B3 D4
};
const chordOfBar = (k) => CHORDS[Math.floor(k / 2) % 4];
// A minor pentatonic: A C D E G (no F, so the arp stays key-safe over every chord)
const ARP = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
const LEAD = [440.0, 523.25, 587.33, 659.25, 587.33, 523.25, 440.0, 659.25];

/* ------------------------------------------------------------ event tables */

const EV = {
  kick: [],
  snare: [],
  hat: [],
  stab: [],
  blip: [],
  rev: [],
  riser: [],
  impact: [],
  dive: [],
  bass: [],
  pad: [],
  arp: [],
  lead: [],
  vox: [],
};

function beatsIn(t0, t1) {
  const res = [];
  let b = Math.ceil((t0 - T0) / BEAT - 1e-9);
  for (;; b++) {
    const t = tBeat(b);
    if (t >= t1 - 1e-9) break;
    if (t >= t0 - 1e-9) res.push({ b, t });
  }
  return res;
}

/* ------------------------------------------------------------ arrangement  */

function arrange() {
  /* ---- 0 - 15 s : intro. pad + sparse kick only ------------------------ */
  for (const { b, t } of beatsIn(0, 15)) {
    const bi = b % 4;
    const k = barOfBeat(b);
    if (bi === 0) EV.kick.push({ t, amp: 0.58, dur: 0.38, dec: 0.12, click: 0.10 });
    else if (bi === 2 && k % 2 === 1) EV.kick.push({ t, amp: 0.24, dur: 0.22, dec: 0.05, f0: 92, click: 0.05 });
  }

  /* ---- 15 - 59.42 s : build. four on the floor, snare 2/4, hats 8ths --- */
  for (const { b, t } of beatsIn(15, 59.42)) {
    const bi = b % 4;
    const root = VOICE[chordOfBar(barOfBeat(b))].root;
    EV.kick.push({ t, amp: bi === 0 ? 0.88 : 0.72 });
    EV.hat.push({ t, amp: bi % 2 === 0 ? 0.30 : 0.21, open: false });
    EV.hat.push({ t: t + BEAT * 0.5, amp: bi % 2 === 0 ? 0.24 : 0.16, open: false });
    if (bi === 1 || bi === 3) EV.snare.push({ t, amp: 0.62 });
    EV.bass.push({ t, freq: root, dur: BEAT * 0.82, amp: 0.58, cut: 0.10 });
  }

  /* ---- 59.42 - 74.19 s : chorus 1. full kit, open hat, octave bass ----- */
  for (const { b, t } of beatsIn(59.42, 74.19)) {
    const bi = b % 4;
    const root = VOICE[chordOfBar(barOfBeat(b))].root;
    EV.kick.push({ t, amp: 0.96 });
    if (bi === 0) EV.kick.push({ t: t + BEAT * 0.5, amp: 0.22, dur: 0.22, dec: 0.05 });
    EV.hat.push({ t, amp: bi % 2 ? 0.16 : 0.24, open: false });
    EV.hat.push({ t: t + BEAT * 0.5, amp: 0.27, open: true });
    if (bi === 1 || bi === 3) EV.snare.push({ t, amp: 0.68 });
    if (bi === 3) EV.snare.push({ t: t + BEAT * 0.75, amp: 0.22 });
    EV.bass.push({
      t,
      freq: bi % 2 === 0 ? root : root * 2,
      dur: BEAT * 0.45,
      amp: 0.72,
      cut: 0.14,
    });
    for (let s = 0; s < 4; s++)
      EV.arp.push({ t: t + s * BEAT * 0.25, freq: ARP[(b * 4 + s) % ARP.length], dur: 0.11, amp: 0.24 });
  }

  /* ---- 74.19 - 88.96 s : verse 2. half the kicks, simple bass ---------- */
  for (const { b, t } of beatsIn(74.19, 88.96)) {
    const bi = b % 4;
    const root = VOICE[chordOfBar(barOfBeat(b))].root;
    if (bi === 0 || bi === 2) EV.kick.push({ t, amp: 0.84 });
    if (bi === 0) EV.kick.push({ t: t + BEAT * 0.75, amp: 0.18, dur: 0.2, dec: 0.045, f0: 100 });
    EV.hat.push({ t, amp: bi % 2 ? 0.17 : 0.25, open: false });
    EV.hat.push({ t: t + BEAT * 0.5, amp: 0.14, open: false });
    if (bi === 1 || bi === 3) EV.snare.push({ t, amp: 0.60 });
    if (bi === 0 || bi === 2) EV.bass.push({ t, freq: root, dur: BEAT * 1.8, amp: 0.56, cut: 0.09 });
  }

  /* ---- 88.96 - 103.73 s : pre-chorus 2. ten isolated hits, no pulse ---- */
  const PRE_HITS = [91.05, 91.98, 94.93, 95.63, 96.31, 97.5, 97.97, 99.35, 100.04, 100.28];
  for (const h of PRE_HITS) {
    const short = h > 99.9; // the last two are only 0.24 s apart
    EV.kick.push({
      t: h,
      amp: short ? 0.78 : 1.0,
      dur: short ? 0.15 : 0.34,
      dec: short ? 0.045 : 0.10,
      click: short ? 0.10 : 0.20,
    });
    EV.impact.push({ t: h, dur: short ? 0.13 : 0.55, amp: short ? 0.38 : 0.62 });
  }
  // 100.5 - 103.2 : no drums at all, only the light pad (handled by pad pass)
  EV.riser.push({ t: 103.26, dur: 0.5, amp: 0.60 }); // -> lands on 103.73 downbeat

  /* ---- 103.73 - 125.65 s : chorus 2 ----------------------------------- */
  for (const { b, t } of beatsIn(103.73, 125.65)) {
    const bi = b % 4;
    const root = VOICE[chordOfBar(barOfBeat(b))].root;
    EV.kick.push({ t, amp: 0.98 });
    EV.kick.push({ t: t + BEAT * 0.75, amp: 0.20, dur: 0.2, dec: 0.045, f0: 100 });
    EV.hat.push({ t, amp: bi % 2 ? 0.17 : 0.26, open: false });
    EV.hat.push({ t: t + BEAT * 0.5, amp: 0.25, open: true });
    if (bi === 1 || bi === 3) EV.snare.push({ t, amp: 0.70 });
    if (bi === 3) EV.snare.push({ t: t + BEAT * 0.5, amp: 0.26 });
    EV.bass.push({
      t,
      freq: bi % 2 === 0 ? root : root * 2,
      dur: BEAT * 0.46,
      amp: 0.74,
      cut: 0.15,
    });
    for (let s = 0; s < 4; s++)
      EV.arp.push({ t: t + s * BEAT * 0.25, freq: ARP[(b * 4 + s + 2) % ARP.length], dur: 0.10, amp: 0.22 });
  }

  /* ---- 125.65 - 148.04 s : error section. off-grid start, hurt bass ---- */
  for (const { b, t } of beatsIn(125.65, 148.04)) {
    const bi = b % 4;
    const root = VOICE[chordOfBar(barOfBeat(b))].root;
    EV.kick.push({ t, amp: 0.90 });
    EV.snare.push({ t, amp: 0.50 });
    EV.snare.push({ t: t + BEAT * 0.5, amp: bi % 2 ? 0.30 : 0.42 });
    EV.hat.push({ t, amp: bi % 2 ? 0.12 : 0.19, open: false });
    EV.bass.push({ t, freq: root, dur: BEAT * 0.42, amp: 0.60, cut: 0.45, dist: 2.9 });
  }

  /* ---- 148.04 - 159.11 s : twelve. 12 identical two-beat loops --------- */
  for (let i = 0; i < 12; i++) {
    const t = tBeat(320 + 2 * i); // 148.0363 + i * 0.923077
    const tight = i / 11;
    EV.kick.push({ t, amp: 0.86 + 0.12 * tight });
    EV.stab.push({ t, freq: 880, dec: 0.26 - 0.20 * tight, amp: 0.55 + 0.32 * tight });
  }

  /* ---- 159.11 - 161.88 s : counting. six beats, kick + rising blip ----- */
  for (let k = 0; k < 6; k++) {
    const t = tBeat(344 + k);
    EV.kick.push({ t, amp: 0.88 });
    EV.blip.push({ t, freq: 440 * Math.pow(2, k / 6), dur: 0.18, amp: 0.50 });
    EV.hat.push({ t, amp: 0.16, open: false });
  }

  /* ---- 161.88 - 162.81 s : last hit. reverse cymbal + sub dive --------- */
  EV.rev.push({ t: tBeat(350), dur: tBeat(352) - tBeat(350), amp: 0.85 });
  EV.dive.push({ t: tBeat(350), dur: tBeat(352) - tBeat(350), f0: 96, f1: 26, amp: 0.85 });

  /* ---- 162.81 - 192.34 s : final chorus. everything ------------------- */
  for (const { b, t } of beatsIn(162.81, 192.34)) {
    const bi = b % 4;
    const root = VOICE[chordOfBar(barOfBeat(b))].root;
    EV.kick.push({ t, amp: 1.0 });
    EV.kick.push({ t: t + BEAT * 0.75, amp: 0.26, dur: 0.2, dec: 0.045, f0: 100 });
    EV.hat.push({ t: t + BEAT * 0.25, amp: 0.13, open: false });
    EV.hat.push({ t: t + BEAT * 0.5, amp: 0.23, open: true });
    EV.hat.push({ t: t + BEAT * 0.75, amp: 0.11, open: false });
    if (bi === 1 || bi === 3) EV.snare.push({ t, amp: 0.72 });
    if (bi === 3) EV.snare.push({ t: t + BEAT * 0.5, amp: 0.24 });
    EV.bass.push({
      t,
      freq: bi % 2 === 0 ? root : root * 2,
      dur: BEAT * 0.46,
      amp: 0.74,
      cut: 0.15,
    });
    for (let s = 0; s < 4; s++)
      EV.arp.push({ t: t + s * BEAT * 0.25, freq: ARP[(b * 4 + s + 1) % ARP.length], dur: 0.10, amp: 0.21 });
  }
  for (let b = 352; b < 416; b += 2)
    EV.lead.push({ t: tBeat(b), dur: BEAT * 1.9, freq: LEAD[(b / 2) % LEAD.length], amp: 0.34 });

  /* ---- 192.34 - 211.96 s : outro. 60 % level, elements peel off -------- */
  const OUT = 0.6;
  for (const { b, t } of beatsIn(192.34, 211.96)) {
    const bi = b % 4;
    const root = VOICE[chordOfBar(barOfBeat(b))].root;
    if (t < 199.11) {
      EV.kick.push({ t, amp: 0.80 * OUT });
      EV.hat.push({ t, amp: 0.20 * OUT, open: false });
      EV.hat.push({ t: t + BEAT * 0.5, amp: 0.13 * OUT, open: false });
      if (bi === 1 || bi === 3) EV.snare.push({ t, amp: 0.55 * OUT });
      EV.bass.push({ t, freq: root, dur: BEAT * 0.85, amp: 0.55 * OUT, cut: 0.10 });
    } else if (t < 205.73) {
      EV.kick.push({ t, amp: 0.72 * OUT });
      if (bi === 1 || bi === 3) EV.snare.push({ t, amp: 0.40 * OUT });
      if (bi === 0) EV.bass.push({ t, freq: root, dur: BEAT * 3.6, amp: 0.50 * OUT, cut: 0.08 });
    } else if (bi === 0) {
      // heartbeat: two thumps, once a bar
      EV.kick.push({ t, amp: 0.55 * OUT, dur: 0.30, dec: 0.07, click: 0.06 });
      EV.kick.push({ t: t + 0.24, amp: 0.34 * OUT, dur: 0.24, dec: 0.055, click: 0.03 });
    }
  }
  EV.kick.push({ t: 205.73, amp: 0.55 * OUT, dur: 0.30, dec: 0.07, click: 0.06 });
  EV.kick.push({ t: 205.97, amp: 0.34 * OUT, dur: 0.24, dec: 0.055, click: 0.03 });

  /* ---- pads: two bars per chord, whole song --------------------------- */
  for (let k = 0; k < 116; k += 2) {
    const t = tBar(k);
    if (t >= 211.5) break;
    const ch = chordOfBar(k);
    const amp = padAmpAt(t);
    if (amp <= 0) continue;
    const dur = Math.min(2 * BAR, 212.0 - t);
    EV.pad.push({ t: Math.max(0, t), dur, notes: VOICE[ch].pad, amp, atk: k === 0 ? 0.45 : 0.22 });
    if (sectionAt(t) === 'final')
      EV.pad.push({ t, dur, notes: VOICE[ch].pad.map((f) => f * 2), amp: amp * 0.45, atk: 0.28 });
  }

  // pre-chorus 2 hole (100.5-103.2 s): one sustained, un-re-attacked pad,
  // otherwise a chord change would put a swell right in the silent gap.
  for (let i = EV.pad.length - 1; i >= 0; i--) {
    const e = EV.pad[i];
    if (e.t > 99.8 && e.t < 103.2 && i > 0) {
      const prev = EV.pad[i - 1];
      prev.dur = Math.max(prev.dur, e.t + e.dur - prev.t);
      EV.pad.splice(i, 1);
    }
  }

  /* ---- vocal placeholder ---------------------------------------------- */
  schedVox();
}

function padAmpAt(t) {
  const s = sectionAt(t);
  return (
    {
      intro: 0.50,
      build: 0.60,
      chorus1: 0.72,
      verse2: 0.58,
      pre2: 0.36, // 100.5-103.2 must read as a hole with only a thin pad
      chorus2: 0.72,
      error: 0.62,
      twelve: 0.44,
      count: 0.50,
      lasthit: 0.30,
      final: 0.80,
      outro: 0.46,
      end: 0,
    }[s] ?? 0
  );
}

/* -------------------------------------------------------------- vocal line */

const A3 = 220.0;
const MOT = [0, 3, 5, 7, 3, 0, 5, 3, 7, 5, 3, 0]; // A minor pentatonic degrees, 220-330 Hz
const VOW = ['a', 'e', 'i', 'o', 'u'];
const fOf = (semi) => A3 * Math.pow(2, semi / 12);

function schedVox() {
  const step = BEAT * 0.5; // one syllable per half beat inside a phrase

  function phrase(t0, t1, idx, amp = 1) {
    const n = Math.max(1, Math.round((t1 - t0) / step));
    for (let i = 0; i < n; i++) {
      const t = t0 + i * step;
      if (t >= t1 - 1e-9) break;
      const last = i === n - 1;
      const deg = last ? 0 : MOT[(i + idx * 3) % MOT.length];
      const dur = last ? step * 2.4 : step * 0.82;
      EV.vox.push({
        t,
        dur,
        f0: fOf(deg),
        vowel: VOW[(i + idx) % 5],
        amp: (0.72 + 0.28 * Math.cos(i * 0.9)) * amp,
      });
    }
  }

  // 0.34-15.11 / 15.57-29.5 / 30.0-44.5 / 45.0-58.96
  phrase(0.34, 15.11, 0, 0.7);
  phrase(15.57, 29.5, 1, 0.8);
  phrase(30.0, 44.5, 2, 0.85);
  phrase(45.0, 58.96, 3, 0.9);
  // 59.42-73.73 chorus 1
  phrase(59.42, 73.73, 4, 0.95);
  // 74.19-88.5 verse 2
  phrase(74.19, 88.5, 5, 0.85);

  // 88.96-103.26 pre-chorus 2: six isolated short syllables, rest silent
  const sparse = [
    [90.8, 5],
    [91.72, 3],
    [94.5, 7],
    [95.16, 0],
    [98.19, 3],
    [99.1, 5],
  ];
  sparse.forEach(([t, deg], j) =>
    EV.vox.push({ t, dur: 0.2, f0: fOf(deg), vowel: VOW[j % 5], amp: 0.8 })
  );

  // 103.73-125.19 chorus 2
  phrase(103.73, 125.19, 6, 0.95);

  // 125.65-147.57 error: chopped, short, gated
  {
    const g = BEAT * 0.25;
    const n = Math.floor((147.57 - 125.65) / g);
    for (let i = 0; i < n; i++) {
      const t = 125.65 + i * g;
      if (i % 3 === 2) continue;
      if (rnd() < 0.28) continue;
      EV.vox.push({
        t,
        dur: g * 0.55,
        f0: fOf([0, 3, 7, 5][i % 4]),
        vowel: VOW[i % 5],
        amp: 0.5 + 0.35 * rnd(),
      });
    }
  }

  // 148.04-159.11 twelve: four even syllables per two beats
  for (let g = 0; g < 12; g++) {
    const base = tBeat(320 + 2 * g);
    for (let j = 0; j < 4; j++)
      EV.vox.push({
        t: base + j * step,
        dur: BEAT * 0.42,
        f0: fOf([0, 5, 3, 7][(j + g) % 4]),
        vowel: VOW[j],
        amp: 0.82,
      });
  }

  // 159.11-161.42 count: one syllable per beat
  for (let k = 0; k < 6; k++)
    EV.vox.push({ t: tBeat(344 + k), dur: BEAT * 0.7, f0: fOf([0, 3, 5, 7, 5, 3][k]), vowel: VOW[k], amp: 0.9 });

  // 161.88-162.81 one long syllable
  EV.vox.push({ t: tBeat(350), dur: 0.86, f0: fOf(7), vowel: 'a', amp: 1.0 });

  // 162.81-192.34 final chorus, continuous, three tail syllables
  phrase(162.81, 191.3, 7, 1.0);
  EV.vox.push({ t: 191.36, dur: 0.16, f0: fOf(7), vowel: 'i', amp: 0.9 });
  EV.vox.push({ t: 191.66, dur: 0.16, f0: fOf(5), vowel: 'e', amp: 0.9 });
  EV.vox.push({ t: 192.05, dur: 0.26, f0: fOf(3), vowel: 'o', amp: 0.9 });

  // 192.34-196.04 closing line: one long note, then two soft articulation
  // syllables so the tail still has detectable onsets, silence after 196.04
  EV.vox.push({ t: 192.34, dur: 2.62, f0: fOf(0), vowel: 'a', amp: 0.85 });
  EV.vox.push({ t: 195.11, dur: 0.19, f0: fOf(0), vowel: 'o', amp: 0.6 });
  EV.vox.push({ t: 195.36, dur: 0.52, f0: fOf(-2), vowel: 'a', amp: 0.66 });
}

/* -------------------------------------------------------------- synthesis  */

let out = null;
function add(i, v) {
  if (i >= 0 && i < NS) out[i] += v;
}
function tail(i, n, sec) {
  const m = n - i;
  const t = sec * SR;
  return m > t ? 1 : m / t;
}

function renderKick(ev) {
  const dur = ev.dur ?? 0.32;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  const f0 = ev.f0 ?? 110;
  const f1 = ev.f1 ?? 45;
  const dec = ev.dec ?? 0.085;
  const swp = ev.swp ?? 0.030;
  const click = ev.click ?? 0.22;
  const atk = 1 / (0.0016 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / swp);
    ph += f / SR;
    if (ph >= 1) ph -= 1;
    const env = Math.exp(-t / dec) * Math.min(1, i * atk);
    let v = sin01(ph) * env;
    if (click > 0) v += (rnd() * 2 - 1) * Math.exp(-t / 0.0035) * click;
    add(i0 + i, v * ev.amp * tail(i, n, 0.006));
  }
}

function renderSnare(ev) {
  const dur = ev.dur ?? 0.18;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let prev = 0;
  let lp = 0;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const nz = rnd() * 2 - 1;
    const d = nz - prev * 0.92; // 1st difference ~ highpass
    prev = nz;
    lp += 0.52 * (d - lp); // ~5 kHz one-pole -> bandpass feel
    ph += 180 / SR;
    if (ph >= 1) ph -= 1;
    const body = sin01(ph) * Math.exp(-t / 0.05) * 0.5;
    const v = (lp * 2.1 * Math.exp(-t / 0.042) + body) * ev.amp * tail(i, n, 0.005);
    add(i0 + i, v);
  }
}

function renderHat(ev) {
  const open = !!ev.open;
  const dec = open ? 0.085 : 0.05; // spec: 0.05 s closed-hat decay
  const dur = open ? 0.28 : 0.11;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let p1 = 0;
  let p2 = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const nz = rnd() * 2 - 1;
    const d1 = nz - p1;
    p1 = nz;
    const d2 = d1 - p2; // double difference ~ steeper highpass
    p2 = d1;
    lp += 0.72 * (d2 - lp);
    const env = Math.exp(-t / dec);
    add(i0 + i, lp * env * ev.amp * tail(i, n, 0.003));
  }
}

function renderStab(ev) {
  const dec = ev.dec ?? 0.22;
  const dur = Math.min(1.0, dec * 4.5);
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  const f = ev.freq ?? 880;
  const R = [1.0, 2.76, 5.4]; // inharmonic bell ratios
  const ph = [0, 0, 0];
  const inc = R.map((r) => (f * r) / SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let j = 0; j < 3; j++) {
      ph[j] += inc[j];
      if (ph[j] >= 1) ph[j] -= 1;
      v += sin01(ph[j]) * (j === 0 ? 0.5 : j === 1 ? 0.32 : 0.22);
    }
    add(i0 + i, v * Math.exp(-t / dec) * ev.amp * tail(i, n, 0.004));
  }
}

function renderBlip(ev) {
  const dur = ev.dur ?? 0.16;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const u = i / n;
    ph += (ev.freq * (1 + 1.6 * u)) / SR;
    if (ph >= 1) ph -= 1;
    const env = Math.min(1, t / 0.004) * Math.exp(-t / (dur * 0.45));
    add(i0 + i, sin01(ph) * env * ev.amp * tail(i, n, 0.004));
  }
}

function renderRev(ev) {
  const dur = ev.dur;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let p1 = 0;
  let p2 = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const nz = rnd() * 2 - 1;
    const d1 = nz - p1;
    p1 = nz;
    const d2 = d1 - p2;
    p2 = d1;
    lp += 0.6 * (d2 - lp);
    add(i0 + i, lp * Math.pow(u, 2.6) * ev.amp * tail(i, n, 0.003));
  }
}

function renderRiser(ev) {
  const dur = ev.dur;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let p1 = 0;
  let lp = 0;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const nz = rnd() * 2 - 1;
    const d = nz - p1;
    p1 = nz;
    lp += (0.15 + 0.55 * u) * (d - lp);
    ph += (320 * Math.pow(4, u)) / SR;
    if (ph >= 1) ph -= 1;
    const env = Math.pow(u, 2.0);
    add(i0 + i, (lp * 1.1 + sin01(ph) * 0.45) * env * ev.amp * tail(i, n, 0.004));
  }
}

function renderImpact(ev) {
  const dur = ev.dur ?? 0.5;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const u = i / n;
    ph += (70 * Math.pow(0.34, u)) / SR;
    if (ph >= 1) ph -= 1;
    const env = Math.exp(-t / 0.13) * Math.min(1, t / 0.004);
    add(i0 + i, (sin01(ph) + 0.25 * sin01(ph * 2)) * env * ev.amp * tail(i, n, 0.01));
  }
}

function renderDive(ev) {
  const dur = ev.dur;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let ph = 0;
  const f0 = ev.f0 ?? 96;
  const f1 = ev.f1 ?? 26;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    ph += (f0 * Math.pow(f1 / f0, u)) / SR;
    if (ph >= 1) ph -= 1;
    const env = Math.pow(u, 1.4);
    add(i0 + i, sin01(ph) * env * ev.amp * tail(i, n, 0.004));
  }
}

function renderBass(ev) {
  const dur = ev.dur;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  const f = ev.freq;
  const cut = ev.cut ?? 0.12;
  const drive = ev.dist ?? 1;
  const K = Math.max(2, Math.min(12, Math.floor(2200 / f)));
  const atk = 1 / (0.004 * SR);
  const rel = Math.min(0.06, dur * 0.25) * SR;
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    ph += f / SR;
    if (ph >= 1) ph -= 1;
    let s = 0;
    for (let k = 1; k <= K; k++) s += sin01(ph * k) / k;
    s *= 0.6;
    lp += cut * (s - lp);
    let v = lp;
    if (drive > 1.2) v = Math.tanh(v * drive) * 0.85; // error-section grit
    const env = Math.min(1, i * atk) * (i > n - rel ? (n - i) / rel : 1);
    add(i0 + i, v * env * ev.amp);
  }
}

function renderPad(ev) {
  const dur = ev.dur + 0.35;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  const atk = ev.atk ?? 0.22;
  const rel = 0.35;
  const det = [-0.0032, 0, 0.0035];
  const ph = new Float64Array(ev.notes.length * 3);
  const inc = [];
  for (const f of ev.notes) for (const d of det) inc.push((f * (1 + d)) / SR);
  let lp1 = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (let o = 0; o < inc.length; o++) {
      ph[o] += inc[o];
      if (ph[o] >= 1) ph[o] -= 1;
      const q = ph[o];
      s += sin01(q) * 0.8 + (2 * q - 1) * 0.2; // sine + a little saw bite
    }
    s *= 0.34;
    lp1 += 0.16 * (s - lp1);
    lp2 += 0.16 * (lp1 - lp2); // 2-pole lowpass ~1.2 kHz
    const env = Math.min(1, t / atk) * (t > dur - rel ? Math.max(0, (dur - t) / rel) : 1);
    add(i0 + i, lp2 * env * ev.amp);
  }
}

function renderArp(ev) {
  const dur = ev.dur;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += ev.freq / SR;
    if (ph >= 1) ph -= 1;
    const s = sin01(ph) + 0.28 * sin01(ph * 3);
    lp += 0.42 * (s - lp);
    add(i0 + i, lp * Math.exp(-t / (dur * 0.35)) * ev.amp * tail(i, n, 0.004));
  }
}

function renderLead(ev) {
  const dur = ev.dur;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = ev.freq * (1 + 0.006 * Math.sin(TAU * 5.2 * t) * Math.min(1, t / 0.35));
    ph += f / SR;
    if (ph >= 1) ph -= 1;
    let sq = sin01(ph) * 4; // soft square
    sq = Math.max(-0.9, Math.min(0.9, sq));
    lp += 0.30 * (sq - lp);
    const env =
      Math.min(1, t / 0.03) *
      (t > dur - 0.09 ? Math.max(0, (dur - t) / 0.09) : 1) *
      (0.7 + 0.3 * Math.min(1, t / 0.4));
    add(i0 + i, lp * env * ev.amp);
  }
}

/* formant "hum" voice: pulse source -> 3 parallel bandpass resonators */
const VOWEL = {
  a: { f: [800, 1220, 2600], bw: [80, 110, 160], g: [1.0, 0.62, 0.30] },
  e: { f: [520, 1800, 2550], bw: [70, 100, 150], g: [1.0, 0.55, 0.28] },
  i: { f: [300, 2320, 3000], bw: [60, 90, 140], g: [1.0, 0.52, 0.30] },
  o: { f: [500, 1020, 2650], bw: [75, 100, 150], g: [1.0, 0.60, 0.25] },
  u: { f: [340, 960, 2500], bw: [65, 95, 145], g: [1.0, 0.50, 0.22] },
};

function renderVox(ev) {
  const dur = ev.dur;
  const n = Math.round(dur * SR);
  const i0 = Math.round(ev.t * SR);
  const f0 = ev.f0;
  const V = VOWEL[ev.vowel] ?? VOWEL.a;
  const co = V.f.map((f, i) => {
    const w0 = (TAU * f) / SR;
    const Q = f / V.bw[i];
    const al = Math.sin(w0) / (2 * Q);
    const a0 = 1 + al;
    return { b0: al / a0, b2: -al / a0, a1: (-2 * Math.cos(w0)) / a0, a2: (1 - al) / a0 };
  });
  const st = V.f.map(() => ({ x1: 0, x2: 0, y1: 0, y2: 0 }));
  const K = Math.max(1, Math.min(16, Math.floor(3600 / f0)));
  const atk = Math.max(0.012, Math.min(0.05, dur * 0.25));
  const rel = Math.min(0.09, dur * 0.5);
  let ph = 0;
  let nlp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const drift = 1 + 0.004 * Math.sin(TAU * 5.5 * t);
    ph += (f0 * drift) / SR;
    if (ph >= 1) ph -= 1;
    let src = 0;
    for (let k = 1; k <= K; k++) src += sin01(ph * k) / k;
    src *= 0.55;
    const nz = rnd() * 2 - 1;
    nlp += 0.08 * (nz - nlp);
    src += nlp * 0.35; // breath
    let v = 0;
    for (let j = 0; j < 3; j++) {
      const c = co[j];
      const s = st[j];
      const y = c.b0 * src + c.b2 * s.x2 - c.a1 * s.y1 - c.a2 * s.y2;
      s.x2 = s.x1;
      s.x1 = src;
      s.y2 = s.y1;
      s.y1 = y;
      v += y * V.g[j];
    }
    const env = Math.min(1, t / atk) * (t > dur - rel ? Math.max(0, (dur - t) / rel) : 1);
    add(i0 + i, v * env * ev.amp);
  }
}

/* ------------------------------------------------------------------- mixing */

const master = new Float32Array(NS);
const bus = new Float32Array(NS);

function activeRmsDb(buf) {
  const B = 441; // 10 ms blocks
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i + B <= NS; i += B) {
    let e = 0;
    for (let j = 0; j < B; j++) {
      const v = buf[i + j];
      e += v * v;
    }
    const r = e / B;
    if (r > 1e-6) {
      sum += r;
      cnt++;
    }
  }
  if (!cnt) return -120;
  return 10 * Math.log10(sum / cnt);
}

function applySidechain(buf, kickTimes, depth = 0.78, rec = 0.13) {
  const a = Math.exp(-1 / (rec * SR));
  let ki = 0;
  let duck = 1;
  for (let i = 0; i < NS; i++) {
    const t = i / SR;
    while (ki < kickTimes.length && kickTimes[ki] <= t) {
      duck = 1 - depth;
      ki++;
    }
    buf[i] *= duck;
    duck = 1 - (1 - duck) * a;
  }
}

/** render one stem into `bus`, optional post-processor, auto-gain, mix to master */
function renderStem(fn, targetDb, post) {
  bus.fill(0);
  out = bus;
  fn();
  if (post) post(bus);
  const rms = activeRmsDb(bus);
  let pk = 0;
  for (let i = 0; i < NS; i++) {
    const a = Math.abs(bus[i]);
    if (a > pk) pk = a;
  }
  const gain = Math.max(0.02, Math.min(40, Math.pow(10, (targetDb - rms) / 20)));
  for (let i = 0; i < NS; i++) master[i] += bus[i] * gain;
  return { rms, peak: pk, gain };
}

/* ------------------------------------------------------- onset measurement */

function onsetMs(buf, tExpect, win = 0.12) {
  const i0 = Math.max(1, Math.round((tExpect - win) * SR));
  const i1 = Math.min(NS - 1, Math.round((tExpect + win) * SR));
  const m = i1 - i0;
  const env = new Float32Array(m);
  let e = 0;
  let mx = 0;
  for (let i = 0; i < m; i++) {
    const d = Math.abs(buf[i0 + i] - buf[i0 + i - 1]);
    e += (d - e) * 0.25;
    env[i] = e;
    if (e > mx) mx = e;
  }
  if (mx <= 1e-9) return NaN;
  const th = mx * 0.3;
  for (let i = 0; i < m; i++) if (env[i] >= th) return ((i0 + i) / SR - tExpect) * 1000;
  return NaN;
}

/* ------------------------------------------------------------------- report */

function rmsTable(buf, bin = 8.0) {
  const rows = [];
  const step = Math.round(bin * SR);
  for (let s = 0; s < NS; s += step) {
    const e = Math.min(NS, s + step);
    let acc = 0;
    for (let i = s; i < e; i++) acc += buf[i] * buf[i];
    rows.push({ t: s / SR, dur: (e - s) / SR, db: dB(Math.sqrt(acc / (e - s))) });
  }
  return rows;
}

function sectionRms(buf) {
  const rows = [];
  for (const [id, a, b] of SEC) {
    if (id === 'end') continue;
    const s = Math.round(a * SR);
    const e = Math.min(NS, Math.round(b * SR));
    let acc = 0;
    for (let i = s; i < e; i++) acc += buf[i] * buf[i];
    rows.push({ id, a, b, db: dB(Math.sqrt(acc / (e - s))) });
  }
  return rows;
}

/* ---------------------------------------------------------------------- wav */

function writeWav(file, buf) {
  const bytes = 44 + NS * 2;
  const b = Buffer.alloc(bytes);
  b.write('RIFF', 0);
  b.writeUInt32LE(bytes - 8, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(NS * 2, 40);
  let maxAbs = 0;
  for (let i = 0; i < NS; i++) {
    const s = buf[i] * 32768;
    const v = Math.round(s);
    const c = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
    if (Math.abs(c) > maxAbs) maxAbs = Math.abs(c);
    b.writeInt16LE(c, 44 + i * 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, b);
  return maxAbs;
}

/* --------------------------------------------------------------------- main */

const t0 = Date.now();

console.log('world.execute(me);  placeholder track — 130 BPM / 44.1 kHz / 16-bit / mono');
console.log(`samples ${NS}  beat ${BEAT.toFixed(10)} s  bar ${BAR.toFixed(10)} s  beat0 ${T0} s`);

arrange();
EV.kick.sort((a, b) => a.t - b.t);

console.log(
  'events: ' +
    Object.entries(EV)
      .map(([k, v]) => `${k}=${v.length}`)
      .join(' ')
);

// drums -----------------------------------------------------------------
const kickTimes = EV.kick.map((k) => k.t);
const drums = renderStem(() => {
  EV.kick.forEach(renderKick);
  EV.snare.forEach(renderSnare);
  EV.hat.forEach(renderHat);
  EV.stab.forEach(renderStab);
  EV.blip.forEach(renderBlip);
  EV.rev.forEach(renderRev);
  EV.riser.forEach(renderRiser);
  EV.impact.forEach(renderImpact);
  EV.dive.forEach(renderDive);
}, -12.5);

// bass, ducked by the kick (sidechain pump) ------------------------------
const bassR = renderStem(
  () => EV.bass.forEach(renderBass),
  -15.5,
  (buf) => applySidechain(buf, kickTimes, 0.78, 0.13)
);

// pads / arp / lead / vox -------------------------------------------------
const pads = renderStem(() => EV.pad.forEach(renderPad), -18.5);
const arp = renderStem(() => EV.arp.forEach(renderArp), -24.0);
const lead = renderStem(() => EV.lead.forEach(renderLead), -19.0);
const vox = renderStem(() => EV.vox.forEach(renderVox), -19.0);

/* ---- global shaping: section automation, dc block, fades -------------- */
{
  // Arrangement dynamics: each section gets an explicit RMS target so the
  // contrast is real and measurable, not just a by-product of density.
  const TARGET_SECTION_DB = {
    intro: -27.5,
    build: -21.0,
    chorus1: -17.8,
    verse2: -20.0,
    pre2: -26.0,
    chorus2: -17.5,
    error: -18.8,
    twelve: -19.5,
    count: -18.5,
    lasthit: -22.5,
    final: -16.2,
    outro: -20.6,
  };
  const meas = {};
  for (const r of sectionRms(master)) meas[r.id] = r.db;
  const smooth = 1 - Math.exp(-1 / (0.035 * SR));
  let g = Math.pow(10, (TARGET_SECTION_DB[SEC[0][0]] - meas[SEC[0][0]]) / 20);
  for (const [id, a, b] of SEC) {
    const s = Math.round(a * SR);
    const e = Math.min(NS, Math.round(b * SR));
    const tgt = Math.pow(10, ((TARGET_SECTION_DB[id] ?? -20) - (meas[id] ?? -20)) / 20);
    for (let i = s; i < e; i++) {
      g += (tgt - g) * smooth;
      master[i] *= g;
    }
  }
  let lp = 0;
  for (let i = 0; i < NS; i++) {
    const x = master[i];
    lp += 0.0008 * (x - lp);
    master[i] = x - lp;
  }
  const fi = Math.round(0.004 * SR);
  for (let i = 0; i < fi; i++) master[i] *= i / fi;
  const fs0 = Math.round(210.0 * SR);
  for (let i = fs0; i < NS; i++) {
    const u = (i - fs0) / (NS - fs0);
    master[i] *= Math.cos(u * Math.PI * 0.5) ** 2;
  }
}

/* ---- normalize to -1.5 dBFS ------------------------------------------ */
/* ---- soft-knee limiter, then normalize to -1.5 dBFS ------------------- */
{
  const K = 0.5; // knee: below this everything is untouched
  const LIM = 0.9; // hard ceiling after the knee
  const span = LIM - K;
  for (let i = 0; i < NS; i++) {
    const x = master[i];
    const a = Math.abs(x);
    if (a > K) {
      const y = K + span * Math.tanh((a - K) / span);
      master[i] = x < 0 ? -y : y;
    }
  }
}
let peak = 0;
let peakAt = 0;
for (let i = 0; i < NS; i++) {
  const a = Math.abs(master[i]);
  if (a > peak) {
    peak = a;
    peakAt = i / SR;
  }
}
const TARGET = Math.pow(10, -1.5 / 20); // 0.8414
const norm = TARGET / peak;
for (let i = 0; i < NS; i++) master[i] *= norm;

const maxInt = writeWav(WAV_PATH, master);

/* ---- verification ----------------------------------------------------- */
const peakDb = dB(TARGET);
console.log('\n--- files ---');
console.log(`audio/track.wav   ${(fs.statSync(WAV_PATH).size / 1048576).toFixed(2)} MiB`);
console.log(
  `duration ${(NS / SR).toFixed(3)} s   peak ${peakDb.toFixed(2)} dBFS   max |int16| ${maxInt}` +
    `   norm x${norm.toFixed(3)}   pre-norm peak ${dB(peak).toFixed(2)} dBFS @ ${peakAt.toFixed(2)} s`
);

console.log('\n--- stem balance (active RMS, pre-normalize) ---');
for (const [name, s] of [
  ['drums', drums],
  ['bass', bassR],
  ['pads', pads],
  ['arp', arp],
  ['lead', lead],
  ['vox', vox],
]) console.log(`${name.padEnd(6)} ${s.rms.toFixed(1)} dB  gain x${s.gain.toFixed(2)}`);

console.log('\n--- RMS per 8 s (dBFS) ---');
const tab = rmsTable(master, 8);
for (const r of tab) {
  const bars = '#'.repeat(Math.max(0, Math.round((r.db + 48) * 1.4)));
  console.log(`${r.t.toFixed(1).padStart(6)} s  ${r.db.toFixed(1).padStart(6)}  ${bars}`);
}

console.log('\n--- section RMS (dBFS) ---');
for (const r of sectionRms(master)) {
  const bars = '#'.repeat(Math.max(0, Math.round((r.db + 48) * 1.4)));
  console.log(`${r.id.padEnd(8)} ${r.a.toFixed(2).padStart(7)}-${r.b.toFixed(2).padStart(7)}  ${r.db.toFixed(1).padStart(6)}  ${bars}`);
}

/* onset accuracy of the ten pre-chorus hits, measured on the drum stem */
{
  bus.fill(0);
  out = bus;
  EV.kick.forEach(renderKick);
  EV.impact.forEach(renderImpact);
  const hits = [91.05, 91.98, 94.93, 95.63, 96.31, 97.5, 97.97, 99.35, 100.04, 100.28];
  console.log('\n--- pre-chorus 2 hit accuracy (drum stem, |diff| onset) ---');
  let worst = 0;
  for (const h of hits) {
    const d = onsetMs(bus, h);
    if (Math.abs(d) > worst) worst = Math.abs(d);
    console.log(`  ${h.toFixed(2).padStart(7)} s  offset ${d.toFixed(2).padStart(7)} ms`);
  }
  console.log(`  worst |offset| ${worst.toFixed(2)} ms`);
}

/* vocal band check: 1100-2900 Hz share of the voice stem */
{
  bus.fill(0);
  out = bus;
  EV.vox.forEach(renderVox);
  // crude band split: 2-pole highpass at 1100 and 2-pole lowpass at 2900
  const hp = new Float32Array(NS);
  {
    let a1 = 0;
    let a2 = 0;
    const c = Math.exp((-TAU * 1100) / SR);
    for (let i = 0; i < NS; i++) {
      const x = bus[i];
      a1 = c * a1 + (1 - c) * x;
      hp[i] = x - a1;
    }
  }
  let eTot = 0;
  let eBand = 0;
  {
    let l1 = 0;
    let l2 = 0;
    const c = 1 - Math.exp((-TAU * 2900) / SR);
    for (let i = 0; i < NS; i++) {
      l1 += c * (hp[i] - l1);
      l2 += c * (l1 - l2);
      eBand += l2 * l2;
      eTot += bus[i] * bus[i];
    }
  }
  // 300-3400 Hz share (the band the vocal has to live in)
  let eWide = 0;
  {
    let b1 = 0;
    let b2 = 0;
    const ch = Math.exp((-TAU * 300) / SR);
    const cl = 1 - Math.exp((-TAU * 3400) / SR);
    const hp2 = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      b1 = ch * b1 + (1 - ch) * bus[i];
      hp2[i] = bus[i] - b1;
    }
    for (let i = 0; i < NS; i++) {
      b2 += cl * (hp2[i] - b2);
      eWide += b2 * b2;
    }
  }
  console.log(
    `\nvocal band shares of voice stem energy: 300-3400 Hz ${(100 * Math.sqrt(eWide / eTot)).toFixed(1)} %` +
      `   1100-2900 Hz ${(100 * Math.sqrt(eBand / eTot)).toFixed(1)} %`
  );
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\ndone in ${secs} s`);
