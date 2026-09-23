import Link from "next/link";

import { allCourses, PRAYER_CATEGORIES, type Course } from "@/lib/prayers";

/** 목록은 기도문이 바뀌지 않는 한 그대로다. 서버에서 한 번 그린다. */
export default function Home() {
  const courses = allCourses();
  const groups = PRAYER_CATEGORIES.map((category) => ({
    category,
    courses: courses.filter((c) => c.category === category),
  })).filter((g) => g.courses.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">기도문 타자연습</h1>
        <p className="text-muted-foreground mt-2">
          손으로 옮겨 적으며 외웁니다. 한 줄을 다 치면 다음 줄로 넘어갑니다.
        </p>
      </header>

      <div className="space-y-10">
        {groups.map(({ category, courses }) => (
          <section key={category}>
            <h2 className="text-muted-foreground mb-3 text-sm font-medium">{category}</h2>
            <ul className="space-y-2">
              {courses.map((course) => (
                <li key={course.id}>
                  <CourseCard course={course} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/practice/${course.id}`}
      className="bg-card hover:border-ring block rounded-xl border p-4 transition-colors"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-muted-foreground text-xs tabular-nums">Lv.{course.level}</span>
        <span className="font-medium">{course.title}</span>
        {course.latin && (
          <span className="text-muted-foreground text-xs italic">{course.latin}</span>
        )}
        {course.unverified && (
          <span
            className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[0.7rem]"
            title="공인 기도서와 아직 대조하지 않은 본문이다."
          >
            미검증
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-1.5 text-sm tabular-nums">
        {course.stats.lineCount}줄 · {course.stats.charCount}자
      </p>
    </Link>
  );
}
