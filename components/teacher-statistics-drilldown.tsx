"use client";

import { useEffect, useMemo, useState } from "react";
import { ShbzSelect } from "@/components/shbz-select";
import { completionPercent, formatDate } from "@/lib/utils";

type DrilldownStatus = "GREEN" | "YELLOW" | "RED" | null;

type DrilldownTopic = {
  id: string;
  title: string;
  totalNumbers: number;
  homeworkNumbers: Array<{
    id: string;
    number: string;
    statuses: Array<{
      studentId: string;
      status: DrilldownStatus;
      deadlineAt: string | null;
    }>;
  }>;
};

type DrilldownStudent = {
  id: string;
  name: string;
  email: string;
};

type TeacherStatisticsDrilldownProps = {
  topics: DrilldownTopic[];
  students: DrilldownStudent[];
};

type AssignmentOption = {
  id: string;
  label: string;
  deadlineLabel: string;
  totalNumbers: number;
};

const statusCards = [
  {
    key: "green",
    label: "Зелёные",
    valueKey: "greenCount" as const,
    bg: "var(--shbz-green-soft)",
    labelColor: "var(--shbz-green-text)"
  },
  {
    key: "yellow",
    label: "Жёлтые",
    valueKey: "yellowCount" as const,
    bg: "var(--shbz-yellow-soft)",
    labelColor: "var(--shbz-yellow-text)"
  },
  {
    key: "red",
    label: "Красные",
    valueKey: "redCount" as const,
    bg: "var(--shbz-red-soft)",
    labelColor: "var(--shbz-red-text)"
  }
];

