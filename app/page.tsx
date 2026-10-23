import RoutineBuilder from "@/components/RoutineBuilder";
import rawData from "@/data/courses.json";
import type { CourseData } from "@/lib/types";

export default function Home() {
  return <RoutineBuilder data={rawData as CourseData} />;
}
