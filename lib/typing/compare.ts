import {
  canBecome,
  composeSyllable,
  decompose,
  jamoProgress,
  splitJong,
  type JamoStep,
} from "@/lib/hangul";
import { isPunctuation, typableOf } from "./punctuation";

export type CharState =
  /** 아직 입력이 닿지 않은 글자 */
  | "pending"
  /** 확정된 정타 */
  | "correct"
  /** 확정된 오타 */
  | "wrong"
  /** IME가 조합 중 — 아직 목표가 될 가능성이 남아 있다 */
  | "composing";

export type TextComparison = {
  states: CharState[];
  /** 커서가 놓일 목표 자리. 기호는 건너뛴다. */
  caretIndex: number;
  /** 지금까지 시도한 자리 수. 채워 준 기호는 빠져 있다. */
  attempted: number;
  /** 목표 길이를 넘겨 친 글자 수 */
  overflow: number;
  /** 확정적으로 틀린 위치. 조합 중인 글자는 들어가지 않는다. */
  wrongIndexes: number[];
  /** 입력이 목표와 완전히 같은가 */
  done: boolean;
  /**
   * 목표 글자 대신 그 칸에 그릴 글자. 조합 중인 칸에만 들어간다.
   * 연음이 일어나면 다음 칸도 들어간다 — 받침이 이미 그쪽 초성으로 넘어갔기 때문에.
   * 그 다음 칸이 다음 줄의 첫 글자일 수도 있다. 여기서는 줄을 구분하지 않는다.
   */
  composedCells: Record<number, string>;
  /**
   * 자모 단위 진행도. 칸 구성은 `composedCells`와 같다.
   * 화면은 글자를 쪼개지 않으므로 이것은 판정을 눈으로 확인하는 실험실용이다.
   */
  jamoCells: Record<number, JamoStep[]>;
};

/**
 * 지금까지 친 글자를 목표 전체와 대조한다.
 *
 * 기도문 한 편을 통째로 받는다. 줄은 화면에 나누어 보이는 방식일 뿐이라 여기서는
 * 다루지 않는다 — 그 덕에 받침이 다음 줄 첫 글자로 넘어가는 연음도 그냥 "다음 글자"다.
 *
 * 기호는 입력에 들어오지 않으므로 `input`의 k번째는 목표의 k번째가 아니라 **쳐야 할
 * 글자의** k번째다. 판정은 그쪽에서 하고, 화면에 돌려줄 때만 목표 자리로 옮긴다.
 *
 * 순수 함수라 브라우저 없이 검증할 수 있다. 키 입력과 글자 만들기는 오토마타가 맡고,
 * 여기는 "지금 값이 이러면 화면이 이래야 한다"만 책임진다.
 */
export function compareText(
  input: string,
  target: string,
  isComposing: boolean,
): TextComparison {
  const inputChars = [...input];
  const targetChars = [...target];
  const typable = typableOf(target);
  const states: CharState[] = targetChars.map(() => "pending");
  const wrongIndexes: number[] = [];

  // 조합은 언제나 마지막 글자에서 일어난다.
  const composingSlot = isComposing ? inputChars.length - 1 : -1;
  const shared = Math.min(inputChars.length, typable.chars.length);

  /** 연음이 닿을 다음 글자. 사이에 기호가 끼어 있으면 이어지지 않는다. */
  const nextOf = (k: number) =>
    typable.at[k + 1] === typable.at[k] + 1 ? typable.chars[k + 1] : undefined;

  // 앞에서부터 몇 글자가 정확한가. 기호에 불이 들어올 자리를 이것이 정한다.
  let matched = 0;
  while (matched < shared && inputChars[matched] === typable.chars[matched]) matched++;

  for (let k = 0; k < shared; k++) {
    const i = typable.at[k];
    if (k === composingSlot) {
      // 조합 중인 글자는 목표가 될 수 있는 한 중립으로 두고 오타로 세지 않는다.
      states[i] = canBecome(inputChars[k], typable.chars[k], nextOf(k)) ? "composing" : "wrong";
      continue;
    }
    if (inputChars[k] === typable.chars[k]) {
      states[i] = "correct";
    } else {
      states[i] = "wrong";
      wrongIndexes.push(i);
    }
  }

  // 기호는 손으로 치지 않는다. 앞이 다 맞는 동안 저절로 채워진 것처럼 불이 들어온다.
  for (let i = 0; i < targetChars.length; i++) {
    if (isPunctuation(targetChars[i]) && typable.before[i] <= matched) states[i] = "correct";
  }

  const composedCells: Record<number, string> = {};
  const jamoCells: Record<number, JamoStep[]> = {};
  if (composingSlot >= 0 && composingSlot < typable.chars.length) {
    const i = typable.at[composingSlot];
    const typed = inputChars[composingSlot];
    // 조합 중인 칸에는 목표가 아니라 지금 만들어진 글자를 그린다. 글자가 ㅎ→하→한으로
    // 자라나는 것 자체가 진행도라, 한 글자를 자모 자리로 잘라 칠할 일이 없다.
    composedCells[i] = typed;

    const progress = jamoProgress(typed, typable.chars[composingSlot]);
    if (progress) {
      jamoCells[i] = progress.steps;
      const nextSlot = composingSlot + 1;
      // 연음이 일어났다면 넘어간 자음은 이미 다음 글자의 초성이다. 화면에도 그렇게
      // 나누어 그린다 — 이 칸에는 남는 글자만, 다음 칸에 넘어간 자음. (흙 → 흘 ㄱ)
      if (progress.carry && states[i] === "composing" && nextOf(composingSlot) !== undefined) {
        const j = typable.at[nextSlot];
        const p = decompose(typed);
        const stays = p?.jong ? (splitJong(p.jong)?.[0] ?? null) : null;
        composedCells[i] = composeSyllable(p?.cho ?? null, p?.jung ?? null, stays);
        composedCells[j] = progress.carry;
        states[j] = "composing";

        const carried = jamoProgress(progress.carry, typable.chars[nextSlot]);
        if (carried) jamoCells[j] = carried.steps;
      }
    }
  }

  return {
    states,
    // 커서는 다음에 칠 글자 위에 선다. 기호를 지나쳐 그 너머에 놓인다.
    caretIndex: typable.at[inputChars.length] ?? targetChars.length,
    attempted: shared,
    overflow: Math.max(0, inputChars.length - typable.chars.length),
    wrongIndexes,
    done: input === typable.text,
    composedCells,
    jamoCells,
  };
}
