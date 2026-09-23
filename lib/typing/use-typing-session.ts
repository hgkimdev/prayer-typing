"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { isSyllable, type JamoStep } from "@/lib/hangul";
import { compareText, type CharState } from "./compare";
import {
  EMPTY_IME,
  imeText,
  isComposing,
  keyToJamo,
  pressBackspace,
  pressJamo,
  pressLiteral,
  type ImeState,
} from "./dubeolsik";

export type TypingStats = {
  /** 시도한 자리 대비 정타 비율 (0–1) */
  accuracy: number;
  cpm: number;
  elapsedMs: number;
  typedChars: number;
  wrongCount: number;
};

/** 화면에 한 줄을 그리는 데 필요한 것 전부. */
export type SessionLine = {
  text: string;
  states: CharState[];
  /** 목표 대신 그릴 글자. 조합 중인 칸에만 들어간다. */
  composed: Record<number, string>;
  /** 자모 단위 진행도. 화면에는 쓰이지 않고 실험실에서 들여다볼 때 쓴다. */
  jamoCells: Record<number, JamoStep[]>;
  active: boolean;
  /** 커서가 설 자리. 활성 줄이 아니면 undefined. */
  caretIndex?: number;
  /** 목표를 넘겨 친 글자 수. 마지막 줄에만 붙는다. */
  overflow: number;
};

export type TypingSession = {
  lines: SessionLine[];
  lineIndex: number;
  finished: boolean;
  stats: TypingStats;
  /** 지금까지 만들어진 글자 전체. 확정된 것 + 조합 중인 것. */
  text: string;
  /** 오토마타의 날것 상태. 화면에는 쓰이지 않고 실험실에서 들여다볼 때 쓴다. */
  ime: ImeState;
  reset: () => void;
  /** 키를 받을 요소에 그대로 펴 넣는다. input이 아니라 편집 불가 요소다. */
  surfaceProps: {
    tabIndex: 0;
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  };
};

/** 한글 자모와 완성형 음절. key가 이 꼴로 오면 IME를 거쳐 온 것이다. */
const HANGUL = /[\u3131-\u318E\uAC00-\uD7A3]/;

/**
 * 한글이 아닌 글자를 읽어낸다.
 *
 * `key`를 먼저 믿는다. 거기에는 사용자의 자판 배열(Dvorak·AZERTY)과 Caps Lock이
 * 이미 반영돼 있어서, 물리 자리에서 알파벳을 유도하면 그 사람들에게 틀린 글자가 된다.
 * 한글 모드라 `key`가 자모로 와 버릴 때만 물리 자리로 되돌아간다.
 */
function latinOf(e: React.KeyboardEvent<HTMLElement>): string | null {
  if (e.key.length === 1 && !HANGUL.test(e.key)) return e.key;
  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter) return e.shiftKey ? letter[1] : letter[1].toLowerCase();
  return null;
}

/**
 * 키 한 번을 오토마타에 먹인다. 처리하지 않을 키면 null.
 *
 * 같은 자리(KeyR)가 ㄱ이기도 하고 r이기도 하다. 무엇으로 읽을지는 **지금 쳐야 할
 * 글자**가 정한다 — 연습이라 목표를 언제나 알고 있으니 모드를 따로 둘 필요가 없다.
 */
function step(state: ImeState, e: React.KeyboardEvent<HTMLElement>, target: string): ImeState | null {
  if (e.key === "Backspace") return pressBackspace(state);
  if (e.code === "Space") return pressLiteral(state, " ");

  const typed = [...imeText(state)];
  // 조합 중이면 마지막 글자가 아직 만들어지는 중이다.
  const expected = [...target][isComposing(state) ? typed.length - 1 : typed.length];

  if (expected && isSyllable(expected)) {
    const jamo = keyToJamo(e.code, e.shiftKey);
    if (jamo) return pressJamo(state, jamo);
  }
  const literal = latinOf(e);
  return literal ? pressLiteral(state, literal) : null;
}

