import { canBecome, jamoProgress, type JamoStep } from "@/lib/hangul";

export type CharState =
  /** 아직 입력이 닿지 않은 글자 */
  | "pending"
  /** 확정된 정타 */
  | "correct"
  /** 확정된 오타 */
  | "wrong"
  /** IME가 조합 중 — 아직 목표가 될 가능성이 남아 있다 */
  | "composing";

export type LineComparison = {
  states: CharState[];
  /** 목표 길이를 넘겨 친 글자 수 */
  overflow: number;
  /** 확정적으로 틀린 위치. 조합 중인 글자는 들어가지 않는다. */
  wrongIndexes: number[];
  /** 입력이 목표와 완전히 같은가 */
  done: boolean;
  /**
   * 자모 단위 진행도. 조합 중인 칸에만 들어간다.
   * 연음이 일어나면 다음 칸도 들어간다 — 받침이 이미 그쪽 초성으로 넘어갔기 때문에.
   */
  jamoCells: Record<number, JamoStep[]>;
};

/**
 * 입력 한 줄을 목표 한 줄과 대조한다.
 *
 * 순수 함수라 브라우저 없이 검증할 수 있다. IME 이벤트 처리는 훅이 맡고,
 * 여기는 "지금 값이 이러면 화면이 이래야 한다"만 책임진다.
 */
export function compareLine(input: string, target: string, isComposing: boolean): LineComparison {
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

  const jamoCells: Record<number, JamoStep[]> = {};
  if (composingIndex >= 0 && composingIndex < targetChars.length) {
    const progress = jamoProgress(inputChars[composingIndex], targetChars[composingIndex]);
    if (progress) {
      jamoCells[composingIndex] = progress.steps;
      // 넘어간 자음은 이미 다음 글자의 초성이다. 그 칸도 진행 중으로 보여 준다.
      const nextIndex = composingIndex + 1;
      if (progress.carry && nextIndex < targetChars.length) {
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
    jamoCells,
  };
}
