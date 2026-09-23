import { decompose, hasLeftTick, vowelShape } from "@/lib/hangul";

/**
 * 한 글자를 초성·중성·종성 획 모양 그대로 오려낸 마스크로 쪼갠다.
 *
 * 네모로 잘라 칠하면 획이 중간에서 끊긴다. 그래서 글자를 캔버스에 한 번 그려
 * 붙어 있는 획 덩어리를 찾고, 덩어리째 자모에 배정한다. 획은 절대 잘리지 않고
 * 배정만 틀릴 수 있는데, 자모 사이에는 대개 빈 틈이 있어 그 틈을 경계로 삼는다.
 *
 * 결과는 CSS `mask-image`로 쓴다. 화면 글자는 브라우저가 그린 진짜 텍스트 그대로라
 * 흐려지지 않고, 마스크는 어느 획을 보여 줄지만 정한다.
 */

/** 마스크 해상도. 1em을 이 픽셀로 그린다. */
const EM = 160;
/** 글자 둘레 여백(px). 마스크를 불려도 잘리지 않을 만큼. */
const PAD = 8;
/** 이 알파부터 획으로 본다. */
const INK = 40;
/** 마스크를 불리는 반경(px). 화면 렌더링과 조금 어긋나도 획 끝이 잘리지 않는다. */
const GROW = 4;
/** 자모 사이 틈으로 인정할 최소 두께(px). 획 안의 빈틈을 틈으로 오인하지 않도록. */
const MIN_GAP = 6;

export type JamoMaskSet = {
  /** 초성·중성·종성 순서의 마스크 이미지. `jamoProgress`의 steps와 길이가 같다. */
  urls: string[];
  /** 마스크를 셀 안 어디에 얼마 크기로 놓을지. 모두 em. */
  left: number;
  top: number;
  width: number;
  height: number;
};

const cache = new Map<string, JamoMaskSet | null>();

let fontFamily: string | null = null;

/** 실제로 렌더링되는 글꼴 목록. CSS 변수는 var()가 안 풀리므로 요소에서 읽는다. */
function prayerFontFamily(): string {
  if (fontFamily !== null) return fontFamily;
  const probe = document.createElement("span");
  probe.className = "font-prayer";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  fontFamily = getComputedStyle(probe).fontFamily;
  probe.remove();
  return fontFamily;
}

type Stroke = {
  /** 획을 이루는 픽셀 수 */
  n: number;
  /** 픽셀 무게중심 */
  cx: number;
  cy: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** 알파 채널에서 붙어 있는 획 덩어리를 찾는다. 8방향으로 잇는다. */
function findStrokes(alpha: Uint8ClampedArray, w: number, h: number) {
  const labels = new Int32Array(w * h).fill(-1);
  const strokes: Stroke[] = [];
  const stack: number[] = [];

  for (let seed = 0; seed < labels.length; seed++) {
    if (labels[seed] !== -1 || alpha[seed * 4 + 3] < INK) continue;

    const id = strokes.length;
    const s: Stroke = { n: 0, cx: 0, cy: 0, minX: w, maxX: 0, minY: h, maxY: 0 };
    strokes.push(s);
    labels[seed] = id;
    stack.push(seed);

    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      s.n++;
      s.cx += x;
      s.cy += y;
      if (x < s.minX) s.minX = x;
      if (x > s.maxX) s.maxX = x;
      if (y < s.minY) s.minY = y;
      if (y > s.maxY) s.maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (labels[q] !== -1 || alpha[q * 4 + 3] < INK) continue;
          labels[q] = id;
          stack.push(q);
        }
      }
    }

    s.cx /= s.n;
    s.cy /= s.n;
  }

  return { labels, strokes };
}

/** `lo`부터 `hi`까지 훑어 처음 나오는 빈 구간의 한가운데. 없으면 null. */
function firstGap(profile: Uint32Array, lo: number, hi: number): number | null {
  let start = -1;
  for (let i = Math.max(0, lo); i < Math.min(profile.length, hi); i++) {
    if (profile[i] === 0) {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0 && i - start >= MIN_GAP) return (start + i) / 2;
    start = -1;
  }
  return null;
}

/**
 * `lo`부터 `hi` 사이에서 획 굵기가 가장 크게 달라지는 자리.
 *
 * 자모가 서로 닿아 틈이 없을 때 쓴다. 이음매는 대개 가는 획 하나뿐이고 그 획은
 * 한쪽 자모의 것이라, 굵기가 확 달라지는 곳이 곧 경계다. 이음매를 뒤 자모에게
 * 넘길 때는 뒤 자모가 시작되며 굵어지는 자리(`rise`)를, 앞 자모에게 남길 때는
 * 앞 자모가 끝나며 가늘어지는 자리(`fall`)를 잡는다. 어느 쪽이든 그 직전까지가 앞 자모다.
 */
