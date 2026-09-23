"use client";

import { useEffect, useRef, useState } from "react";

import { TypingLine } from "@/components/typing/typing-line";
import { compareLine } from "@/lib/typing/compare";
import { useTypingEngine } from "@/lib/typing/use-typing-engine";
import { cn } from "@/lib/utils";

/**
 * IME 엔진 검증용 임시 페이지. 기도문이 아니라 판정이 깨지기 쉬운 자리를
 * 일부러 모아 둔 문장을 쓴다. 엔진이 확정되면 지운다.
 */
const SAMPLES: { label: string; hint: string; lines: string[] }[] = [
  {
    label: "연음",
    hint: "아버지 → 압, 하나 → 한, 주님 → 준. 받침이 다음 글자로 넘어가는 자리",
    lines: ["아버지 하나 주님", "바다에 바람이 분다"],
  },
  {
    label: "겹받침",
    hint: "흙+ㅣ → 흘기, 앎, 젊은. 겹받침의 뒤 자음만 넘어간다",
    lines: ["흘기는 눈", "젊은 넋을 앓던 밤", "값있는 삶"],
  },
  {
    label: "복합 모음",
    hint: "ㅗ→ㅘ, ㅡ→ㅢ, ㅜ→ㅝ. 모음이 두 번에 걸쳐 완성된다",
    lines: ["왕관과 의자", "웬 과일 궤짝"],
  },
  {
    label: "영문",
    hint: "조합이 없는 경로. 줄 끝에서 곧바로 넘어가야 한다",
    lines: ["Hallowed be thy name", "on earth as it is in heaven"],
  },
];

export default function LabPage() {
  const [sampleIndex, setSampleIndex] = useState(0);
  const sample = SAMPLES[sampleIndex];
  const engine = useTypingEngine(sample.lines);
  const inputRef = useRef<HTMLInputElement>(null);

  // 샘플을 바꾸면 처음부터.
  const { reset } = engine;
  useEffect(() => {
    reset();
    inputRef.current?.focus();
  }, [sampleIndex, reset]);

  const caretIndex = [...engine.input].length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">한글 IME 판정 실험실</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          조합 중인 글자는 <span className="text-char-composing font-medium">파란색</span>, 확정
          오타는 <span className="text-char-wrong font-medium">빨간색</span>. 조합 중에 빨간색이
          번쩍이면 판정이 틀린 것이다. 조합 중인 글자는 초성·중성·종성 자리에 따로 불이
          들어온다 — 찍힌 자모는 진하게, 남은 자모는 흐리게.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {SAMPLES.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setSampleIndex(i)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              i === sampleIndex
                ? "bg-primary text-primary-foreground border-transparent"
                : "border-border hover:bg-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground mb-6 text-sm">{sample.hint}</p>

      <div
        className="bg-card relative cursor-text rounded-xl border p-6"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="space-y-3">
          {sample.lines.map((line, i) => {
            const isActive = i === engine.lineIndex && !engine.finished;
            const states = isActive
              ? engine.comparison.states
              : i < engine.lineIndex
                ? compareLine(line, line, false).states
                : [];
            return (
              <TypingLine
                key={i}
                target={line}
                states={states}
                jamoCells={isActive ? engine.comparison.jamoCells : undefined}
                active={isActive}
                caretIndex={isActive ? caretIndex : undefined}
                overflow={isActive ? engine.comparison.overflow : 0}
              />
            );
          })}
        </div>

        <input
          ref={inputRef}
          {...engine.inputProps}
          aria-label="타자 입력"
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          정확도 <strong>{Math.round(engine.stats.accuracy * 100)}%</strong>
        </span>
        <span>
          분당 <strong>{engine.stats.cpm}</strong>자
        </span>
        <span className="text-muted-foreground">오타 {engine.stats.wrongCount}</span>
        {engine.awaitingCommit && (
          <span className="text-primary font-medium">줄 끝 — Enter로 확정</span>
        )}
        {engine.finished && <span className="text-primary font-medium">완료</span>}
        <button
          type="button"
          onClick={() => {
            engine.reset();
            inputRef.current?.focus();
          }}
          className="border-border hover:bg-muted ml-auto rounded-lg border px-3 py-1 text-sm"
        >
          다시
        </button>
      </div>

      <pre className="bg-muted text-muted-foreground mt-6 overflow-x-auto rounded-lg p-4 text-xs">
        {JSON.stringify(
          {
            line: engine.lineIndex,
            input: engine.input,
            isComposing: engine.isComposing,
            awaitingCommit: engine.awaitingCommit,
            states: engine.comparison.states
              .map((s) => ({ pending: ".", correct: "o", wrong: "X", composing: "~" })[s])
              .join(""),
            overflow: engine.comparison.overflow,
            jamo: Object.fromEntries(
              Object.entries(engine.comparison.jamoCells).map(([index, steps]) => [
                index,
                steps
                  .map(
                    (s) =>
                      s.jamo +
                      { done: "o", partial: "~", pending: ".", wrong: "X" }[s.state],
                  )
                  .join(" "),
              ]),
            ),
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
