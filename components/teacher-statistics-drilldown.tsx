"use client";

import { useEffect, useMemo, useState } from "react";
import { ProgressBar } from "@/components/progress-bar";
import { completionPercent, cx, formatDate } from "@/lib/utils";

type DrilldownStatus = "GREEN" | "YELLOW" | "RED" | null;

type DrilldownTopic = {
  id: string;
  title: string;
  totalNumbers: number;
  homeworkNumbers: Array<{
    id: string;
    number: number;
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
    label: "Зеленые",
    valueKey: "greenCount" as const,
    className: "border-emerald-200 bg-emerald-50 text-emerald-900"
  },
  {
    key: "yellow",
    label: "Желтые",
    valueKey: "yellowCount" as const,
    className: "border-amber-200 bg-amber-50 text-amber-900"
  },
  {
    key: "red",
    label: "Красные",
    valueKey: "redCount" as const,
    className: "border-rose-200 bg-rose-50 text-rose-900"
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
      <div className="ui-panel-soft rounded-[28px] border-dashed px-5 py-10 text-center">
        <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Пока недостаточно данных для персонального среза</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.86fr_1.14fr]">
      <article className="ui-surface rounded-[20px] border p-4 sm:p-5">
        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--theme-text-muted)]">Тема</span>
            <select
              value={selectedTopic?.id ?? ""}
              onChange={(event) => setSelectedTopicId(event.target.value)}
              className="ui-input w-full rounded-[16px] px-4 py-3 text-sm font-medium"
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--theme-text-muted)]">Ученик</span>
            <select
              value={selectedStudent?.id ?? ""}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className="ui-input w-full rounded-[16px] px-4 py-3 text-sm font-medium"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--theme-text-muted)]">ДЗ</span>
            <select
              value={selectedAssignmentId}
              onChange={(event) => setSelectedAssignmentId(event.target.value)}
              className="ui-input w-full rounded-[16px] px-4 py-3 text-sm font-medium"
            >
              <option value="__all__">Вся тема</option>
              {assignmentOptions.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.label} · {assignment.deadlineLabel}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ui-card-soft mt-5 rounded-[18px] px-4 py-4">
          <p className="text-sm font-medium text-[var(--theme-text-muted)]">Выбрано</p>
          <p className="mt-2 text-lg font-semibold text-[var(--theme-text-strong)]">{selectedTopic?.title ?? "Тема не выбрана"}</p>
          <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
            {selectedStudent?.name ?? "Ученик не выбран"}
            {selectedStudent ? ` · ${selectedStudent.email}` : ""}
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--theme-text-default)]">
            {selectedAssignment ? `${selectedAssignment.label} · ${selectedAssignment.deadlineLabel}` : "Вся тема"}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm text-[var(--theme-text-muted)]">
              <span>Решено в теме</span>
              <span className="font-semibold text-[var(--theme-text-strong)]">
                {metrics.solvedCount} / {metrics.totalNumbers}
              </span>
            </div>
            <ProgressBar value={metrics.solvedPercent} size="sm" />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm text-[var(--theme-text-muted)]">
              <span>Отмечено вообще</span>
              <span className="font-semibold text-[var(--theme-text-strong)]">
                {metrics.markedCount} / {metrics.totalNumbers}
              </span>
            </div>
            <ProgressBar value={metrics.markedPercent} size="sm" />
          </div>
        </div>
      </article>

      <article className="ui-surface rounded-[20px] border p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {statusCards.map((card) => (
            <div key={card.key} className={cx("rounded-[18px] border px-4 py-4", card.className)}>
              <p className="text-sm font-medium">{card.label}</p>
              <p className="mt-2 font-display text-3xl font-semibold">
                {metrics[card.valueKey]}
              </p>
            </div>
          ))}
        </div>

        <div className="ui-progress-track mt-5 overflow-hidden rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-soft)] shadow-[inset_0_1px_1px_rgba(15,23,42,0.06)]">
          <div className="flex h-2.5 w-full">
            <RatioSegment value={metrics.greenCount} total={metrics.totalNumbers} className="bg-[rgba(16,185,129,0.72)]" />
            <RatioSegment value={metrics.yellowCount} total={metrics.totalNumbers} className="bg-[rgba(245,158,11,0.72)]" />
            <RatioSegment value={metrics.redCount} total={metrics.totalNumbers} className="bg-[rgba(244,63,94,0.72)]" />
            <RatioSegment value={metrics.unmarkedCount} total={metrics.totalNumbers} className="bg-[rgba(148,163,184,0.55)]" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-900">
            Зеленых: {metrics.greenCount}
          </span>
          <span className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900">
            Желтых: {metrics.yellowCount}
          </span>
          <span className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-900">
            Красных: {metrics.redCount}
          </span>
          <span className="ui-badge-soft rounded-[12px] px-3 py-1.5">
            Без статуса: {metrics.unmarkedCount}
          </span>
        </div>

        <div className="ui-panel-soft mt-5 rounded-[24px] px-4 py-4">
          <p className="text-sm font-medium text-[var(--theme-text-muted)]">Сейчас</p>
          <p className="mt-2 text-base font-semibold leading-7 text-[var(--theme-text-strong)]">{insight}</p>
        </div>
      </article>
    </div>
  );
}

function RatioSegment({
  value,
  total,
  className
}: {
  value: number;
  total: number;
  className: string;
}) {
  if (!value || !total) {
    return null;
  }

  return <div className={cx("transition-[width] duration-300 ease-out", className)} style={{ width: `${(value / total) * 100}%` }} />;
}
