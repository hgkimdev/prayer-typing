import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PracticeSession } from "@/components/typing/practice-session";
import { allCourseIds, buildCourse } from "@/lib/prayers";

/** 기도문은 정해져 있으니 경로를 미리 다 만들어 둔다. */
export function generateStaticParams() {
  return allCourseIds().map((id) => ({ id }));
}

export async function generateMetadata(
  props: PageProps<"/practice/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const course = buildCourse(id);
  if (!course) return { title: "찾을 수 없는 기도문" };
  return {
    title: `${course.title} — 기도문 타자연습`,
    description: `${course.title}을(를) 타이핑으로 옮겨 적으며 외웁니다.`,
  };
}

export default async function PracticePage(props: PageProps<"/practice/[id]">) {
  const { id } = await props.params;
  const course = buildCourse(id);
  if (!course) notFound();
  return <PracticeSession course={course} />;
}
