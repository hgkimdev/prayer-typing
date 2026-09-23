import { imeText, isComposing, pressBackspace, pressLiteral, type ImeState } from "./dubeolsik";

/**
 * 목표에 놓인 기호는 치지 않아도 채워진다.
 *
 * 기도문을 외듯 옮겨 적는 것이 목적이라, 마침표 자리를 더듬는 일은 연습이 아니라 방해다.
 * 한글과 영문만 손으로 치고 나머지는 우리가 넣는다.
 */

/** 글자도 숫자도 공백도 아니면 기호로 본다. 마침표·쉼표·따옴표·괄호. */
const PUNCTUATION = /[^\p{L}\p{N}\s]/u;

export function isPunctuation(ch: string | undefined): boolean {
  return ch !== undefined && PUNCTUATION.test(ch);
}

/**
 * 다음에 올 기호를 채워 넣는다. 연달아 붙어 있으면 연달아 채운다.
 *
 * 여기까지 한 글자도 틀리지 않았을 때만 채운다 — 오타 뒤에 기호를 덤으로 주지 않는다.
 * 조합 중인 글자가 목표와 같아야 하므로, 덜 만들어진 글자를 기호가 앞질러 확정시키는 일도 없다.
 */
export function fillPunctuation(state: ImeState, target: string): ImeState {
  const targetChars = [...target];
  let next = state;
  for (;;) {
    const typed = [...imeText(next)];
    const expected = targetChars[typed.length];
    if (!isPunctuation(expected)) return next;
    if (typed.some((ch, i) => ch !== targetChars[i])) return next;
    next = pressLiteral(next, expected);
  }
}

/**
 * 백스페이스 한 번.
 *
 * 채워 넣은 기호는 내가 친 것이 아니니 무를 것도 없다. 지나쳐 그 앞 글자를 무른다 —
 * 안 그러면 한 번 눌러도 아무 일도 일어나지 않은 것처럼 보인다.
 */
export function eraseOne(state: ImeState): ImeState {
  let next = state;
  while (!isComposing(next) && isPunctuation([...imeText(next)].at(-1))) {
    next = pressBackspace(next);
  }
  return pressBackspace(next);
}
