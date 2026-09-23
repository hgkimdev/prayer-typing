"use client";

import type { CharState } from "@/lib/typing/compare";
import { cn } from "@/lib/utils";

const CHAR_CLASS: Record<CharState, string> = {
  pending: "text-char-pending",
  correct: "text-char-correct",
  wrong: "text-char-wrong",
  composing: "text-char-composing",
};

type TypingLineProps = {
  target: string;
  states: CharState[];
  /**
   * 목표 글자 대신 그 칸에 그릴 글자. 조합 중인 칸에만 들어간다.
   *
   * 조합 중인 글자를 목표로 보여 주고 다 친 자모만 색칠하면 한 글자가 두세 조각으로
   * 갈려 지저분해진다. 대신 지금 만들어진 글자를 그대로 그린다 — ㅎ에서 하로, 하에서
   * 한으로 글자가 자라나는 것이 곧 진행도다.
   */
  composed?: Record<number, string>;
  /** 커서가 놓일 글자 인덱스. 비활성 줄이면 생략한다. */
  caretIndex?: number;
  /** 목표를 넘겨 친 글자 수 */
  overflow?: number;
  active?: boolean;
};

export function TypingLine({
  target,
  states,
  composed,
  caretIndex,
  overflow = 0,
  active = false,
}: TypingLineProps) {
  const chars = [...target];

  return (
    <p
      className={cn(
        "font-prayer text-2xl leading-relaxed tracking-tight transition-opacity sm:text-3xl",
        active ? "opacity-100" : "opacity-40",
      )}
    >
      {chars.map((ch, i) => {
        const state = states[i] ?? "pending";
        const shown = composed?.[i] ?? ch;
        const blank = shown === " ";
        return (
          <span
            key={i}
            className={cn(
              "relative",
              CHAR_CLASS[state],
              // 공백은 색으로 틀렸다고 말할 수 없으니 바닥을 깔아 표시한다.
              blank && state === "wrong" && "bg-char-wrong/25 rounded-xs",
              !blank && state === "wrong" && "underline decoration-wavy underline-offset-[6px]",
              caretIndex === i && active && "caret-slot",
            )}
          >
            {shown}
          </span>
        );
      })}
      {/* 줄 끝에 커서가 설 자리 */}
      {active && caretIndex === chars.length && <span className="caret-slot">{" "}</span>}
      {overflow > 0 && (
        <span className="text-char-wrong bg-char-wrong/20 rounded-xs">
          {" ".repeat(overflow)}
        </span>
      )}
    </p>
  );
}
