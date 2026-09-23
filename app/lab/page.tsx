"use client";

import { useEffect, useRef, useState } from "react";

import { TypingLine } from "@/components/typing/typing-line";
import { composingChar } from "@/lib/typing/dubeolsik";
import { useTypingSession } from "@/lib/typing/use-typing-session";
import { cn } from "@/lib/utils";

/**
 * 오토마타 검증용 임시 페이지. 기도문이 아니라 판정이 깨지기 쉬운 자리를
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
    label: "된소리",
    hint: "ㄲㄸㅃㅆㅉ과 ㅒㅖ는 Shift로 한 번에 들어간다. 겹받침 ㄲ·ㅆ도 함께",
    lines: ["꽃밭에 빨래를 깔끔히", "쌍둥이 얘기 예쁜 짝", "밖에서 있었다"],
  },
  {
    label: "줄 경계",
    hint: "앞 줄이 한글로 끝나고 다음 줄이 모음으로 시작한다. 연음이 줄을 넘는 자리",
    lines: ["주님께서 함께 계시니", "여인 중에 복되시며"],
  },
  {
    label: "영문",
    hint: "같은 자판을 자모가 아니라 알파벳으로 읽어야 하는 자리",
    lines: ["Hallowed be thy name", "on earth as it is in heaven"],
  },
];

export default function LabPage() {
  const [sampleIndex, setSampleIndex] = useState(0);
  const sample = SAMPLES[sampleIndex];
  const session = useTypingSession(sample.lines);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // 샘플을 바꾸면 처음부터.
  const { reset } = session;
  useEffect(() => {
    reset();
    surfaceRef.current?.focus();
  }, [sampleIndex, reset]);

  const { ime } = session;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">한글 오토마타 실험실</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          OS의 IME를 타지 않고 물리 키를 직접 받아 글자를 만든다. 한/영 모드와 무관하게
          똑같이 동작해야 한다 — 지금 쳐야 할 글자가 한글이면 자모로, 영문이면 알파벳으로
          읽는다. 조합 중인 글자는 초성·중성·종성 자리에 따로 불이 들어온다.
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
        ref={surfaceRef}
        {...session.surfaceProps}
        onClick={() => surfaceRef.current?.focus()}
        role="group"
        aria-label="타자 입력"
        className="bg-card focus:border-ring relative cursor-text rounded-xl border p-6 outline-none"
      >
        <div className="space-y-3">
          {session.lines.map((line, i) => (
            <TypingLine
              key={i}
              target={line.text}
              states={line.states}
              jamoCells={line.jamoCells}
              active={line.active}
              caretIndex={line.caretIndex}
              overflow={line.overflow}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          정확도 <strong>{Math.round(session.stats.accuracy * 100)}%</strong>
        </span>
        <span>
          분당 <strong>{session.stats.cpm}</strong>자
        </span>
        <span className="text-muted-foreground">오타 {session.stats.wrongCount}</span>
        {session.finished && <span className="text-primary font-medium">완료</span>}
        <button
          type="button"
          onClick={() => {
            session.reset();
            surfaceRef.current?.focus();
          }}
          className="border-border hover:bg-muted ml-auto rounded-lg border px-3 py-1 text-sm"
        >
          다시
        </button>
      </div>

      <pre className="bg-muted text-muted-foreground mt-6 overflow-x-auto rounded-lg p-4 text-xs">
        {JSON.stringify(
          {
            line: session.lineIndex,
            text: session.text,
            // 오토마타가 지금 무엇을 들고 있는지. 여기가 곧 진실이다.
            조합: { 초성: ime.cho, 중성: ime.jung, 종성: ime.jong, 글자: composingChar(ime) },
            확정: ime.committed,
            줄판정: session.lines.map((l) =>
              l.states
                .map((s) => ({ pending: ".", correct: "o", wrong: "X", composing: "~" })[s])
                .join(""),
            ),
            넘겨친글자: session.lines.at(-1)?.overflow ?? 0,
            자모: Object.fromEntries(
              session.lines.flatMap((l, i) =>
                Object.entries(l.jamoCells).map(([index, steps]) => [
                  `${i}:${index}`,
                  steps
                    .map((s) => s.jamo + { done: "o", partial: "~", pending: ".", wrong: "X" }[s.state])
                    .join(" "),
                ]),
              ),
            ),
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
