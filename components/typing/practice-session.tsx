"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { InputLine } from "@/components/typing/input-line";
import { RhythmGauge } from "@/components/typing/rhythm-gauge";
import { TypingLine } from "@/components/typing/typing-line";
import { segmentAt, type Course } from "@/lib/prayers";
import { rhythmGrade } from "@/lib/typing/rhythm";
import { useTypingSession } from "@/lib/typing/use-typing-session";
import { cn } from "@/lib/utils";

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
}

export function PracticeSession({ course }: { course: Course }) {
  const session = useTypingSession(course.lines);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const focus = () => surfaceRef.current?.focus();

  // 클릭을 시작 의식으로 두지 않는다. 화면이 뜨면 바로 칠 수 있어야 한다.
  useEffect(() => {
    surfaceRef.current?.focus();
  }, []);

  const { line, stats } = session;
  const segment = segmentAt(course, line.index);
  const progress = session.finished ? 1 : course.lines.length === 0 ? 0 : line.index / course.lines.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          ← 기도문 목록
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
          {course.latin && (
            <span className="text-muted-foreground text-sm italic">{course.latin}</span>
          )}
          {course.unverified && (
            <span
              className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs"
              title="공인 기도서와 아직 대조하지 않은 본문이다."
            >
              본문 미검증
            </span>
          )}
        </div>
      </header>

      {/* 진행 막대 — 몇 줄 남았는지가 가장 궁금한 정보다. */}
      <div className="mb-4">
        <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${(progress * 100).toFixed(1)}%` }}
          />
        </div>
        <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
          <span>
            {Math.min(line.index + 1, course.lines.length)} / {course.lines.length}줄
          </span>
          {/* 묶음은 지금 어느 기도문의 몇 번째인지가 따로 필요하다. */}
          {course.composite && segment && (
            <span>
              {segment.label ? `${segment.label} · ` : ""}
              {segment.title}
              {segment.repeatOf > 1 && ` ${segment.repetition}/${segment.repeatOf}`}
            </span>
          )}
        </div>
      </div>

      {/*
        input이 아니라 편집 불가 요소로 키를 받는다. input을 쓰면 한글 모드의 IME가
        제 글자를 같이 집어넣는데, 여기는 IME가 글을 넣을 자리가 없어 물리 키만 온다.
        글자는 우리 오토마타가 만들어 아래에 직접 그린다.
      */}
      <div
        ref={surfaceRef}
        {...session.surfaceProps}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={focus}
        role="group"
        aria-label={`${course.title} 타자 연습`}
        className={cn(
          "bg-card relative cursor-text rounded-xl border p-6 outline-none sm:p-8",
          focused && "border-ring",
        )}
      >
        {/* 위는 따라 칠 줄, 아래는 내가 치는 줄. 한 번에 한 줄만 본다. */}
        <div className="space-y-4">
          <TypingLine target={line.text} states={line.states} />
          <InputLine
            input={line.input}
            states={line.inputStates}
            caret={focused && !session.finished}
          />
        </div>

        <div className="text-muted-foreground mt-3 h-4 text-right text-xs">
          {session.finished
            ? "다 옮겼습니다"
            : line.complete
              ? "엔터를 누르면 다음 줄"
              : line.started
                ? ""
                : "첫 글자를 치면 시작합니다"}
        </div>

        {/* 손을 뗀 동안만 가린다. */}
        {!focused && !session.finished && (
          <div className="bg-card/80 absolute inset-0 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
            <span className="text-muted-foreground text-sm">클릭하면 이어서 칩니다</span>
          </div>
        )}
      </div>

      {/* 줄과 줄 사이에는 게이지도 멈춘다. 쉬는 동안 깎이면 끊어 치는 뜻이 없어진다. */}
      <RhythmGauge beats={session.beats} live={line.started && !session.finished} attempt={session.attempt} />

      {session.finished ? (
        <div className="bg-card mt-4 rounded-xl border p-6">
          <h2 className="font-semibold">다 옮겼습니다</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              ["호흡", stats.breath === null ? "—" : rhythmGrade(stats.breath)],
              ["정확도", `${Math.round(stats.accuracy * 100)}%`],
              ["분당 글자", `${stats.cpm}자`],
              ["걸린 시간", formatDuration(stats.elapsedMs)],
              ["오타", `${stats.wrongCount}곳`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => {
                session.reset();
                focus();
              }}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium"
            >
              다시 하기
            </button>
            <Link
              href="/"
              className="border-border hover:bg-muted rounded-lg border px-4 py-2 text-sm"
            >
              목록으로
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="tabular-nums">
            정확도 <strong>{Math.round(stats.accuracy * 100)}%</strong>
          </span>
          <span className="tabular-nums">
            분당 <strong>{stats.cpm}</strong>자
          </span>
          <span className="text-muted-foreground tabular-nums">오타 {stats.wrongCount}</span>
          <button
            type="button"
            onClick={() => {
              session.reset();
              focus();
            }}
            className="border-border hover:bg-muted ml-auto rounded-lg border px-3 py-1 text-sm"
          >
            처음부터
          </button>
        </div>
      )}
    </div>
  );
}
