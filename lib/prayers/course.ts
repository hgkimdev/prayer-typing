import { PRAYERS, PRAYER_SETS } from "./catalog";
import { expandSet, getPrayer, getPrayerSet } from "./registry";
import { prayerStats, type PrayerCategory, type PrayerStats } from "./types";

/**
 * 연습 한 판.
 *
 * 화면은 "기도문 하나"와 "묵주기도 같은 묶음"을 구별할 이유가 없다. 둘 다
 * 결국 줄을 차례로 치는 일이다. 그 차이를 여기서 지워 두면 연습 화면은
 * 엔진에 줄 목록을 넘기는 일만 하면 된다.
 */
export type Course = {
  id: string;
  title: string;
  latin?: string;
  category: PrayerCategory;
  level: number;
  /** 본문을 공인 기도서와 대조하지 않았다. 화면에 알려야 한다. */
  unverified: boolean;
  /** 여러 기도문을 엮은 묶음인가 */
  composite: boolean;
  /** 엔진에 그대로 넘기는 줄 목록 */
  lines: string[];
  /** 줄들이 어느 기도문에서 왔는지. 줄마다가 아니라 도막마다 하나다. */
  segments: CourseSegment[];
  stats: PrayerStats;
};

/**
 * 같은 기도문에서 잇달아 온 줄 묶음.
 *
 * 줄마다 출신을 적어 두면 묵주기도 한 단에서만 똑같은 값이 61벌 복제되어
 * 클라이언트로 건너간다. 도막은 세 개면 끝난다.
 */
export type CourseSegment = {
  prayerId: string;
  title: string;
  /** 같은 기도문을 반복할 때 몇 번째인지. 1부터. */
  repetition: number;
  repeatOf: number;
  label?: string;
  /** 이 도막이 시작하는 줄 번호. 0부터. */
  startLine: number;
  lineCount: number;
};

/** `lineIndex`번째 줄이 속한 도막. */
export function segmentAt(course: Course, lineIndex: number): CourseSegment | undefined {
  return course.segments.find(
    (s) => lineIndex >= s.startLine && lineIndex < s.startLine + s.lineCount,
  );
}

export function buildCourse(id: string): Course | undefined {
  const prayer = getPrayer(id);
  if (prayer) {
    return {
      id: prayer.id,
      title: prayer.title,
      latin: prayer.latin,
      category: prayer.category,
      level: prayer.level,
      unverified: Boolean(prayer.unverified),
      composite: false,
      lines: [...prayer.lines],
      segments: [
        {
          prayerId: prayer.id,
          title: prayer.title,
          repetition: 1,
          repeatOf: 1,
          startLine: 0,
          lineCount: prayer.lines.length,
        },
      ],
      stats: prayerStats(prayer),
    };
  }

  const set = getPrayerSet(id);
  if (!set) return undefined;

  const lines: string[] = [];
  const segments: CourseSegment[] = [];
  for (const segment of expandSet(set)) {
    segments.push({
      prayerId: segment.prayer.id,
      title: segment.prayer.title,
      repetition: segment.repetition,
      repeatOf: segment.repeatOf,
      label: segment.label,
      startLine: lines.length,
      lineCount: segment.prayer.lines.length,
    });
    lines.push(...segment.prayer.lines);
  }

  const lengths = lines.map((line) => [...line].length);
  return {
    id: set.id,
    title: set.title,
    latin: set.latin,
    category: set.category,
    level: set.level,
    // 엮인 기도문 중 하나라도 대조가 안 끝났으면 묶음 전체가 미검증이다.
    unverified:
      Boolean(set.unverified) || set.steps.some((s) => getPrayer(s.prayerId)?.unverified),
    composite: true,
    lines,
    segments,
    stats: {
      lineCount: lines.length,
      charCount: lengths.reduce((sum, n) => sum + n, 0),
      longestLine: lengths.reduce((max, n) => (n > max ? n : max), 0),
    },
  };
}

/** 연습할 수 있는 모든 id. 정적 경로를 미리 만드는 데 쓴다. */
export function allCourseIds(): string[] {
  return [...PRAYERS.map((p) => p.id), ...PRAYER_SETS.map((s) => s.id)];
}

/** 익히는 순서대로 늘어놓은 연습 목록. 목록 화면이 쓴다. */
export function allCourses(): Course[] {
  return allCourseIds()
    .map(buildCourse)
    .filter((c): c is Course => c !== undefined)
    .sort((a, b) => a.level - b.level || a.title.localeCompare(b.title, "ko"));
}
