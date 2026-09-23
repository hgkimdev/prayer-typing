import {
  canBeJong,
  composeSyllable,
  joinJong,
  joinJung,
  splitJong,
} from "@/lib/hangul";

/**
 * 두벌식 한글 오토마타.
 *
 * OS의 IME를 타지 않고 물리 키를 직접 받아 글자를 만든다. IME에 기대면 완성된
 * 음절만 건네받기 때문에 "지금 이 글자가 목표가 될 수 있는가"를 매번 역추론해야
 * 하고, 그 추론이 줄 경계·겹받침·브라우저 차이마다 어긋난다. 키를 직접 보면
 * 사용자가 무엇을 눌렀는지 그냥 안다.
 *
 * `KeyboardEvent.code`(물리 키 자리)로 읽으므로 한/영 모드와 무관하다.
 */

/** 두벌식 자판. [기본, Shift] 순서. */
const LAYOUT: Record<string, [string, string]> = {
  KeyQ: ["ㅂ", "ㅃ"], KeyW: ["ㅈ", "ㅉ"], KeyE: ["ㄷ", "ㄸ"], KeyR: ["ㄱ", "ㄲ"],
  KeyT: ["ㅅ", "ㅆ"], KeyY: ["ㅛ", "ㅛ"], KeyU: ["ㅕ", "ㅕ"], KeyI: ["ㅑ", "ㅑ"],
  KeyO: ["ㅐ", "ㅒ"], KeyP: ["ㅔ", "ㅖ"],
  KeyA: ["ㅁ", "ㅁ"], KeyS: ["ㄴ", "ㄴ"], KeyD: ["ㅇ", "ㅇ"], KeyF: ["ㄹ", "ㄹ"],
  KeyG: ["ㅎ", "ㅎ"], KeyH: ["ㅗ", "ㅗ"], KeyJ: ["ㅓ", "ㅓ"], KeyK: ["ㅏ", "ㅏ"],
  KeyL: ["ㅣ", "ㅣ"],
  KeyZ: ["ㅋ", "ㅋ"], KeyX: ["ㅌ", "ㅌ"], KeyC: ["ㅊ", "ㅊ"], KeyV: ["ㅍ", "ㅍ"],
  KeyB: ["ㅠ", "ㅠ"], KeyN: ["ㅜ", "ㅜ"], KeyM: ["ㅡ", "ㅡ"],
};

const VOWELS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";

export function isVowel(jamo: string): boolean {
  return VOWELS.includes(jamo);
}

/** 물리 키 자리를 자모로. 한글 자판에 없는 키면 null. */
export function keyToJamo(code: string, shift: boolean): string | null {
  const entry = LAYOUT[code];
  return entry ? entry[shift ? 1 : 0] : null;
}

/**
 * 오토마타의 상태.
 *
 * 값 타입이라 그대로 복사해 비교할 수 있고, 되돌리기도 예전 값을 들고 있으면 된다.
 */
export type ImeState = {
  /** 이미 확정된 글자들 */
  committed: string;
  /** 조합 중인 글자의 자모. 셋 다 null이면 조합 중이 아니다. */
  cho: string | null;
  jung: string | null;
  jong: string | null;
};

export const EMPTY_IME: ImeState = { committed: "", cho: null, jung: null, jong: null };

/** 조합 중인 글자 하나. 조합 중이 아니면 빈 문자열. */
export function composingChar(s: ImeState): string {
  return composeSyllable(s.cho, s.jung, s.jong);
}

/** 화면에 보이는 전체 글자. 확정된 것 + 조합 중인 것. */
export function imeText(s: ImeState): string {
  return s.committed + composingChar(s);
}

export function isComposing(s: ImeState): boolean {
  return s.cho !== null || s.jung !== null || s.jong !== null;
}

/** 조합 중인 글자를 확정하고 빈 조합으로 돌아간다. */
function commit(s: ImeState): ImeState {
  return { committed: s.committed + composingChar(s), cho: null, jung: null, jong: null };
}

/** 자모 한 개를 누른다. */
export function pressJamo(s: ImeState, jamo: string): ImeState {
  return isVowel(jamo) ? pressVowel(s, jamo) : pressConsonant(s, jamo);
}

function pressConsonant(s: ImeState, c: string): ImeState {
  // 조합이 비었거나 초성만 있거나 모음만 있으면 새 글자를 시작한다.
  if (!s.cho && !s.jung) return { ...s, cho: c };
  if (s.cho && !s.jung) return { ...commit(s), cho: c };
  if (!s.cho && s.jung) return { ...commit(s), cho: c };

  // 받침 자리를 채운다.
  if (!s.jong) {
    return canBeJong(c) ? { ...s, jong: c } : { ...commit(s), cho: c };
  }
  const joined = joinJong(s.jong, c);
  return joined ? { ...s, jong: joined } : { ...commit(s), cho: c };
}

function pressVowel(s: ImeState, v: string): ImeState {
  if (!s.cho && !s.jung) return { ...s, jung: v };
  if (s.cho && !s.jung) return { ...s, jung: v };

  if (!s.jong) {
    const joined = joinJung(s.jung!, v);
    // 합쳐지지 않는 모음이 이어지면 홀로 선 모음으로 새 글자를 연다.
    return joined ? { ...s, jung: joined } : { ...commit(s), jung: v };
  }

  // 연음 — 받침이 다음 글자의 초성으로 넘어간다. 겹받침이면 뒤 자음만 간다.
  const parts = splitJong(s.jong);
  const moved = parts ? parts[1] : s.jong;
  const stays = parts ? parts[0] : null;
  const left = commit({ ...s, jong: stays });
  return { committed: left.committed, cho: moved, jung: v, jong: null };
}

/** 한글이 아닌 글자(공백·문장부호·영문). 조합을 닫고 그대로 붙인다. */
export function pressLiteral(s: ImeState, ch: string): ImeState {
  const closed = commit(s);
  return { ...closed, committed: closed.committed + ch };
}

/**
 * 백스페이스. 조합 중이면 자모 하나만 물러난다 — IME마다 다르던 동작이
 * 여기서는 언제나 같다.
 */
export function pressBackspace(s: ImeState): ImeState {
  if (s.jong) {
    const parts = splitJong(s.jong);
    return { ...s, jong: parts ? parts[0] : null };
  }
  if (s.jung) {
    const parts = splitJungOf(s.jung);
    return { ...s, jung: parts ? parts[0] : null };
  }
  if (s.cho) return { ...s, cho: null };
  return { ...s, committed: [...s.committed].slice(0, -1).join("") };
}

/** 복합 모음을 둘로 가른다. 홑모음이면 null. */
function splitJungOf(jung: string): [string, string] | null {
  for (const first of "ㅗㅜㅡ") {
    for (const second of "ㅏㅐㅓㅔㅣ") {
      if (joinJung(first, second) === jung) return [first, second];
    }
  }
  return null;
}