export function TeacherStatisticsDrilldown({
  topics,
  students
}: TeacherStatisticsDrilldownProps) {
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id ?? "");
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id ?? "");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("__all__");

  useEffect(() => {
    if (topics.length && !topics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(topics[0]?.id ?? "");
    }
  }, [selectedTopicId, topics]);

  useEffect(() => {
    if (students.length && !students.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(students[0]?.id ?? "");
    }
  }, [selectedStudentId, students]);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0] ?? null,
    [selectedTopicId, topics]
  );
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? students[0] ?? null,
    [selectedStudentId, students]
  );
  const assignmentOptions = useMemo<AssignmentOption[]>(() => {
    if (!selectedTopic || !selectedStudent) {
      return [];
    }

    const grouped = new Map<string, number>();

    for (const number of selectedTopic.homeworkNumbers) {
      const statusEntry = number.statuses.find((status) => status.studentId === selectedStudent.id);

      if (!statusEntry?.deadlineAt) {
        continue;
      }

      grouped.set(statusEntry.deadlineAt, (grouped.get(statusEntry.deadlineAt) ?? 0) + 1);
    }

    return Array.from(grouped.entries())
      .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
      .map(([deadlineAt, totalNumbers], index) => ({
        id: deadlineAt,
        label: `ДЗ ${index + 1}`,
        deadlineLabel: formatDate(deadlineAt),
        totalNumbers
      }));
  }, [selectedStudent, selectedTopic]);

  useEffect(() => {
    if (selectedAssignmentId === "__all__") {
      return;
    }

    if (!assignmentOptions.some((assignment) => assignment.id === selectedAssignmentId)) {
      setSelectedAssignmentId("__all__");
    }
  }, [assignmentOptions, selectedAssignmentId]);

  const selectedAssignment = useMemo(
    () => assignmentOptions.find((assignment) => assignment.id === selectedAssignmentId) ?? null,
    [assignmentOptions, selectedAssignmentId]
  );

  const metrics = useMemo(() => {
    if (!selectedTopic || !selectedStudent) {
      return {
        totalNumbers: 0,
        greenCount: 0,
        yellowCount: 0,
        redCount: 0,
        markedCount: 0,
        solvedCount: 0,
        unmarkedCount: 0,
        solvedPercent: 0,
        markedPercent: 0
      };
    }

    const scopedNumbers =
      selectedAssignmentId === "__all__"
        ? selectedTopic.homeworkNumbers
        : selectedTopic.homeworkNumbers.filter((number) => {
            const statusEntry = number.statuses.find((status) => status.studentId === selectedStudent.id);
            return statusEntry?.deadlineAt === selectedAssignmentId;
          });

    let greenCount = 0;
    let yellowCount = 0;
    let redCount = 0;

    for (const number of scopedNumbers) {
      const statusEntry = number.statuses.find((status) => status.studentId === selectedStudent.id);

      if (statusEntry?.status === "GREEN") {
        greenCount += 1;
      } else if (statusEntry?.status === "YELLOW") {
        yellowCount += 1;
      } else if (statusEntry?.status === "RED") {
        redCount += 1;
      }
    }

    const totalNumbers = scopedNumbers.length;
    const markedCount = greenCount + yellowCount + redCount;
    const solvedCount = greenCount + yellowCount;
    const unmarkedCount = Math.max(totalNumbers - markedCount, 0);

    return {
      totalNumbers,
      greenCount,
      yellowCount,
      redCount,
      markedCount,
      solvedCount,
      unmarkedCount,
      solvedPercent: completionPercent(solvedCount, totalNumbers),
        markedPercent: completionPercent(markedCount, totalNumbers)
      };
  }, [selectedAssignmentId, selectedStudent, selectedTopic]);

  const insight = useMemo(() => {
    if (!selectedTopic || !selectedStudent) {
      return "Сначала выберите тему и ученика.";
    }

    const scopeLabel = selectedAssignment ? `в ${selectedAssignment.label.toLowerCase()}` : "в теме";

    if (metrics.totalNumbers === 0) {
      return selectedAssignment
        ? `В выбранном ДЗ пока нет номеров, поэтому сравнивать прогресс еще рано.`
        : "В выбранной теме пока нет номеров, поэтому сравнивать прогресс еще рано.";
    }

    if (metrics.redCount > 0) {
      return `${selectedStudent.name} сейчас имеет ${metrics.redCount} красн. статусов ${scopeLabel}. Это хороший кандидат на ближайший разбор.`;
    }

    if (metrics.solvedCount === metrics.totalNumbers) {
      return selectedAssignment
        ? `${selectedStudent.name} полностью закрыл ${selectedAssignment.label.toLowerCase()}: все номера отмечены зеленым или желтым.`
        : `${selectedStudent.name} полностью закрыл эту тему: все номера отмечены зеленым или желтым.`;
    }

    if (metrics.markedCount === 0) {
      return selectedAssignment
        ? `${selectedStudent.name} еще не начал ${selectedAssignment.label.toLowerCase()}.`
        : `${selectedStudent.name} еще не начал эту тему. Здесь можно быстро увидеть стартовую точку перед выдачей задания.`;
    }

    return `${selectedStudent.name} уже разобрал ${metrics.solvedCount} из ${metrics.totalNumbers} номеров ${scopeLabel}. Осталось добрать еще ${metrics.totalNumbers - metrics.solvedCount}.`;
  }, [metrics, selectedAssignment, selectedStudent, selectedTopic]);

  if (!topics.length || !students.length) {
    return (
      <div className="shbz-panel-soft px-6 py-10 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          Пока недостаточно данных для персонального среза
        </p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Тема
          </span>
          <ShbzSelect
            ariaLabel="Тема"
            value={selectedTopic?.id ?? ""}
            onChange={setSelectedTopicId}
            options={topics.map((topic) => ({ value: topic.id, label: topic.title }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Ученик
          </span>
          <ShbzSelect
            ariaLabel="Ученик"
            value={selectedStudent?.id ?? ""}
            onChange={setSelectedStudentId}
            options={students.map((student) => ({ value: student.id, label: student.name }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            ДЗ
          </span>
          <ShbzSelect
            ariaLabel="ДЗ"
            value={selectedAssignmentId}
            onChange={setSelectedAssignmentId}
            options={[
              { value: "__all__", label: "Вся тема" },
              ...assignmentOptions.map((assignment) => ({
                value: assignment.id,
                label: `${assignment.label} · ${assignment.deadlineLabel}`
              }))
            ]}
          />
        </div>

        <div className="mt-1">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
              Решено в теме
            </span>
            <span className="text-sm font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
              {metrics.solvedCount} / {metrics.totalNumbers}
            </span>
          </div>
          <div className="shbz-progress-track">
            <div className="shbz-progress-fill" style={{ width: `${metrics.solvedPercent}%` }} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
              Отмечено вообще
            </span>
            <span className="text-sm font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
              {metrics.markedCount} / {metrics.totalNumbers}
            </span>
          </div>
          <div className="shbz-progress-track">
            <div className="shbz-progress-fill" style={{ width: `${metrics.markedPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {statusCards.map((card) => (
            <div key={card.key} className="rounded-2xl px-5 py-[18px]" style={{ background: card.bg }}>
              <div className="text-sm font-semibold" style={{ color: card.labelColor }}>
                {card.label}
              </div>
              <div className="mt-1.5 text-[40px] font-extrabold leading-none" style={{ color: "var(--shbz-text-strong)" }}>
                {metrics[card.valueKey]}
              </div>
            </div>
          ))}
        </div>

        <div className="shbz-progress-track" style={{ height: 10 }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${metrics.solvedPercent}%`, background: "var(--shbz-accent-grad)" }}
          />
        </div>

        <div className="shbz-panel-soft px-[22px] py-5">
          <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
            Сейчас
          </div>
          <div className="mt-2 text-[17px] font-bold leading-[1.45]" style={{ color: "var(--shbz-text-strong)" }}>
            {insight}
          </div>
        </div>
      </div>
    </div>
  );
}
