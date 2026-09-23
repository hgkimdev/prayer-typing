"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { evenness, stepGauge } from "@/lib/typing/rhythm";
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
 */
export function RhythmGauge({
  beats,
  live,
  attempt,
}: {
  beats: RefObject<number[]>;
  /** 줄을 치는 중인가. 줄과 줄 사이에는 값을 그대로 둔다. */
  live: boolean;
  /** 몇 번째 판인가. 바뀌면 게이지를 비운다. */
  attempt: number;
}) {
  const gauge = useRef(0);
  const liveRef = useRef(live);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  // 처음부터 다시 하면 게이지도 바닥에서 출발한다. 화면은 다음 프레임이 맞춘다 —
  // 여기서 setState를 부르면 효과가 렌더를 한 번 더 부르는 꼴이 된다.
  useEffect(() => {
    gauge.current = 0;
  }, [attempt]);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const frame = (now: number) => {
      const dt = now - prev;
      prev = now;

      // 손을 쉬는 동안 점수가 깎이면 줄을 끊어 치는 뜻이 없어진다. 멈춰 세운다.
      if (liveRef.current) {
        const beaten = beats.current;
        const last = beaten.length > 0 ? beaten[beaten.length - 1] : Number.NEGATIVE_INFINITY;
        gauge.current = stepGauge(gauge.current, evenness(beaten), now - last, dt);
      }

      // 칸 수가 그대로면 React가 렌더를 건너뛴다. 이 자리에서는 그 점이 중요하다.
      const exact = gauge.current * SEGMENTS;
      setLit((cur) => (Math.abs(exact - cur) > DEADBAND ? Math.round(exact) : cur));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [beats]);

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
