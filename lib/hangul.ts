/**
 * 한글 음절 분해와 "조합 중인 글자가 목표 글자가 될 수 있는가" 판정.
 *
 * 타자 판정의 심장. IME가 조합하는 도중의 글자(목표가 "성"일 때 거쳐 가는 ㅅ, 서)를
 * 오타로 세면 한글 타자 연습 자체가 성립하지 않는다.
 */

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_END = 0xd7a3;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

// 인덱스 = 유니코드 한글 음절 계산에 쓰는 초성/중성/종성 번호.
// 값은 호환 자모(U+3131–U+3163)라, 단독으로 입력된 자모와 그대로 비교된다.
const CHO = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const JUNG = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
// 0번은 "받침 없음"이라 null이다. 배열로 두는 편이 더미 문자를 끼워 넣는 것보다 안전하다.
const JONG: (string | null)[] = [
  null,
  ...[..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"],
];

// 2벌식에서 두 번 눌러 만들어지는 복합 모음/겹받침.
// ㅆ·ㄲ 같은 쌍자음은 shift로 한 번에 입력되므로 여기 없다.
const JUNG_COMPOSE: Record<string, string> = {
  ㅗㅏ: "ㅘ",
  ㅗㅐ: "ㅙ",
  ㅗㅣ: "ㅚ",
  ㅜㅓ: "ㅝ",
  ㅜㅔ: "ㅞ",
  ㅜㅣ: "ㅟ",
  ㅡㅣ: "ㅢ",
};
const JONG_COMPOSE: Record<string, string> = {
  ㄱㅅ: "ㄳ",
  ㄴㅈ: "ㄵ",
  ㄴㅎ: "ㄶ",
  ㄹㄱ: "ㄺ",
  ㄹㅁ: "ㄻ",
  ㄹㅂ: "ㄼ",
  ㄹㅅ: "ㄽ",
  ㄹㅌ: "ㄾ",
  ㄹㅍ: "ㄿ",
  ㄹㅎ: "ㅀ",
  ㅂㅅ: "ㅄ",
};

/** 복합 자모 → 구성 요소 두 개. 역방향 조회용. */
function invert(table: Record<string, string>): Record<string, [string, string]> {
  const out: Record<string, [string, string]> = {};
  for (const [pair, composed] of Object.entries(table)) {
    const [first, second] = [...pair];
    out[composed] = [first, second];
  }
  return out;
}

const JUNG_PARTS = invert(JUNG_COMPOSE);
const JONG_PARTS = invert(JONG_COMPOSE);

export type Decomposed = {
  /** 초성. 모음만 단독 입력된 상태면 null. */
  cho: string | null;
  /** 중성. 자음만 단독 입력된 상태면 null. */
  jung: string | null;
  /** 받침. 없으면 null. */
  jong: string | null;
};

export function isSyllable(ch: string): boolean {
  const code = ch.codePointAt(0);
  return code !== undefined && code >= SYLLABLE_BASE && code <= SYLLABLE_END;
}

/**
 * 한 글자를 자모로 분해한다. 한글이 아니면 null.
 *
 * 완성된 음절("성")뿐 아니라 조합 도중에만 나타나는 단독 자모("ㅅ")도 받는다.
 * 단독 자모는 IME가 초성 하나만 입력된 상태를 그렇게 내보내기 때문에 반드시 필요하다.
 */
export function decompose(ch: string): Decomposed | null {
  if (!ch) return null;

  if (isSyllable(ch)) {
    const code = ch.codePointAt(0)! - SYLLABLE_BASE;
    const jong = code % JONG_COUNT;
    const jung = Math.floor(code / JONG_COUNT) % JUNG_COUNT;
    const cho = Math.floor(code / (JONG_COUNT * JUNG_COUNT));
    return { cho: CHO[cho], jung: JUNG[jung], jong: JONG[jong] };
  }

  // 단독 자모. 자음은 초성 자리, 모음은 중성 자리로 본다.
  if (CHO.includes(ch)) return { cho: ch, jung: null, jong: null };
  if (JUNG.includes(ch)) return { cho: null, jung: ch, jong: null };

  return null;
}

/** `from`이 한 번 더 입력되어 `to`가 될 수 있는가. (ㅗ → ㅘ, ㄹ → ㄺ) */
function extendsTo(
  parts: Record<string, [string, string]>,
  from: string,
  to: string | null,
): boolean {
  return to !== null && parts[to]?.[0] === from;
}

/**
 * 조합 중인 글자 `partial`이 목표 글자 `target`이 될 수 있는가.
 *
 * `nextTarget`은 연음 때문에 필요하다. "아버지"를 칠 때 ㅇㅏ 다음 ㅂ을 누르면
 * IME는 일단 "압"을 만든다 — 받침 ㅂ이 다음 글자의 초성으로 넘어갈 수 있기 때문이다.
 * 다음 글자를 보지 않으면 한국어 문장 거의 전부가 오타로 번쩍인다.
 */
export function canBecome(partial: string, target: string, nextTarget?: string): boolean {
  const t = decompose(target);
  // 목표가 완성된 음절이 아니면(공백·문장부호·단독 자모) 정확히 같아야 한다.
  if (!t || !t.cho || !t.jung) return partial === target;

  const p = decompose(partial);
  if (!p) return false;

  // 초성만 찍힌 상태: ㅅ → 성
  if (!p.jung) return p.cho === t.cho;
  // 모음만 찍힌 상태는 어떤 음절로도 자라지 못한다.
  if (!p.cho) return false;

  if (p.cho !== t.cho) return false;

  if (p.jung !== t.jung) {
    // 받침까지 찍어 놓고 모음이 다르면 더 손쓸 수 없다.
    if (p.jong) return false;
    return extendsTo(JUNG_PARTS, p.jung, t.jung);
  }

  if (!p.jong) return true; // 받침을 아직 안 찍었을 뿐
  if (p.jong === t.jong) return true;
  if (extendsTo(JONG_PARTS, p.jong, t.jong)) return true; // ㄹ → ㄺ

  // 연음: 받침이 다음 글자의 초성으로 넘어간다.
  // 겹받침이면 앞 자음은 남고 뒤 자음만 넘어간다. (흙 + ㅣ → 흘기)
  const parts = JONG_PARTS[p.jong];
  const stays = parts ? parts[0] : null;
  const moves = parts ? parts[1] : p.jong;
  if (stays !== t.jong) return false;
  if (!nextTarget) return false;

  return decompose(nextTarget)?.cho === moves;
}

export type JamoState =
  /** 다 찍었다 */
  | "done"
  /** 시작은 했는데 아직 덜 됐다. ㅗ→ㅘ, ㄹ→ㄺ */
  | "partial"
  /** 아직 안 찍었다 */
  | "pending"
  /** 틀렸다 */
  | "wrong";

export type JamoStep = { jamo: string; state: JamoState };

export type JamoProgress = {
  /** 목표 글자의 초성·중성·종성 각각이 지금 어디까지 왔는가 */
  steps: JamoStep[];
  /** 연음으로 다음 글자에 넘어간 자음. 없으면 null */
  carry: string | null;
};

/**
 * 조합 중인 글자가 목표 글자의 자모 중 어디까지 왔는지.
 *
 * `canBecome`은 참/거짓만 돌려주므로 "강"을 칠 때 ㄱ만 눌러도 글자 전체가 한 색이 된다.
 * 어디까지 왔는지 눈으로 보려면 자모 단위로 쪼갠 이 결과가 필요하다.
 */
export function jamoProgress(partial: string, target: string): JamoProgress | null {
  const t = decompose(target);
  // 음절이 아니면(공백·문장부호) 쪼갤 것이 없다.
  if (!t || !t.cho || !t.jung) return null;

  const steps: JamoStep[] = [
    { jamo: t.cho, state: "pending" },
    { jamo: t.jung, state: "pending" },
  ];
  if (t.jong) steps.push({ jamo: t.jong, state: "pending" });

  const done = (carry: string | null = null): JamoProgress => ({ steps, carry });

  const p = decompose(partial);
  if (!p) return done();

  if (p.cho) steps[0].state = p.cho === t.cho ? "done" : "wrong";
  if (steps[0].state !== "done") return done();
  if (!p.jung) return done();

  if (p.jung === t.jung) steps[1].state = "done";
  else if (JUNG_PARTS[t.jung]?.[0] === p.jung) steps[1].state = "partial";
  else steps[1].state = "wrong";
  if (steps[1].state !== "done") return done();

  if (!p.jong) return done();
  if (p.jong === t.jong) {
    steps[2].state = "done";
    return done();
  }
  if (t.jong && JONG_PARTS[t.jong]?.[0] === p.jong) {
    steps[2].state = "partial";
    return done();
  }

  // 받침이 이 글자에 맞지 않는다 — 연음으로 다음 글자에 넘어가는 경우인지 본다.
  const parts = JONG_PARTS[p.jong];
  const stays = parts ? parts[0] : null;
  const moves = parts ? parts[1] : p.jong;
  if (stays === t.jong) {
    if (t.jong) steps[2].state = "done";
    return done(moves);
  }

  if (t.jong) steps[2].state = "wrong";
  return done();
}

/** 모음이 초성 오른쪽에 붙는가(ㅏ), 아래에 깔리는가(ㅗ), 둘 다인가(ㅘ). */
export type VowelShape = "vertical" | "horizontal" | "mixed";

const JUNG_VERTICAL = "ㅏㅐㅑㅒㅓㅔㅕㅖㅣ";
const JUNG_HORIZONTAL = "ㅗㅛㅜㅠㅡ";

/**
 * 중성이 글자 네모 안에서 어느 자리를 차지하는지.
 *
 * 글자를 자모 영역으로 잘라 칠하려면 초성과 중성의 경계가 세로선인지 가로선인지
 * 알아야 한다. ㅘ·ㅢ 같은 복합 모음은 오른쪽과 아래를 함께 쓰므로 따로 둔다.
 */
export function vowelShape(jung: string): VowelShape {
  if (JUNG_VERTICAL.includes(jung)) return "vertical";
  if (JUNG_HORIZONTAL.includes(jung)) return "horizontal";
  return "mixed";
}

// ㅓ·ㅕ처럼 삐침이 초성 쪽(왼쪽)으로 뻗는 모음. ㅏ·ㅐ는 반대쪽으로 뻗는다.
const JUNG_LEFT_TICK = "ㅓㅔㅕㅖㅝㅞ";

/**
 * 모음의 짧은 삐침이 초성 쪽으로 뻗는가.
 *
 * 초성과 모음이 서로 닿아 있을 때 둘을 가르는 선을 어디에 둘지가 이것으로 갈린다.
 * 삐침이 초성 쪽으로 오면 그 삐침은 모음의 것이므로 선을 더 왼쪽에 둬야 한다.
 */
export function hasLeftTick(jung: string): boolean {
  return JUNG_LEFT_TICK.includes(jung);
}

/**
 * 자모를 음절로 합친다. 초성·중성이 다 있어야 음절이 되고,
 * 하나만 있으면 그 낱자를 그대로 돌려준다. (조합 도중의 "ㄱ", "ㅏ")
 */
export function composeSyllable(
  cho: string | null,
  jung: string | null,
  jong: string | null,
): string {
  if (cho && jung) {
    const index =
      (CHO.indexOf(cho) * JUNG_COUNT + JUNG.indexOf(jung)) * JONG_COUNT + JONG.indexOf(jong);
    return String.fromCodePoint(SYLLABLE_BASE + index);
  }
  return cho ?? jung ?? "";
}

/** 두 모음이 하나로 합쳐지는가. ㅗ+ㅏ→ㅘ. 안 되면 null. */
export function joinJung(first: string, second: string): string | null {
  return JUNG_COMPOSE[first + second] ?? null;
}

/** 두 자음이 겹받침이 되는가. ㄱ+ㅅ→ㄳ. 안 되면 null. */
export function joinJong(first: string, second: string): string | null {
  return JONG_COMPOSE[first + second] ?? null;
}

/** 겹받침을 둘로 가른다. 홑받침이면 null. */
export function splitJong(jong: string): [string, string] | null {
  return JONG_PARTS[jong] ?? null;
}

/** 이 자음이 받침 자리에 올 수 있는가. ㄸ·ㅃ·ㅉ은 못 온다. */
export function canBeJong(consonant: string): boolean {
  return JONG.includes(consonant);
}
