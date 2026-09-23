import {
  canBecome,
  composeSyllable,
  decompose,
  jamoProgress,
  splitJong,
  type JamoStep,
} from "@/lib/hangul";

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
  const states: CharState[] = targetChars.map(() => "pending");
  const wrongIndexes: number[] = [];

  // 조합은 언제나 마지막 글자에서 일어난다.
  const composingIndex = isComposing ? inputChars.length - 1 : -1;
  const shared = Math.min(inputChars.length, targetChars.length);

  for (let i = 0; i < shared; i++) {
    if (i === composingIndex) {
      // 조합 중인 글자는 목표가 될 수 있는 한 중립으로 두고 오타로 세지 않는다.
      states[i] = canBecome(inputChars[i], targetChars[i], targetChars[i + 1])
        ? "composing"
        : "wrong";
      continue;
    }
    if (inputChars[i] === targetChars[i]) {
      states[i] = "correct";
    } else {
      states[i] = "wrong";
      wrongIndexes.push(i);
    }
  }

  const composedCells: Record<number, string> = {};
  const jamoCells: Record<number, JamoStep[]> = {};
  if (composingIndex >= 0 && composingIndex < targetChars.length) {
    const typed = inputChars[composingIndex];
    // 조합 중인 칸에는 목표가 아니라 지금 만들어진 글자를 그린다. 글자가 ㅎ→하→한으로
    // 자라나는 것 자체가 진행도라, 한 글자를 자모 자리로 잘라 칠할 일이 없다.
    composedCells[composingIndex] = typed;

    const progress = jamoProgress(typed, targetChars[composingIndex]);
    if (progress) {
      jamoCells[composingIndex] = progress.steps;
      const nextIndex = composingIndex + 1;
      // 연음이 일어났다면 넘어간 자음은 이미 다음 글자의 초성이다. 화면에도 그렇게
      // 나누어 그린다 — 이 칸에는 남는 글자만, 다음 칸에 넘어간 자음. (흙 → 흘 ㄱ)
      if (
        progress.carry &&
        states[composingIndex] === "composing" &&
        nextIndex < targetChars.length
      ) {
        const p = decompose(typed);
        const stays = p?.jong ? (splitJong(p.jong)?.[0] ?? null) : null;
        composedCells[composingIndex] = composeSyllable(p?.cho ?? null, p?.jung ?? null, stays);
        composedCells[nextIndex] = progress.carry;
        states[nextIndex] = "composing";

        const carried = jamoProgress(progress.carry, targetChars[nextIndex]);
        if (carried) jamoCells[nextIndex] = carried.steps;
      }
    }
  }

  return {
    states,
    overflow: Math.max(0, inputChars.length - targetChars.length),
    wrongIndexes,
    done: input === target,
    composedCells,
    jamoCells,
  };
}
