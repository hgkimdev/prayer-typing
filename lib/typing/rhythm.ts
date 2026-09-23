/**
 * 치는 리듬을 잰다.
 *
 * 타자 게임의 재미는 대개 "빨리 치기"에서 나오는데 기도문에서는 그것을 목표로 세울 수
 * 없다. 대신 **고르게 치기**를 잰다. 느려도 고르면 높고, 빨라도 들쑥날쑥하면 낮다.
 * 염경기도가 실제로 요구하는 것이 일정한 리듬이라 밖에서 갖다 붙인 잣대가 아니다.
 *
 * 브라우저가 필요 없는 순수 함수만 둔다. 화면에서 떼어 두어야 아래 숫자들을 손보는
 * 동안 게이지가 어떻게 움직일지 계산만으로 확인할 수 있다.
 */

/**
 * 리듬을 보는 창. 최근 몇 번의 타건까지 되돌아보는가.
 *
 * 좁으면 한 글자마다 값이 튀어 게이지가 잠시도 가만있지 않는다. 눈에 거슬리는 것과
 * 별개로, 그렇게 요동치는 눈금은 읽을 수가 없어 알려 주는 것도 없다.
 */
export const WINDOW = 24;

/**
 * 간격을 이 범위로 자른다.
 *
 * 40ms 아래는 두 손가락이 겹쳐 떨어진 것이라 리듬으로 셀 수 없고, 1초 위는 리듬이
 * 아니라 멈춤이다. 멈춤은 `stepGauge`가 따로 다룬다 — 여기서 세면 10초를 쉰 것과
 * 2초를 쉰 것이 같은 무게로 창을 오염시킨다.
 *
 * 위 끝을 낮게 잡을수록 한 번 멈칫한 값이 덜 튄다. 줄 끝에서 숨을 고르는 것까지
 * 흔들림으로 세면 기도문을 줄 단위로 끊어 읽는 사람이 손해를 본다.
 */
const MIN_GAP = 40;
const MAX_GAP = 1000;

/**
 * 로그 간격의 표준편차가 이만큼이면 고름이 1/e로 떨어진다.
 *
 * 0.9는 간격이 대략 2.5배 안에서 출렁이는 정도다. 사람이 자판을 치면 어절 첫 글자와
 * 받침에서 자연히 느려지므로, 완전한 등간격을 요구하면 아무도 닿지 못한다.
 *
 * 후하게 잡는 편이 맞다. 이 눈금은 잘 치는 사람을 가려내려고 있는 것이 아니라 지금
 * 고르게 가고 있다고 알려 주려고 있다. 박하게 매기면 늘 반쯤 빈 게이지를 보게 되고,
 * 그러면 눈금이 아니라 잔소리가 된다.
 */
const TOLERANCE = 0.9;

/** 고름을 재려면 간격이 최소 이만큼은 있어야 한다. */
const MIN_GAPS = 3;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * 타건 시각이 얼마나 고른가. 0(들쑥날쑥)에서 1(일정)까지.
 *
 * 간격의 **로그**로 잰다. 리듬은 차이가 아니라 비율로 느껴지기 때문이다 — 100ms에서
 * 200ms로 튄 것과 300ms에서 600ms로 튄 것은 같은 정도로 흔들린 것으로 들린다.
 * 밀리초 차이로 재면 빠르게 치는 사람일수록 편차가 작아져, 결국 속도를 재는 잣대가
 * 이름만 바꿔 하나 더 생길 뿐이다.
 *
 * 아직 잴 것이 없으면 `null`이다. 0도 0.5도 아니다 — 모른다는 것을 숫자로 적으면
 * 줄이 바뀔 때마다 그 숫자가 게이지를 제 쪽으로 끌어당긴다.
 */
export function evenness(beats: readonly number[], window: number = WINDOW): number | null {
  const from = Math.max(1, beats.length - window);
  const gaps: number[] = [];
  for (let i = from; i < beats.length; i++) {
    const gap = Math.min(Math.max(beats[i] - beats[i - 1], MIN_GAP), MAX_GAP);
    gaps.push(Math.log(gap));
  }
  if (gaps.length < MIN_GAPS) return null;

  const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
  const variance = gaps.reduce((sum, g) => sum + (g - mean) ** 2, 0) / gaps.length;
  return clamp01(Math.exp(-((Math.sqrt(variance) / TOLERANCE) ** 2)));
}

export const GAUGE = {
  /**
   * 손을 뗀 뒤 이만큼까지는 숨 고르는 것으로 봐준다.
   *
   * 줄이 바뀌는 자리에서는 누구나 한 번 쉰다. 그 쉼까지 새는 것으로 치면 줄 끝마다
   * 게이지가 꺾여, 한 호흡에 한 줄이라는 데이터의 뜻과 어긋난다.
   */
  graceMs: 1000,
  /** 멈춰 있는 동안 가득에서 바닥까지 걸리는 시간 */
  drainMs: 4500,
  /**
   * 고름을 따라 차오르는 데 걸리는 시간.
   *
   * 고름을 곧이곧대로 따라가면 게이지가 눈앞에서 파닥거린다. 느리게 따라가는 것이
   * 곧 한 번 더 고르는 것이라, 화면이 조용해지는 동시에 눈금도 믿을 만해진다.
   */
  riseMs: 2000,
  /** 내려가는 데 걸리는 시간. 오르는 쪽보다 느긋해야 한 번 삐끗했다고 무너지지 않는다. */
  fallMs: 3200,
} as const;

/**
 * 게이지를 한 프레임 옮긴다.
 *
 * 타이핑RPG의 콤보게이지와 뼈대가 같다 — 치는 동안 차고 손을 떼면 준다. 다른 것은
 * 차오르는 조건뿐이다. 저쪽은 일정 **속도** 위여야 차고, 여기서는 **고름**이 곧
 * 차오를 높이다. 게이지라는 압박은 그대로 두고 겨루는 것만 바꾼다.
 */
export function stepGauge(
  gauge: number,
  target: number | null,
  sinceLastBeatMs: number,
  dtMs: number,
): number {
  if (sinceLastBeatMs > GAUGE.graceMs) return clamp01(gauge - dtMs / GAUGE.drainMs);
  // 아직 리듬을 모르는 동안은 그대로 둔다. 줄이 바뀐 직후가 이 자리다.
  if (target === null) return gauge;

  const rising = target > gauge;
  const step = dtMs / (rising ? GAUGE.riseMs : GAUGE.fallMs);
  return clamp01(rising ? Math.min(target, gauge + step) : Math.max(target, gauge - step));
}

/**
 * 결과 화면에 보여 줄 이름.
 *
 * 숫자 대신 상태를 말한다. 87%는 다음 판에 88%를 노리게 만들지만 "잔잔"은 그렇지
 * 않다 — 기도문 위에 올릴 눈금으로는 이쪽이 맞다.
 */
export function rhythmGrade(value: number): string {
  if (value >= 0.8) return "고요";
  if (value >= 0.6) return "잔잔";
  if (value >= 0.4) return "일렁임";
  return "가쁨";
}