function steepest(profile: Uint32Array, lo: number, hi: number, dir: "rise" | "fall"): number {
  const from = Math.max(1, Math.floor(lo));
  const to = Math.min(profile.length, Math.ceil(hi));
  const step = (i: number) =>
    dir === "rise" ? profile[i] - profile[i - 1] : profile[i - 1] - profile[i];

  let peak = -Infinity;
  for (let i = from; i < to; i++) if (step(i) > peak) peak = step(i);
  if (peak <= 0) return from - 0.5;

  // ㄷ·ㄹ처럼 가로획이 여럿인 받침은 아래 획에서 더 크게 변한다. 가장 큰 곳이 아니라
  // 뚜렷하게 변하는 첫 자리를 잡아야 자모의 윗머리에서 갈린다.
  for (let i = from; i < to; i++) if (step(i) >= peak * 0.7) return i - 0.5;
  return from - 0.5;
}

/** 획이 있는 행/열의 개수. band 밖은 세지 않는다. */
function profileX(
  labels: Int32Array,
  w: number,
  yFrom: number,
  yTo: number,
): Uint32Array {
  const out = new Uint32Array(w);
  for (let y = Math.max(0, yFrom); y < yTo; y++) {
    for (let x = 0; x < w; x++) if (labels[y * w + x] !== -1) out[x]++;
  }
  return out;
}

function profileY(labels: Int32Array, w: number, h: number): Uint32Array {
  const out = new Uint32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (labels[y * w + x] !== -1) out[y]++;
  }
  return out;
}

/** 경계로 삼아 볼 자리들. 틈 → 가장 얇은 곳 → 정해진 비율 순으로 믿는다. */
function cutCandidates(
  profile: Uint32Array,
  lo: number,
  hi: number,
  fallback: number,
  dir: "rise" | "fall",
): number[] {
  const gap = firstGap(profile, lo, hi);
  const joint = steepest(profile, lo, hi, dir);
  return gap === null ? [joint, fallback] : [gap, joint, fallback];
}

/**
 * 경계를 정해 놓고 픽셀마다 어느 자모의 것인지 표시한다. 획이 없으면 -1.
 *
 * 덩어리째 배정하는 것이 기본이다. 다만 초성과 중성이 서로 닿아 한 덩어리가 되기도
 * 하는데(구, 어), 그때는 경계를 걸친 덩어리만 선으로 가른다. 붙은 자리를 지나는 선이라
 * 잘린 티가 거의 나지 않는다. 한 자모가 통째로 비면 이 경계는 틀린 것이니 null.
 */
function fillOwners(
  strokes: Stroke[],
  labels: Int32Array,
  w: number,
  need: number,
  ownerAt: (x: number, y: number) => number,
): Int8Array | null {
  const byStroke = strokes.map((s) => ownerAt(s.cx, s.cy));

  let missing = false;
  for (let i = 0; i < need; i++) if (!byStroke.includes(i)) missing = true;

  // 비는 자모가 있을 때만, 경계를 걸친 덩어리를 픽셀 단위로 가른다.
  const split = new Set<number>();
  if (missing) {
    strokes.forEach((s, id) => {
      const corners = [
        ownerAt(s.minX, s.minY),
        ownerAt(s.maxX, s.minY),
        ownerAt(s.minX, s.maxY),
        ownerAt(s.maxX, s.maxY),
      ];
      if (corners.some((c) => c !== byStroke[id])) split.add(id);
    });
  }

  const owner = new Int8Array(labels.length).fill(-1);
  const filled = [0, 0, 0];
  for (let i = 0; i < owner.length; i++) {
    const label = labels[i];
    if (label === -1) continue;
    let who = byStroke[label];
    if (split.has(label)) {
      const x = i % w;
      who = ownerAt(x, (i - x) / w);
    }
    owner[i] = who;
    filled[who]++;
  }

  for (let i = 0; i < need; i++) if (filled[i] === 0) return null;
  return owner;
}

