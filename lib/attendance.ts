// Посещаемость групповых занятий: чистая логика над LessonParticipant.attendance.
// Отметки ставятся автоматически (вход во вкладку «Урок»/сдача → «был»,
// закрытие урока без активности → «не был») и правятся учителем вручную.

export type AttendanceValue = "UNKNOWN" | "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

export const ATTENDANCE_META: Record<AttendanceValue, { label: string; short: string }> = {
  UNKNOWN: { label: "не отмечено", short: "—" },
  PRESENT: { label: "был", short: "был" },
  LATE: { label: "опоздал", short: "опозд." },
  ABSENT: { label: "не был", short: "нет" },
  EXCUSED: { label: "по уважительной", short: "уваж." }
};

/** Порядок переключения по клику в таблице: был → опоздал → не был → уважительная → был. */
export function nextAttendance(current: AttendanceValue): AttendanceValue {
  switch (current) {
    case "PRESENT":
      return "LATE";
    case "LATE":
      return "ABSENT";
    case "ABSENT":
      return "EXCUSED";
    default:
      return "PRESENT";
  }
}

export type AttendanceSummary = {
  /** Занятий с известной отметкой. */
  counted: number;
  attended: number; // был + опоздал
  late: number;
  absent: number;
  excused: number;
  /** Доля посещённых среди занятий без уважительной причины; null — считать не из чего. */
  percent: number | null;
};

export function summarizeAttendance(values: AttendanceValue[]): AttendanceSummary {
  let attended = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const value of values) {
    if (value === "PRESENT") attended += 1;
    else if (value === "LATE") {
      attended += 1;
      late += 1;
    } else if (value === "ABSENT") absent += 1;
    else if (value === "EXCUSED") excused += 1;
  }

  const counted = attended + absent + excused;
  // Уважительная причина процент не портит: делим на занятия, где ученик мог быть.
  const base = counted - excused;

  return {
    counted,
    attended,
    late,
    absent,
    excused,
    percent: base > 0 ? Math.round((attended / base) * 100) : null
  };
}

/** Итог по окончании урока для неотмеченного участника: была активность — «был», нет — «не был». */
export function decideEndOfLessonAttendance(input: { current: AttendanceValue; hadActivity: boolean }): AttendanceValue | null {
  if (input.current !== "UNKNOWN") {
    return null;
  }

  return input.hadActivity ? "PRESENT" : "ABSENT";
}

export function formatAttendanceSummary(summary: AttendanceSummary) {
  if (summary.counted === 0) {
    return "занятий не было";
  }

  const parts = [`был на ${summary.attended} из ${summary.counted}`];

  if (summary.late > 0) parts.push(`опозданий ${summary.late}`);
  if (summary.excused > 0) parts.push(`по уважительной ${summary.excused}`);
  if (summary.percent !== null) parts.push(`${summary.percent}%`);

  return parts.join(" · ");
}
