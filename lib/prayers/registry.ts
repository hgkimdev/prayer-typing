import { PRAYERS, PRAYER_SETS } from "./catalog";
import {
  prayerStats,
  type Prayer,
  type PrayerCategory,
  type PrayerSet,
  type PrayerStats,
} from "./types";

export { PRAYERS, PRAYER_SETS };

const byId = new Map(PRAYERS.map((p) => [p.id, p]));
const setById = new Map(PRAYER_SETS.map((s) => [s.id, s]));

export function getPrayer(id: string): Prayer | undefined {
  return byId.get(id);
}

export function getPrayerSet(id: string): PrayerSet | undefined {
  return setById.get(id);
}

/** 익히는 순서. 같은 단계면 제목순으로 안정되게 묶는다. */
export function orderedPrayers(): Prayer[] {
  return [...PRAYERS].sort((a, b) => a.level - b.level || a.title.localeCompare(b.title, "ko"));
}

export function prayersByCategory(category: PrayerCategory): Prayer[] {
  return orderedPrayers().filter((p) => p.category === category);
}

/**
 * 묶음 기도의 한 도막. 같은 기도문을 열 번 치더라도 몇 번째인지 알아야
 * "성모송 10번 중 3번째"를 화면에 띄울 수 있다.
 */
export type PrayerSegment = {
  prayer: Prayer;
  /** 1부터. 반복이 없으면 언제나 1. */
  repetition: number;
  repeatOf: number;
  label?: string;
};

/** 묶음을 도막 목록으로 편다. 반복은 여기서 풀린다. */
export function expandSet(set: PrayerSet): PrayerSegment[] {
  const segments: PrayerSegment[] = [];
  for (const step of set.steps) {
    const prayer = byId.get(step.prayerId);
    if (!prayer) continue; // validateCatalog가 잡는다. 화면은 멈추지 않는 편이 낫다.
    for (let i = 1; i <= step.repeat; i++) {
      segments.push({ prayer, repetition: i, repeatOf: step.repeat, label: step.label });
    }
  }
  return segments;
}

/** 묶음 전체를 엔진에 그대로 넣을 수 있는 줄 목록으로. */
export function setLines(set: PrayerSet): string[] {
  return expandSet(set).flatMap((segment) => segment.prayer.lines);
}

export function setStats(set: PrayerSet): PrayerStats {
  return expandSet(set).reduce<PrayerStats>(
    (acc, segment) => {
      const s = prayerStats(segment.prayer);
      return {
        lineCount: acc.lineCount + s.lineCount,
        charCount: acc.charCount + s.charCount,
        longestLine: Math.max(acc.longestLine, s.longestLine),
      };
    },
    { lineCount: 0, charCount: 0, longestLine: 0 },
  );
}

/**
 * 데이터가 엔진이 견딜 수 있는 모양인지 본다. 문제를 사람이 읽을 문장으로 돌려준다.
 *
 * 빈 줄 하나면 그 줄에서 연습이 영영 멈추는데, 화면만 보면 왜 멈췄는지 알 수 없다.
 * 그래서 화면에 닿기 전에 잡는다.
 */
export function validateCatalog(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const p of PRAYERS) {
    const at = `기도문 "${p.id}"`;
    if (seen.has(p.id)) problems.push(`${at}: id가 겹친다.`);
    seen.add(p.id);
    if (p.level < 1) problems.push(`${at}: level은 1 이상이어야 한다.`);
    if (p.lines.length === 0) problems.push(`${at}: 줄이 하나도 없다.`);
    p.lines.forEach((line, i) => {
      if (line.trim() === "") problems.push(`${at} ${i + 1}번째 줄: 빈 줄은 둘 수 없다.`);
      else if (line !== line.trim()) problems.push(`${at} ${i + 1}번째 줄: 앞뒤에 공백이 있다.`);
      if (line.includes("\n")) problems.push(`${at} ${i + 1}번째 줄: 줄바꿈이 들어 있다.`);
    });
  }

  for (const s of PRAYER_SETS) {
    const at = `묶음 "${s.id}"`;
    if (seen.has(s.id)) problems.push(`${at}: id가 기도문과 겹친다.`);
    seen.add(s.id);
    if (s.steps.length === 0) problems.push(`${at}: 단계가 하나도 없다.`);
    for (const step of s.steps) {
      if (!byId.has(step.prayerId)) problems.push(`${at}: 없는 기도문 "${step.prayerId}"을 가리킨다.`);
      if (step.repeat < 1) problems.push(`${at}: "${step.prayerId}"의 repeat이 1보다 작다.`);
    }
  }

  return problems;
}

// 손으로 고치는 데이터라 오타가 난다. 개발 중에는 바로 터뜨려 알린다 —
// 조용히 넘어가면 연습 화면이 멈춘 뒤에야 알게 된다.
if (process.env.NODE_ENV !== "production") {
  const problems = validateCatalog();
  if (problems.length > 0) {
    throw new Error(`기도문 데이터에 문제가 있다:\n- ${problems.join("\n- ")}`);
  }
}
