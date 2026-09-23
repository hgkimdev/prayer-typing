"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { isSyllable, type JamoStep } from "@/lib/hangul";
import { compareText, type CharState } from "./compare";
import { isPunctuation, typableOf } from "./punctuation";
import { evenness } from "./rhythm";
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
  /**
   * 한 편 내내의 고름 (0–1). 아직 잴 것이 없으면 null.
   * 줄마다 따로 재서 글자 수로 가중 평균한다 — 줄과 줄 사이의 쉼은 리듬이 아니다.
   */
  breath: number | null;
};

/** 지금 치고 있는 줄. 화면은 이 한 줄과 내 입력만 그린다. */
export type ActiveLine = {
  index: number;
  /** 기도문 원문 한 줄. 기호를 포함한다. */
  text: string;
  /** 원문 글자마다의 판정 */
  states: CharState[];
  /** 지금까지 친 글자 */
  input: string;
  /** 친 글자마다의 판정. `input`과 자리가 같다. */
  inputStates: CharState[];
  /** 이 줄의 첫 글자를 쳤는가. 시계는 이때부터 간다. */
  started: boolean;
  /** 끝까지 쳤는가. 엔터를 받을 수 있다. */
  complete: boolean;
  /** 자모 단위 진행도. 화면에는 쓰이지 않고 실험실에서 들여다볼 때 쓴다. */
  jamoCells: Record<number, JamoStep[]>;
};

export type TypingSession = {
  line: ActiveLine;
  lineCount: number;
  /** 한 글자라도 쳤는가. 첫 줄의 첫 글자를 치기 전에는 아무 수치도 움직이지 않는다. */
  started: boolean;
  finished: boolean;
  stats: TypingStats;
  /** 오토마타의 날것 상태. 화면에는 쓰이지 않고 실험실에서 들여다볼 때 쓴다. */
  ime: ImeState;
  /**
   * 이 줄의 타건 시각. 리듬 게이지가 읽는다.
   *
   * 상태가 아니라 ref다 — 키마다 값이 바뀌지만 그때마다 화면을 다시 그릴 수는 없다.
   * 줄이 넘어갈 때 비운다. 줄 사이의 쉼은 리듬의 일부가 아니기 때문이다.
   */
  beats: RefObject<number[]>;
  /** 몇 번째 판인가. 처음부터 다시 할 때마다 늘어난다. 게이지가 이걸 보고 제 값을 비운다. */
  attempt: number;
  reset: () => void;
  /** 키를 받을 요소에 그대로 펴 넣는다. input이 아니라 편집 불가 요소다. */
  surfaceProps: {
    tabIndex: 0;
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  };
};

/** 한글 자모와 완성형 음절. key가 이 꼴로 오면 IME를 거쳐 온 것이다. */
const HANGUL = /[ㄱ-ㆎ가-힣]/;

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
function step(state: ImeState, e: React.KeyboardEvent<HTMLElement>, typable: string[]): ImeState | null {
  if (e.key === "Backspace") return pressBackspace(state);
  if (e.code === "Space") return pressLiteral(state, " ");

  const typed = [...imeText(state)];
  // 조합 중이면 마지막 글자가 아직 만들어지는 중이다.
  const expected = typable[isComposing(state) ? typed.length - 1 : typed.length];

  if (expected && isSyllable(expected)) {
    const jamo = keyToJamo(e.code, e.shiftKey);
    if (jamo) return pressJamo(state, jamo);
  }
  const literal = latinOf(e);
  // 기호는 우리가 채운다. 눌러도 입력에 넣지 않는다 — 넣으면 제자리가 아니라 오타가 된다.
  if (literal === null || isPunctuation(literal)) return null;
  return pressLiteral(state, literal);
}

/** 넘어간 줄들에서 쌓인 것. 지금 줄의 것과 더해 성적이 된다. */
type Tally = {
  attempted: number;
  wrong: number;
  elapsedMs: number;
  /** 고름 × 간격 수의 합. 글자를 많이 친 줄이 그만큼 무겁다. */
  breathSum: number;
  breathGaps: number;
};

const EMPTY_TALLY: Tally = {
  attempted: 0,
  wrong: 0,
  elapsedMs: 0,
  breathSum: 0,
  breathGaps: 0,
};

/**
 * 기도문 한 편을 치는 한 판. 한 줄씩 끊어 친다.
 *
 * 한 줄을 끝까지 치고 엔터를 누르면 다음 줄로 넘어간다. 줄과 줄 사이에는 시계도
 * 게이지도 멈춘다 — 한 편을 한 번에 다 치면 손이 남아나지 않으므로, 쉬는 것이
 * 성적을 깎는 일이어서는 안 된다.
 *
 * 그 대신 줄을 넘는 연음은 사라진다. 앞 줄 끝의 받침이 다음 줄 첫 글자로 넘어가던
 * 자리인데, 이제 줄마다 입력이 끊기므로 이어질 방법이 없다. 기도서의 행갈이가 곧
 * 숨을 끊는 자리라 실제로 그렇게 읽기도 한다.
 */