/**
 * 기도문 한 편을 치는 한 판.
 *
 * 줄마다 입력을 끊지 않고 전체를 하나의 흐름으로 본다. 줄은 화면에 나누어 보이는
 * 방식일 뿐이다. 이렇게 두면 받침이 다음 줄 첫 글자로 넘어가는 연음이 특별한
 * 자리이길 그만둔다 — 그냥 다음 글자다.
 */
export function useTypingSession(lines: string[]): TypingSession {
  const target = useMemo(() => lines.join(""), [lines]);
  /** 각 줄이 전체 흐름에서 몇 번째 글자부터 시작하는지 */
  const offsets = useMemo(() => {
    const out: number[] = [];
    let n = 0;
    for (const line of lines) {
      out.push(n);
      n += [...line].length;
    }
    return out;
  }, [lines]);

  const [ime, setIme] = useState<ImeState>(EMPTY_IME);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  /** 한 번이라도 틀렸던 자리. 고쳐도 중복 가산되지 않는다. */
  const [wrongCells, setWrongCells] = useState<ReadonlySet<number>>(() => new Set());

  const text = imeText(ime);
  const composing = isComposing(ime);
  const comparison = useMemo(
    () => compareText(text, target, composing),
    [text, target, composing],
  );
  const finished = text === target;

  const reset = useCallback(() => {
    setIme(EMPTY_IME);
    setStartedAt(null);
    setElapsedMs(0);
    setWrongCells(new Set());
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // 브라우저 단축키(복사·새로고침)는 건드리지 않는다.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (finished) return;

      const next = step(ime, e, target);
      if (!next) return;
      e.preventDefault();

      setStartedAt((prev) => prev ?? performance.now());
      setIme(next);

      const result = compareText(imeText(next), target, isComposing(next));
      if (result.wrongIndexes.length > 0) {
        setWrongCells((prev) => {
          const merged = new Set(prev);
          for (const i of result.wrongIndexes) merged.add(i);
          return merged.size === prev.size ? prev : merged;
        });
      }
    },
    [finished, ime, target],
  );

  // 경과 시간은 입력과 무관하게 흘러야 화면이 멈춰 보이지 않는다.
  useEffect(() => {
    if (startedAt === null || finished) return;
    const tick = () => setElapsedMs(performance.now() - startedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [startedAt, finished]);

  const typedCount = [...text].length;
  const targetCount = [...target].length;
  const caret = Math.min(typedCount, targetCount);
  const lineIndex = Math.max(
    0,
    offsets.findLastIndex((offset) => offset <= caret && offset < targetCount),
  );

  const sessionLines: SessionLine[] = lines.map((line, i) => {
    const offset = offsets[i];
    const length = [...line].length;
    const active = i === lineIndex && !finished;

    // 비교는 기도문 전체를 기준으로 매겨져 있다. 이 줄에 걸치는 칸만 줄 안 자리로 옮긴다.
    const composed: Record<number, string> = {};
    for (const [key, ch] of Object.entries(comparison.composedCells)) {
      const local = Number(key) - offset;
      if (local >= 0 && local < length) composed[local] = ch;
    }
    const jamoCells: Record<number, JamoStep[]> = {};
    for (const [key, steps] of Object.entries(comparison.jamoCells)) {
      const local = Number(key) - offset;
      if (local >= 0 && local < length) jamoCells[local] = steps;
    }

    return {
      text: line,
      states: comparison.states.slice(offset, offset + length),
      composed,
      jamoCells,
      active,
      caretIndex: active ? caret - offset : undefined,
      overflow: i === lines.length - 1 ? comparison.overflow : 0,
    };
  });

  const attempted = Math.min(typedCount, targetCount);
  const wrongCount = wrongCells.size;

  return {
    lines: sessionLines,
    lineIndex,
    finished,
    text,
    ime,
    stats: {
      accuracy: attempted === 0 ? 1 : Math.max(0, (attempted - wrongCount) / attempted),
      cpm: elapsedMs > 0 ? Math.round(attempted / (elapsedMs / 60000)) : 0,
      elapsedMs,
      typedChars: attempted,
      wrongCount,
    },
    reset,
    surfaceProps: { tabIndex: 0, onKeyDown },
  };
}
