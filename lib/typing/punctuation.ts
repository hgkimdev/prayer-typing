/**
 * 기호는 치지 않는다.
 *
 * 기도문을 외듯 옮겨 적는 것이 목적이라, 마침표 자리를 더듬는 일은 연습이 아니라 방해다.
 * 그렇다고 기호를 입력에 대신 끼워 넣지는 않는다 — 그러면 조합 중인 글자가 기호에
 * 떠밀려 확정되고, 백스페이스가 자모 단위로 무르지 못한다. 입력은 손으로 친 글자만
 * 담고, 기호는 화면에서만 채워진 것처럼 보이게 한다.
 */

/** 글자도 숫자도 공백도 아니면 기호로 본다. 마침표·쉼표·따옴표·괄호. */
const PUNCTUATION = /[^\p{L}\p{N}\s]/u;

export function isPunctuation(ch: string | undefined): boolean {
  return ch !== undefined && PUNCTUATION.test(ch);
}

/** 목표에서 손으로 쳐야 할 글자만 남긴 것. 목표 자리와 오갈 수 있게 색인을 함께 든다. */
export type Typable = {
  /** 쳐야 할 글자들 */
  chars: string[];
  /** 이어 붙인 것. 입력과 통째로 견줄 때 쓴다. */
  text: string;
  /** `chars[k]`가 목표의 몇 번째 글자인가 */
  at: number[];
  /** 목표 `i`번째 앞에 놓인, 쳐야 할 글자의 수. 목표보다 한 칸 길다. */
  before: number[];
};

export function typableOf(target: string): Typable {
  const targetChars = [...target];
  const chars: string[] = [];
  const at: number[] = [];
  const before: number[] = [];

  for (let i = 0; i < targetChars.length; i++) {
    before.push(chars.length);
    if (isPunctuation(targetChars[i])) continue;
    chars.push(targetChars[i]);
    at.push(i);
  }
  before.push(chars.length);

  return { chars, text: chars.join(""), at, before };
}
