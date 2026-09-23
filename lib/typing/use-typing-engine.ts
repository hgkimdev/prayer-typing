"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { compareLine, type LineComparison } from "./compare";

export type TypingStats = {
  /** 시도한 위치 대비 정타 비율 (0–1) */
  accuracy: number;
  /** 분당 글자 수. 자모 단위로 세는 "타수"와는 다른 값이라 이름을 구분한다. */
  cpm: number;
  elapsedMs: number;
  typedChars: number;
  wrongCount: number;
};

export type TypingEngine = {
  lineIndex: number;
  input: string;
  isComposing: boolean;
  comparison: LineComparison;
  /** 줄을 다 쳤는데 조합이 안 끝나 대기 중 — 화면에 "Enter" 힌트를 띄울 때 쓴다 */
  awaitingCommit: boolean;
  finished: boolean;
  stats: TypingStats;
  reset: () => void;
  /** 입력 요소에 그대로 펴 넣는다 */
  inputProps: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCompositionStart: () => void;
    onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    autoCapitalize: "off";
    autoComplete: "off";
    autoCorrect: "off";
    spellCheck: false;
  };
};

export function useTypingEngine(lines: string[]): TypingEngine {
  const [lineIndex, setLineIndex] = useState(0);
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  /** 확정된 줄에서 넘어온 글자 수 */
  const [committedChars, setCommittedChars] = useState(0);
  /** "줄:위치" — 한 번이라도 틀렸던 자리. 백스페이스로 고쳐도 중복 가산되지 않는다. */
  const [wrongCells, setWrongCells] = useState<ReadonlySet<string>>(() => new Set());

  const target = lines[lineIndex] ?? "";
  const comparison = useMemo(
    () => compareLine(input, target, isComposing),
    [input, target, isComposing],
  );

  const reset = useCallback(() => {
    setLineIndex(0);
    setInput("");
    setIsComposing(false);
    setFinished(false);
    setStartedAt(null);
    setElapsedMs(0);
    setCommittedChars(0);
    setWrongCells(new Set());
  }, []);

  /** 값이 바뀔 때마다 오타 위치를 누적하고, 줄이 끝났으면 다음 줄로 넘긴다. */
  const apply = useCallback(
    (value: string, composing: boolean) => {
      if (value.length > 0) setStartedAt((prev) => prev ?? performance.now());

      const result = compareLine(value, target, composing);
      if (result.wrongIndexes.length > 0) {
        setWrongCells((prev) => {
          const next = new Set(prev);
          for (const i of result.wrongIndexes) next.add(`${lineIndex}:${i}`);
          return next.size === prev.size ? prev : next;
        });
      }

      setInput(value);
      setIsComposing(composing);

      // 조합이 열려 있는 동안에는 넘기지 않는다. 지금 입력을 비우면 IME가
      // 조합 중이던 글자를 다음 줄에 쏟아붓는다.
      if (composing || !result.done) return;

      setCommittedChars((prev) => prev + [...target].length);

      if (lineIndex + 1 >= lines.length) {
        setFinished(true);
        return;
      }
      setLineIndex(lineIndex + 1);
      setInput("");
    },
    [lineIndex, lines.length, target],
  );

  // 경과 시간은 입력과 무관하게 흘러야 HUD가 멈춰 보이지 않는다.
  useEffect(() => {
    if (startedAt === null || finished) return;
    const tick = () => setElapsedMs(performance.now() - startedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [startedAt, finished]);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // 우리가 들고 있는 상태보다 네이티브 플래그가 정확하다. compositionend와
      // input 이벤트의 순서가 브라우저마다 다르기 때문에 이쪽을 믿는다.
      const native = e.nativeEvent as InputEvent;
      apply(e.target.value, Boolean(native.isComposing));
    },
    [apply],
  );

  const onCompositionStart = useCallback(() => setIsComposing(true), []);

  const onCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      apply(e.currentTarget.value, false);
    },
    [apply],
  );

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter는 조합을 확정시키는 용도로만 쓴다. 글자는 절대 keydown에서 읽지 않는다 —
    // IME가 만들어내는 글자는 keydown에 나타나지 않는다.
    if (e.key === "Enter") e.preventDefault();
  }, []);

  const attempted = committedChars + comparison.states.filter((s) => s !== "pending").length;
  const wrongCount = wrongCells.size;

  const stats: TypingStats = {
    accuracy: attempted === 0 ? 1 : Math.max(0, (attempted - wrongCount) / attempted),
    cpm: elapsedMs > 0 ? Math.round(committedChars / (elapsedMs / 60000)) : 0,
    elapsedMs,
    typedChars: committedChars,
    wrongCount,
  };

  return {
    lineIndex,
    input,
    isComposing,
    comparison,
    awaitingCommit: comparison.done && isComposing,
    finished,
    stats,
    reset,
    inputProps: {
      value: input,
      onChange,
      onCompositionStart,
      onCompositionEnd,
      onKeyDown,
      autoCapitalize: "off",
      autoComplete: "off",
      autoCorrect: "off",
      spellCheck: false,
    },
  };
}
