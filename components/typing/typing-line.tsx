"use client";

import type { CharState } from "@/lib/typing/compare";
import { cn } from "@/lib/utils";

const CHAR_CLASS: Record<CharState, string> = {
  pending: "text-char-pending",
  correct: "text-char-correct",
  wrong: "text-char-wrong",
  // 아직 만들어지는 중인 글자. 목표가 될 가능성이 남아 있어 오타로 칠하지 않는다.
  composing: "text-char-pending",
};

/**
 * 따라 칠 기도문 한 줄.
 *
 * 목표 글자는 그대로 두고 색만 바뀐다. "강"을 끝까지 쳐야 그 글자가 검어지고,
 * "각"처럼 다른 글자를 확정하면 붉어진다. 조합 중에 잠깐 거쳐 가는 "가"는 아직
 * 아무것도 아니므로 회색 그대로다 — 지금 만들어지는 글자는 아래 입력 줄이 보여 준다.
 */
export function TypingLine({ target, states }: { target: string; states: CharState[] }) {
  return (
    <p className="font-prayer text-2xl leading-relaxed tracking-tight sm:text-3xl">
      {[...target].map((ch, i) => {
        const state = states[i] ?? "pending";
        return (
          <span
            key={i}
            className={cn(
              CHAR_CLASS[state],
              // 공백은 색으로 틀렸다고 말할 수 없으니 바닥을 깔아 표시한다.
              ch === " " && state === "wrong" && "bg-char-wrong/25 rounded-xs",
            )}
          >
            {ch}
          </span>
        );
      })}
    </p>
  );
}