/** 초성·중성·종성 경계를 찾아 픽셀마다 주인을 정한다. 못 가르면 null. */
function assignPixels(
  strokes: Stroke[],
  labels: Int32Array,
  w: number,
  h: number,
  jung: string,
  hasJong: boolean,
): Int8Array | null {
  let x0 = w;
  let x1 = 0;
  let y0 = h;
  let y1 = 0;
  for (const s of strokes) {
    if (s.minX < x0) x0 = s.minX;
    if (s.maxX > x1) x1 = s.maxX;
    if (s.minY < y0) y0 = s.minY;
    if (s.maxY > y1) y1 = s.maxY;
  }
  const iw = x1 - x0;
  const ih = y1 - y0;
  if (iw <= 0 || ih <= 0) return null;

  const shape = vowelShape(jung);
  const need = hasJong ? 3 : 2;

  // 받침 경계는 글자 아래쪽에서 찾는다. 가로 모음(ㅜ)의 가로획이 한가운데 걸치므로
  // 그보다 아래에서만 찾아야 모음을 받침으로 오인하지 않는다.
  const allRows = profileY(labels, w, h);
  const jongCuts = hasJong
    ? cutCandidates(allRows, y0 + ih * 0.6, y0 + ih * 0.92, y0 + ih * 0.72, "rise")
    : [h];

  for (const yJong of jongCuts) {
    const bodyHeight = Math.min(yJong, y1) - y0;
    if (bodyHeight <= 0) continue;

    // 초성과 중성 경계. 세로 모음이면 세로선, 가로 모음이면 가로선, 복합이면 둘 다.
    // ㅏ의 세로획은 초성 다음에 굵어지며 시작하지만(rise), ㅓ는 삐침이 먼저 와
    // 초성이 끝나는 자리(fall)를 잡아야 삐침이 모음 쪽에 남는다.
    const sideCuts =
      shape === "horizontal"
        ? [Infinity]
        : cutCandidates(
            profileX(labels, w, y0, Math.min(yJong, y1 + 1)),
            x0 + iw * 0.28,
            x0 + iw * 0.9,
            x0 + iw * 0.56,
            hasLeftTick(jung) ? "fall" : "rise",
          );
    const bodyCuts =
      shape === "vertical"
        ? [Infinity]
        : cutCandidates(
            profileY(labels, w, Math.min(yJong, h)),
            y0 + bodyHeight * 0.2,
            y0 + bodyHeight * 0.88,
            y0 + bodyHeight * 0.55,
            "rise",
          );

    for (const xCut of sideCuts) {
      for (const yCut of bodyCuts) {
        const ownerAt = (x: number, y: number): number => {
          if (hasJong && y > yJong) return 2;
          if (shape === "vertical") return x < xCut ? 0 : 1;
          if (shape === "horizontal") return y < yCut ? 0 : 1;
          return x < xCut && y < yCut ? 0 : 1;
        };
        const owner = fillOwners(strokes, labels, w, need, ownerAt);
        if (owner) return owner;
      }
    }
  }

  return null;
}

/** 배정된 획만 남긴 마스크 이미지. 가장자리를 조금 불려 어긋남을 견딘다. */
function maskUrl(owner: Int8Array, target: number, w: number, h: number): string {
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const sctx = src.getContext("2d")!;
  const image = sctx.createImageData(w, h);
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] === target) image.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(image, 0, 0);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  for (let dy = -GROW; dy <= GROW; dy += GROW) {
    for (let dx = -GROW; dx <= GROW; dx += GROW) octx.drawImage(src, dx, dy);
  }
  return out.toDataURL();
}

/**
 * 글자 `ch`의 자모별 마스크. 못 쪼개면 null — 부르는 쪽이 네모로 물러선다.
 * 같은 글자는 한 번만 계산한다.
 */
export function jamoMasks(ch: string): JamoMaskSet | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get(ch);
  if (hit !== undefined) return hit;

  const result = build(ch);
  cache.set(ch, result);
  return result;
}

function build(ch: string): JamoMaskSet | null {
  const parts = decompose(ch);
  if (!parts?.cho || !parts.jung) return null;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = `${EM}px ${prayerFontFamily()}`;
  const m = measure.measureText(ch);
  // 글자가 실제로 차지하는 잉크 상자. 원점(가로)과 기준선(세로)에서 잰 거리다.
  const left = Math.ceil(m.actualBoundingBoxLeft) + PAD;
  const right = Math.ceil(m.actualBoundingBoxRight) + PAD;
  const ascent = Math.ceil(m.actualBoundingBoxAscent) + PAD;
  const descent = Math.ceil(m.actualBoundingBoxDescent) + PAD;
  const w = left + right;
  const h = ascent + descent;
  if (w <= 0 || h <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = `${EM}px ${prayerFontFamily()}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#000";
  ctx.fillText(ch, left, ascent);

  const { labels, strokes } = findStrokes(ctx.getImageData(0, 0, w, h).data, w, h);
  if (!strokes.length) return null;

  const owner = assignPixels(strokes, labels, w, h, parts.jung, Boolean(parts.jong));
  if (!owner) return null;

  const count = parts.jong ? 3 : 2;
  const urls: string[] = [];
  for (let i = 0; i < count; i++) urls.push(maskUrl(owner, i, w, h));

  // 셀은 line-height 1이라 높이가 1em이고, 기준선은 반 leading만큼 내려와 있다.
  const a = m.fontBoundingBoxAscent / EM;
  const d = m.fontBoundingBoxDescent / EM;
  const baseline = (1 + a - d) / 2;

  return {
    urls,
    left: -left / EM,
    top: baseline - ascent / EM,
    width: w / EM,
    height: h / EM,
  };
}