export function useTypingSession(lines: string[]): TypingSession {
  const [lineIndex, setLineIndex] = useState(0);
  const [ime, setIme] = useState<ImeState>(EMPTY_IME);
  const [finished, setFinished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY);
  /** 이 줄에서 한 번이라도 틀렸던 자리. 고쳐도 중복 가산되지 않는다. */
  const [wrongCells, setWrongCells] = useState<ReadonlySet<number>>(() => new Set());
  const [lineStartedAt, setLineStartedAt] = useState<number | null>(null);
  const [lineElapsedMs, setLineElapsedMs] = useState(0);
  const beats = useRef<number[]>([]);

  const target = lines[lineIndex] ?? "";
  /** 손으로 쳐야 할 글자만 남긴 목표. 입력은 이쪽과 자리를 맞춘다. */
  const typable = useMemo(() => typableOf(target), [target]);
  const text = imeText(ime);
  const composing = isComposing(ime);
  const comparison = useMemo(
    () => compareText(text, target, composing),
    [text, target, composing],
  );

  // 틀린 채로도 넘어갈 수 있다. 오타는 성적에 남지, 길을 막지 않는다.
  const complete = [...text].length >= typable.chars.length;

  const reset = useCallback(() => {
    setLineIndex(0);
    setIme(EMPTY_IME);
    setFinished(false);
    setTally(EMPTY_TALLY);
    setWrongCells(new Set());
    setLineStartedAt(null);
    setLineElapsedMs(0);
    beats.current = [];
    setAttempt((n) => n + 1);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      // 브라우저 단축키(복사·새로고침)는 건드리지 않는다.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (finished) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (!complete) return;

        // 이 줄에서 쌓은 것을 성적에 넘기고 줄을 비운다.
        const spent = lineStartedAt === null ? 0 : performance.now() - lineStartedAt;
        const lineBreath = evenness(beats.current, Infinity);
        const gaps = Math.max(0, beats.current.length - 1);
        setTally((prev) => ({
          attempted: prev.attempted + comparison.attempted,
          wrong: prev.wrong + wrongCells.size,
          elapsedMs: prev.elapsedMs + spent,
          breathSum: prev.breathSum + (lineBreath === null ? 0 : lineBreath * gaps),
          breathGaps: prev.breathGaps + (lineBreath === null ? 0 : gaps),
        }));
        setLineStartedAt(null);
        setLineElapsedMs(0);
        if (lineIndex + 1 >= lines.length) {
          // 마지막 줄은 지우지 않는다. 다 친 줄이 칠해진 채로 화면에 남아야 한다.
          setFinished(true);
        } else {
          setIme(EMPTY_IME);
          setWrongCells(new Set());
          beats.current = [];
          setLineIndex(lineIndex + 1);
        }
        return;
      }

      const next = step(ime, e, typable.chars);
      if (!next) return;
      e.preventDefault();

      // 백스페이스도 한 번의 타건으로 센다. 오타를 고치느라 손이 멈칫한 것 역시
      // 리듬이 끊긴 것이기 때문이다.
      const now = performance.now();
      beats.current.push(now);

      setLineStartedAt((prev) => prev ?? now);
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
    [
      comparison.attempted,
      complete,
      finished,
      ime,
      lineIndex,
      lineStartedAt,
      lines.length,
      target,
      typable,
      wrongCells,
    ],
  );

  // 경과 시간은 입력과 무관하게 흘러야 화면이 멈춰 보이지 않는다. 다만 줄을 넘긴
  // 뒤로는 멈춘다 — 다음 줄의 첫 글자를 칠 때까지 성적은 그 자리에 얼어 있다.
  useEffect(() => {
    if (lineStartedAt === null || finished) return;
    const tick = () => setLineElapsedMs(performance.now() - lineStartedAt);
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [lineStartedAt, finished]);

  // 채워 준 기호는 시도한 자리에 들어가지 않는다. 타속에도 정확도에도 섞이지 않는다.
  // 끝난 뒤에는 마지막 줄이 화면에 그대로 남아 있다. 그 줄은 이미 `tally`에
  // 들어갔으므로 여기서 또 더하면 두 번 세는 꼴이 된다.
  const attempted = tally.attempted + (finished ? 0 : comparison.attempted);
  const wrongCount = tally.wrong + (finished ? 0 : wrongCells.size);
  const elapsedMs = tally.elapsedMs + lineElapsedMs;

  return {
    line: {
      index: lineIndex,
      text: target,
      states: comparison.states,
      input: text,
      inputStates: comparison.inputStates,
      started: lineStartedAt !== null,
      complete,
      jamoCells: comparison.jamoCells,
    },
    lineCount: lines.length,
    started: tally.attempted > 0 || lineStartedAt !== null,
    finished,
    ime,
    beats,
    attempt,
    stats: {
      accuracy: attempted === 0 ? 1 : Math.max(0, (attempted - wrongCount) / attempted),
      cpm: elapsedMs > 0 ? Math.round(attempted / (elapsedMs / 60000)) : 0,
      elapsedMs,
      typedChars: attempted,
      wrongCount,
      breath: tally.breathGaps > 0 ? tally.breathSum / tally.breathGaps : null,
    },
    reset,
    surfaceProps: { tabIndex: 0, onKeyDown },
  };
}
