/**
 * 기도문 데이터의 모양.
 *
 * 타자 엔진(`useTypingEngine`)이 `string[]` 한 줄씩을 받아 진행하므로, 기도문은
 * 결국 "줄의 목록"이다. 다만 줄을 어디서 끊느냐가 연습의 호흡을 정하기 때문에
 * 화면 너비에 맡기지 않고 데이터에 미리 새겨 둔다.
 */

export const PRAYER_CATEGORIES = ["기본", "묵주", "미사", "성인", "기타"] as const;

/** 기도문 분류. 화면에서 묶어 보여 주는 단위이자 RPG의 "지역"에 해당한다. */
export type PrayerCategory = (typeof PRAYER_CATEGORIES)[number];

export type Prayer = {
  /** 슬러그. 진행도 저장 키로 쓰이므로 한번 정하면 바꾸지 않는다. */
  id: string;
  title: string;
  /** 라틴어 이름. 없는 기도문도 있다. */
  latin?: string;
  category: PrayerCategory;
  /**
   * 1부터. 낮을수록 먼저 익힌다. 잠금 해제 순서이자 난이도 티어다.
   *
   * 글자 수에서 자동으로 뽑지 않는다 — 짧아도 어려운 기도문(라틴어 음차)이 있고,
   * 무엇보다 배우는 순서는 길이가 아니라 전례에서의 쓰임이 정하기 때문이다.
   */
  level: number;
  /**
   * 한 줄이 한 호흡. 기도서의 행갈이를 그대로 따른다.
   *
   * 빈 줄은 넣을 수 없다. 엔진은 입력이 들어와야 다음 줄로 넘어가는데 빈 줄은
   * 칠 것이 없어 영원히 멈춘다. 단락을 나누고 싶으면 `PrayerSet`의 단계로 쪼갠다.
   */
  lines: string[];
  /**
   * 어느 기도서를 옮겼는지. 전례문은 임의로 고칠 수 없으므로 출처가 곧 근거다.
   * 대조가 끝나지 않은 기도문은 `unverified`를 세워 둔다.
   */
  source: string;
  /** 본문을 아직 공인 기도서와 대조하지 못했다. 화면에 경고를 띄우는 근거. */
  unverified?: boolean;
  note?: string;
};

/**
 * 다른 기도문을 엮어 만드는 기도. 묵주기도처럼 같은 기도문을 반복하는 경우다.
 *
 * 본문을 복사해 두지 않고 `prayerId`로 가리킨다. 기도문을 고쳤을 때 사본이
 * 뒤처지는 일이 없어야 하고, 진행도도 "성모송을 몇 번 쳤나"로 한 군데에 쌓인다.
 */
export type PrayerSetStep = {
  prayerId: string;
  /** 이어서 몇 번 반복하는지. 묵주기도 한 단의 성모송은 10이다. */
  repeat: number;
  /** 이 단계에 붙는 이름. 묵주기도의 신비 제목 같은 것. */
  label?: string;
};

export type PrayerSet = {
  id: string;
  title: string;
  latin?: string;
  category: PrayerCategory;
  level: number;
  steps: PrayerSetStep[];
  source: string;
  unverified?: boolean;
  note?: string;
};

export type PrayerStats = {
  lineCount: number;
  /** 공백을 포함한 전체 글자 수. 보상과 예상 소요 시간의 바탕. */
  charCount: number;
  /** 가장 긴 줄의 글자 수. 한 호흡이 너무 길지 않은지 보는 눈금. */
  longestLine: number;
};

export function prayerStats(prayer: Prayer): PrayerStats {
  const lengths = prayer.lines.map((line) => [...line].length);
  return {
    lineCount: lengths.length,
    charCount: lengths.reduce((sum, n) => sum + n, 0),
    longestLine: lengths.reduce((max, n) => (n > max ? n : max), 0),
  };
}

/** 줄을 이어 붙인 전문. 읽기 화면이나 검색에 쓴다. */
export function prayerText(prayer: Prayer): string {
  return prayer.lines.join("\n");
}
