"use client";

import type { CharState } from "@/lib/typing/compare";
import { cn } from "@/lib/utils";

const CHAR_CLASS: Record<CharState, string> = {
  pending: "text-foreground",
  correct: "text-char-correct",
  wrong: "text-char-wrong",
  // 만들어지는 중인 글자. 목표와 어긋났다고 아직 말할 수 없다.
  composing: "text-char-composing",
};

/**
 * 내가 치고 있는 줄.
 *
 * 오토마타가 만든 글자를 그대로 그린다. ㄱ에서 가로, 가에서 강으로 자라나는 것이
 * 여기 보인다. 비어 있어도 줄 높이는 지켜야 한다 — 글자가 들어올 때마다 위아래가
 * 출렁이면 눈이 따라가지 못한다.
 */
export function InputLine({
  input,
  states,
  caret = true,
}: {
  input: string;
  states: CharState[];
  /** 커서를 그릴지. 손을 뗐거나 판이 끝났으면 끈다. */
  caret?: boolean;
}) {
  return (
    <p className="font-prayer border-border/70 border-b pb-1 text-2xl leading-relaxed tracking-tight sm:text-3xl">
      {[...input].map((ch, i) => {
        const state = states[i] ?? "pending";
        return (
          <span
            key={i}
            className={cn(
              "relative",
              CHAR_CLASS[state],
              ch === " " && state === "wrong" && "bg-char-wrong/25 rounded-xs",
            )}
          >
            {ch}
          </span>
        );
      })}
      {/* 줄 끝의 커서. 빈 줄에서도 높이를 잡아 준다. */}
      <span className={cn("relative", caret && "caret-slot")}>{"​"}</span>
    </p>
  );
}
