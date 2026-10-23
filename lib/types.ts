// Shapes of data/courses.json and of the solver's input/output.

export interface Meeting {
  day: string; // "Saturday", "Sunday", ...
  start: string; // "HH:MM", 24-hour
  end: string;
  room: string;
}

export interface Section {
  section: string;
  faculty: string;
  facultyInitial: string;
  program: string;
  meetings: Meeting[];
  note?: string; // "If required"
}

export interface Course {
  code: string;
  title: string;
  credit: number;
  programs: string[];
  sections: Section[];
}

export interface CourseData {
  source: string;
  days: string[];
  timeSlots: string[]; // the 6 class start times
  endSlots: string[]; // the matching 6 class end times
  courses: Course[];
}

/** What the student picked. */
export interface Preferences {
  days: string[];
  start: string; // no class may start before this
  end: string; // every class must finish by this
}

export interface PlanChoice {
  course: Course;
  section: Section;
  alternatives: Section[]; // other sections of this course at exactly the same days/times
}

export interface Plan {
  choices: PlanChoice[]; // one per added course, in the order the courses were added
  usesIfRequired: boolean;
  gapMinutes: number; // total free time between classes (short breaks not counted)
  campusDays: number; // how many days the student has to come in
}
