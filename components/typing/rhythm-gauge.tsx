"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { GAUGE, evenness, stepGauge } from "@/lib/typing/rhythm";
import { cn } from "@/lib/utils";

/**
 * 칸 수. 게이지가 연속으로 차오르지 않고 칸 단위로 켜진다 — 픽셀 화면이라 눈금도
 * 격자에 맞춘다. 칸이 잘면 그만큼 자주 깜빡이므로 굵게 가른다.
 */
const SEGMENTS = 12;

/**
 * 칸을 바꾸기 전에 이만큼은 넘어와야 한다.
 *
 * 없으면 게이지가 경계에 걸쳐 있는 동안 칸 하나가 초당 몇 번씩 켜졌다 꺼진다.
 * 값은 미세하게 움직이는데 화면은 요란한, 가장 거슬리는 상태다.
 */
const DEADBAND = 0.75;

/**
 * 호흡 게이지.
 *
 * 매 프레임 도는 자리라 연습 화면과 떼어 놓았다. 부모가 다시 그려지면 기도문의
 * 글자 칸이 함께 다시 그려지는데, 그것을 초당 60번 할 수는 없다. 타건 시각은
 * ref로 건네받아 여기서만 읽는다.
 *
 * 다만 프레임 루프는 **필요한 동안만** 돈다. 줄을 치고 있지 않거나, 이미 바닥까지
 * 빠진 채로 손을 뗐으면 루프를 끊고 다음 타건을 기다린다. 걸어 둔 rAF는 그리는 것이
 * 없어도 브라우저가 탭을 재우지 못하게 만들어서, 화면을 열어 둔 내내 전력을 쓴다.
 *
 * 처음부터 다시 할 때 게이지를 비우는 일은 부모가 판 번호를 `key`로 주어 처리한다.
 * 여기에 비우는 코드를 두지 않는 편이 낫다 — 게이지의 상태는 ref와 state에 나뉘어
 * 있어서 손으로 비우면 한쪽을 빠뜨리게 되고, 리마운트는 둘 다 한꺼번에 처음으로
 * 되돌린다.
 */
export function RhythmGauge({
  beats,
  live,
}: {
  beats: RefObject<number[]>;
  /** 줄을 치는 중인가. 줄과 줄 사이에는 값을 그대로 둔다. */
  live: boolean;
}) {
  const gauge = useRef(0);
  const [lit, setLit] = useState(0);

  /**
   * 지금까지의 타건 수. 렌더 중에 ref를 읽는다.
   *
   * 타건마다 오토마타가 새 상태를 돌려주므로 이 컴포넌트도 그때마다 다시 그려진다 —
   * 곧 이 값은 늘 최신이다. 아래 효과가 이것을 의존성으로 삼아, 잠든 루프를 다음
   * 타건이 깨우는 고리가 된다. 시각 자체가 아니라 개수를 보는 것은 시각 배열이
   * 같은 ref 안에서 제자리 변형되기 때문이다.
   */
  const beatCount = beats.current.length;

  useEffect(() => {
    // 줄과 줄 사이에는 값이 그 자리에 언다. 움직일 것이 없으니 루프도 걸지 않는다 —
    // 손을 쉬는 동안 점수가 깎이면 줄을 끊어 치는 뜻이 없어진다.
    if (!live) return;

    // 타건 시각은 이 효과가 사는 동안 바뀌지 않는다. 다음 타건이 곧 다음 효과다.
    // 프레임마다 다시 재던 것을 여기 한 번으로 옮긴다.
    const target = evenness(beats.current);
    const last = beatCount > 0 ? beats.current[beatCount - 1] : Number.NEGATIVE_INFINITY;

    let raf = 0;
    let prev = performance.now();
    const frame = (now: number) => {
      const dt = now - prev;
      prev = now;

      gauge.current = stepGauge(gauge.current, target, now - last, dt);

      // 칸 수가 그대로면 React가 렌더를 건너뛴다. 이 자리에서는 그 점이 중요하다.
      const exact = gauge.current * SEGMENTS;
      setLit((cur) => (Math.abs(exact - cur) > DEADBAND ? Math.round(exact) : cur));

      // 바닥까지 빠진 채로 손을 뗐으면 다음 타건 전에는 아무것도 변하지 않는다.
      // 거기서 루프를 끊는다. rAF가 걸려 있는 동안은 한 픽셀도 안 바뀌어도 브라우저가
      // 그 탭을 재우지 못해, 가만히 둔 화면이 계속 맥북을 데운다.
      if (gauge.current === 0 && now - last > GAUGE.graceMs) {
        // 데드밴드 탓에 마지막 한 칸이 켜진 채 남을 수 있다. 끄고 잠든다.
        setLit(0);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [beats, beatCount, live]);

  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="text-muted-foreground shrink-0 text-xs">호흡</span>
      {/* 초당 60번 바뀌는 눈금이라 읽어 주면 방해만 된다. */}
      <div className="flex h-2 flex-1 gap-[3px]" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              // 칸이 딱딱 바뀌면 곁눈에 자꾸 걸린다. 모서리는 각진 채로 색만 번지게 한다.
              "flex-1 transition-colors duration-300",
              i < lit ? "bg-gauge-lit" : "bg-gauge-empty",
            )}
          />
        ))}
      </div>
    </div>
  );
}
