"use client";

import type { CSSProperties } from "react";

import { vowelShape, type JamoState, type JamoStep } from "@/lib/hangul";
import type { CharState } from "@/lib/typing/compare";
import { jamoMasks, type JamoMaskSet } from "@/lib/typing/jamo-mask";
import { cn } from "@/lib/utils";

const CHAR_CLASS: Record<CharState, string> = {
  pending: "text-char-pending",
  correct: "text-char-correct",
  wrong: "text-char-wrong",
  composing: "text-char-composing",
};

const JAMO_CLASS: Record<JamoState, string> = {
  done: "text-char-correct",
  partial: "text-char-composing",
  pending: "text-char-pending",
  wrong: "text-char-wrong",
};

/** 획 단위로 오려낸 마스크를 CSS에 얹는다. */
function maskStyle(masks: JamoMaskSet, index: number): CSSProperties {
  const image = `url(${masks.urls[index]})`;
  const size = `${masks.width.toFixed(4)}em ${masks.height.toFixed(4)}em`;
  const position = `${masks.left.toFixed(4)}em ${masks.top.toFixed(4)}em`;
  return {
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskSize: size,
    maskSize: size,
    WebkitMaskPosition: position,
    maskPosition: position,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };
}

/**
 * 획을 쪼개지 못했을 때 쓰는 차선책 — 글자 네모를 자모 자리대로 가른다.
 *
 * ㄱ과 ㅏ가 서로 붙어 있는 글꼴·글자에서는 획 단위로 나눌 수 없다. 그때는
 * 경계선이 획을 가로지르더라도 자리만이라도 보여 주는 편이 아무것도 없는 것보다 낫다.
 */
// 셀 높이(1em) 안에서 글자가 실제로 차지하는 세로 구간.
const GLYPH_TOP = 0.13;
const GLYPH_HEIGHT = 0.86;
// 초성과 세로 모음(ㅏ)을 가르는 가로 위치.
const SPLIT_X = 56;

/** 글자 높이의 `f`지점을 셀 위/아래에서 잰 거리로. */
const fromTop = (f: number) => `${(GLYPH_TOP + GLYPH_HEIGHT * f).toFixed(3)}em`;
const fromBottom = (f: number) => `${(1 - GLYPH_TOP - GLYPH_HEIGHT * f).toFixed(3)}em`;
const RIGHT_OF_SPLIT = `${100 - SPLIT_X}%`;

/** 초성·중성·종성 순서의 clip-path 목록. `steps`와 길이가 같다. */
function jamoClips(jung: string, hasJong: boolean): string[] {
  const shape = vowelShape(jung);

  if (shape === "vertical") {
    // ㄱ | ㅏ 로 좌우를 가르고, 받침이 있으면 아래를 한 번 더 자른다.
    if (!hasJong) return [`inset(0 ${RIGHT_OF_SPLIT} 0 0)`, `inset(0 0 0 ${SPLIT_X}%)`];
    return [
      `inset(0 ${RIGHT_OF_SPLIT} ${fromBottom(0.7)} 0)`,
      `inset(0 0 ${fromBottom(0.7)} ${SPLIT_X}%)`,
      `inset(${fromTop(0.7)} 0 0 0)`,
    ];
  }

  if (shape === "horizontal") {
    // ㄱ 위 ㅗ 아래. 받침이 붙으면 셋으로 나뉜다.
    if (!hasJong) return [`inset(0 0 ${fromBottom(0.55)} 0)`, `inset(${fromTop(0.55)} 0 0 0)`];
    return [
      `inset(0 0 ${fromBottom(0.44)} 0)`,
      `inset(${fromTop(0.44)} 0 ${fromBottom(0.72)} 0)`,
      `inset(${fromTop(0.72)} 0 0 0)`,
    ];
  }

  // ㅘ·ㅢ 처럼 오른쪽과 아래를 함께 쓰는 모음. 초성은 왼쪽 위 네모, 중성은 그 나머지.
  if (!hasJong) {
    const cut = fromTop(0.55);
    return [
      `inset(0 ${RIGHT_OF_SPLIT} ${fromBottom(0.55)} 0)`,
      `polygon(${SPLIT_X}% 0, 100% 0, 100% 100%, 0 100%, 0 ${cut}, ${SPLIT_X}% ${cut})`,
    ];
  }
  const cut = fromTop(0.44);
  const jongTop = fromTop(0.72);
  return [
    `inset(0 ${RIGHT_OF_SPLIT} ${fromBottom(0.44)} 0)`,
    `polygon(${SPLIT_X}% 0, 100% 0, 100% ${jongTop}, 0 ${jongTop}, 0 ${cut}, ${SPLIT_X}% ${cut})`,
    `inset(${jongTop} 0 0 0)`,
  ];
}

type TypingLineProps = {
  target: string;
  states: CharState[];
  /** 조합 중인 칸의 자모 진행도. 글자 안에서 자모별로 색이 들어온다. */
  jamoCells?: Record<number, JamoStep[]>;
  /** 커서가 놓일 글자 인덱스. 비활성 줄이면 생략한다. */
  caretIndex?: number;
  /** 목표를 넘겨 친 글자 수 */
  overflow?: number;
  active?: boolean;
};

export function TypingLine({
  target,
  states,
  jamoCells,
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
        const jamo = jamoCells?.[i];
        const isSpace = ch === " ";
        // 획 단위로 오려내는 것이 먼저고, 못 쪼갠 글자만 네모로 가른다.
        const masks = jamo ? jamoMasks(ch) : null;
        const clips = jamo && !masks ? jamoClips(jamo[1].jamo, jamo.length > 2) : null;
        // 아직 안 친 자모는 바탕색 그대로 두면 되니 겹쳐 그리지 않는다.
        const layers = jamo
          ? jamo
              .map((step, k) => ({
                state: step.state,
                style: masks ? maskStyle(masks, k) : { clipPath: clips![k] },
              }))
              .filter((layer) => layer.state !== "pending")
          : null;
        return (
          <span
            key={i}
            className={cn(
              "relative",
              // 셀을 글자 네모에 맞춰야 clip-path가 자모 자리와 맞는다.
              jamo ? "inline-block align-baseline leading-none" : null,
              // 자모가 따로 칠해질 칸은 바탕을 아직 안 친 색으로 깔아 둔다.
              jamo ? JAMO_CLASS.pending : CHAR_CLASS[state],
              // 공백은 색으로 틀렸다고 말할 수 없으니 바닥을 깔아 표시한다.
              isSpace && state === "wrong" && "bg-char-wrong/25 rounded-xs",
              !isSpace && state === "wrong" && "underline decoration-wavy underline-offset-[6px]",
              caretIndex === i && active && "caret-slot",
            )}
          >
            {isSpace ? " " : ch}
            {layers?.map((layer, k) => (
              <span
                key={k}
                aria-hidden
                style={layer.style}
                className={cn("pointer-events-none absolute inset-0", JAMO_CLASS[layer.state])}
              >
                {ch}
              </span>
            ))}
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
