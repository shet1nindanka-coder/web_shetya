/*
 * Тестовые аккаунты с историей: учитель, группа из трёх учеников и один
 * индивидуальный ученик. Поверх СУЩЕСТВУЮЩИХ тем и задачника (темы общие для
 * всех, новых не создаём). Ничего не стирает: трогает только пользователей
 * с почтой @shbz.test. Безопасно для прода.
 *
 * Запуск: npx tsx scripts/create-test-accounts.ts [--password test1234] [--reset]
 *   --reset — удалить прежние тестовые аккаунты (каскадом: уроки, ДЗ, статусы) и создать заново.
 */

import {
  AttendanceStatus,
  HomeworkNumberStatus,
  LessonItemResult,
  LessonStatus,
  PrismaClient,
  SolutionCheckStatus,
  SolutionVerdict,
  UserRole
} from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();

const TEST_DOMAIN = "@shbz.test";
const TEACHER_EMAIL = `test.teacher${TEST_DOMAIN}`;
const DAY = 24 * 60 * 60_000;

type StudentSpec = {
  email: string;
  name: string;
  speed: number;
  aiNote: string;
  /** Доля зелёных в старой теме и в текущей: сильный / средний / слабый. */
  profile: "strong" | "average" | "weak";
  inGroup: boolean;
};

const STUDENTS: StudentSpec[] = [
  { email: `test.student1${TEST_DOMAIN}`, name: "Артём Тестовый", speed: 8, aiNote: "Быстро считает, но пропускает проверку ОДЗ.", profile: "strong", inGroup: true },
  { email: `test.student2${TEST_DOMAIN}`, name: "Полина Тестовая", speed: 5, aiNote: "Аккуратная, теряется в длинных выкладках.", profile: "average", inGroup: true },
  { email: `test.student3${TEST_DOMAIN}`, name: "Кирилл Тестовый", speed: 3, aiNote: "Нужны короткие шаги и повтор формул.", profile: "weak", inGroup: true },
  { email: `test.student4${TEST_DOMAIN}`, name: "Даша Тестовая", speed: 6, aiNote: "Индивидуальные занятия, готовится к контрольной.", profile: "average", inGroup: false }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const passwordIndex = args.indexOf("--password");

  return {
    password: passwordIndex >= 0 ? args[passwordIndex + 1] ?? "test1234" : "test1234",
    reset: args.includes("--reset")
  };
}

function daysAgo(days: number, hour = 12, minute = 0) {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// Детерминированный «случайный» выбор — прогон воспроизводим.
function pick<T>(items: T[], seed: number) {
  return items[seed % items.length]!;
}

/** Срез с «заворотом»: короткая тема всё равно даёт нужное число разных номеров. */
function takeWrap<T extends { id: string }>(items: T[], start: number, count: number): T[] {
  const result: T[] = [];
  const seen = new Set<string>();

  for (let offset = 0; offset < items.length && result.length < count; offset += 1) {
    const item = items[(start + offset) % items.length]!;

    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }

  return result;
}

const MIN_NUMBERS_PER_TOPIC = 4;

const RESULT_TO_STATUS: Record<LessonItemResult, HomeworkNumberStatus | null> = {
  SOLVED: HomeworkNumberStatus.GREEN,
  PARTIAL: HomeworkNumberStatus.YELLOW,
  NOT_SOLVED: HomeworkNumberStatus.RED,
  SKIPPED: null
};

async function main() {
  const { password, reset } = parseArgs();

  const existing = await prisma.user.findMany({ where: { email: { endsWith: TEST_DOMAIN } }, select: { id: true, email: true } });

  if (existing.length > 0) {
    if (!reset) {
      console.error(
        `Тестовые аккаунты уже есть (${existing.map((user) => user.email).join(", ")}). ` +
          "Запустите с --reset, чтобы пересоздать их с чистой историей."
      );
      process.exit(1);
    }

    // Каскад: у учителя — группы и уроки, у учеников — статусы, ДЗ, участие в уроках, звонки.
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    console.log(`Удалены прежние тестовые аккаунты: ${existing.length}.`);
  }

  const topics = await prisma.topic.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      homeworkNumbers: { orderBy: { displayOrder: "asc" }, select: { id: true, number: true } }
    }
  });
  const usableTopics = topics.filter((topic) => topic.homeworkNumbers.length >= MIN_NUMBERS_PER_TOPIC).slice(0, 3);

  if (usableTopics.length === 0) {
    console.error(`В базе нет тем с ${MIN_NUMBERS_PER_TOPIC}+ номерами — тестовым ученикам нечего решать. Сначала добавьте темы.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const teacher = await prisma.user.create({
    data: { name: "Тестовый Учитель", email: TEACHER_EMAIL, passwordHash, role: UserRole.TEACHER },
    select: { id: true, email: true }
  });

  const group = await prisma.studentGroup.create({
    data: { name: "Тест-группа 8А", teacherId: teacher.id },
    select: { id: true }
  });

  const students: Array<StudentSpec & { id: string }> = [];

  for (const spec of STUDENTS) {
    const user = await prisma.user.create({
      data: {
        name: spec.name,
        email: spec.email,
        passwordHash,
        role: UserRole.STUDENT,
        teacherId: teacher.id,
        // Ученики «появились» месяц назад — напоминание о звонке родителям как раз созреет.
        createdAt: daysAgo(35),
        studentProfile: {
          create: { speed: spec.speed, aiNote: spec.aiNote, groupId: spec.inGroup ? group.id : null }
        }
      },
      select: { id: true }
    });

    students.push({ ...spec, id: user.id });
  }

  const [topicOld, topicCurrent = topicOld, topicNext = topicCurrent] = usableTopics;

  // ── Прогресс по темам за 30 дней ──────────────────────────────
  // Старая тема почти закрыта (25–10 дней назад), текущая в работе (12 дней назад — сегодня),
  // следующая едва начата. Даты размазаны, чтобы ожили стрик, активность и карта тем.
  const statusRows: Array<{
    studentId: string;
    homeworkNumberId: string;
    status: HomeworkNumberStatus;
    statusChangedAt: Date;
    note?: string;
  }> = [];
  const statusByStudentNumber = new Map<string, HomeworkNumberStatus>();

  const pushStatus = (studentId: string, numberId: string, status: HomeworkNumberStatus, at: Date, note?: string) => {
    statusRows.push({ studentId, homeworkNumberId: numberId, status, statusChangedAt: at, note });
    statusByStudentNumber.set(`${studentId}:${numberId}`, status);
  };

  students.forEach((student, studentIndex) => {
    const greenShare = student.profile === "strong" ? 0.85 : student.profile === "average" ? 0.6 : 0.35;

    topicOld.homeworkNumbers.forEach((number, index) => {
      const roll = (index * 7 + studentIndex * 3) % 10;
      const status =
        roll < greenShare * 10 ? HomeworkNumberStatus.GREEN : roll < greenShare * 10 + 2 ? HomeworkNumberStatus.YELLOW : HomeworkNumberStatus.RED;

      pushStatus(student.id, number.id, status, daysAgo(25 - Math.floor(index * (15 / topicOld.homeworkNumbers.length)), 18, index * 7));
    });

    const currentCount = Math.min(topicCurrent.homeworkNumbers.length, student.profile === "weak" ? 5 : 8);

    topicCurrent.homeworkNumbers.slice(0, currentCount).forEach((number, index) => {
      const roll = (index * 5 + studentIndex) % 10;
      const status =
        roll < greenShare * 10 ? HomeworkNumberStatus.GREEN : roll < greenShare * 10 + 3 ? HomeworkNumberStatus.YELLOW : HomeworkNumberStatus.RED;
      const dayOffset = Math.max(0, 12 - Math.floor(index * 1.5) - (studentIndex === 0 ? 0 : 1));

      pushStatus(
        student.id,
        number.id,
        status,
        daysAgo(dayOffset, 19, index * 5),
        index === 1 ? "Перепутал знак при раскрытии скобок" : undefined
      );
    });

    if (student.profile !== "weak" && topicNext !== topicCurrent) {
      topicNext.homeworkNumbers.slice(0, 2).forEach((number, index) => {
        pushStatus(student.id, number.id, index === 0 ? HomeworkNumberStatus.GREEN : HomeworkNumberStatus.YELLOW, daysAgo(1, 20, index * 10));
      });
    }
  });

  await prisma.studentTopicNumberStatus.createMany({ data: statusRows, skipDuplicates: true });

  // ── ДЗ + автопроверки ────────────────────────────────────────
  for (const [studentIndex, student] of students.entries()) {
    const oldNumbers = takeWrap(topicOld.homeworkNumbers, 0, 5);
    const currentNumbers = takeWrap(topicCurrent.homeworkNumbers, 0, 4);
    const overdueNumbers = takeWrap(topicCurrent.homeworkNumbers, 4, 4);
    const nextNumbers = topicNext === topicCurrent ? takeWrap(topicCurrent.homeworkNumbers, 8, 3) : takeWrap(topicNext.homeworkNumbers, 0, 3);

    const assignments = [
      { title: `ДЗ · ${topicOld.title}`, topicId: topicOld.id, numbers: oldNumbers, createdAt: daysAgo(20), deadlineAt: daysAgo(14, 20), checked: true },
      { title: `ДЗ · ${topicCurrent.title}`, topicId: topicCurrent.id, numbers: overdueNumbers, createdAt: daysAgo(9), deadlineAt: daysAgo(2, 20), checked: true },
      { title: null, topicId: topicNext.id, numbers: nextNumbers.length > 0 ? nextNumbers : currentNumbers, createdAt: daysAgo(3), deadlineAt: new Date(Date.now() + 3 * DAY), checked: false }
    ];

    for (const spec of assignments) {
      if (spec.numbers.length === 0) continue;

      const assignment = await prisma.homeworkAssignment.create({
        data: {
          studentId: student.id,
          topicId: spec.topicId,
          title: spec.title,
          createdAt: spec.createdAt,
          deadlineAt: spec.deadlineAt,
          numbers: { create: spec.numbers.map((number) => ({ homeworkNumberId: number.id })) }
        },
        select: { id: true }
      });

      // Дедлайн зеркалится в статусы, как делает выдача ДЗ.
      for (const number of spec.numbers) {
        await prisma.studentTopicNumberStatus.upsert({
          where: { studentId_homeworkNumberId: { studentId: student.id, homeworkNumberId: number.id } },
          update: { deadlineAt: spec.deadlineAt },
          create: { studentId: student.id, homeworkNumberId: number.id, deadlineAt: spec.deadlineAt }
        });
      }

      if (!spec.checked) continue;

      // Результат автопроверки согласован со статусами: зелёный — верно, красный — с ошибкой.
      await prisma.homeworkCheck.create({
        data: {
          assignmentId: assignment.id,
          status: SolutionCheckStatus.DONE,
          activeSlot: null,
          modelUsed: "test-fixture",
          createdAt: new Date(spec.deadlineAt.getTime() - 3 * 60 * 60_000),
          checkedAt: new Date(spec.deadlineAt.getTime() - 3 * 60 * 60_000 + 90_000),
          results: {
            create: spec.numbers.map((number, index) => {
              const status = statusByStudentNumber.get(`${student.id}:${number.id}`) ?? HomeworkNumberStatus.RED;
              const verdict = status === HomeworkNumberStatus.RED ? SolutionVerdict.INCORRECT : SolutionVerdict.CORRECT;
              const errorKind = pick(["SIGN", "ARITHMETIC", "DOMAIN", "BRACKETS"], index + studentIndex);

              return {
                homeworkNumberId: number.id,
                verdict,
                recognizedAnswer: verdict === SolutionVerdict.CORRECT ? "совпадает с эталоном" : "x = 3",
                comment:
                  verdict === SolutionVerdict.CORRECT
                    ? "Верно."
                    : "Ошибка вычислительного характера — пересчитай выкладки внимательнее.",
                confidence: verdict === SolutionVerdict.CORRECT ? 0.93 : 0.88,
                errorKind: verdict === SolutionVerdict.CORRECT ? "NONE" : errorKind,
                errorNote: verdict === SolutionVerdict.CORRECT ? null : "На втором шаге потерян знак перед дробью."
              };
            })
          }
        }
      });
    }
  }

  // ── Прошедшие уроки с итогами и посещаемостью ─────────────────
  const groupStudents = students.filter((student) => student.inGroup);
  const soloStudent = students.find((student) => !student.inGroup)!;
  const lessonNumbers = [...takeWrap(topicOld.homeworkNumbers, 5, 3), ...takeWrap(topicCurrent.homeworkNumbers, 0, 3)];
  const usedInLesson = new Set(lessonNumbers.map((number) => number.id));
  const extraNumbers = takeWrap(topicCurrent.homeworkNumbers, 3, 4).filter((number) => !usedInLesson.has(number.id)).slice(0, 2);

  const attendancePlan: AttendanceStatus[][] = [
    [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.ABSENT],
    [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.PRESENT],
    [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED],
    [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT]
  ];

  const createLesson = async (input: {
    title: string;
    groupId: string | null;
    startsAt: Date;
    participants: Array<{ student: StudentSpec & { id: string }; attendance: AttendanceStatus }>;
    finished: boolean;
  }) => {
    const lesson = await prisma.lesson.create({
      data: {
        title: input.title,
        teacherId: teacher.id,
        groupId: input.groupId,
        durationMinutes: 60,
        startsAt: input.startsAt,
        status: input.finished ? LessonStatus.FINISHED : LessonStatus.PLANNED,
        createdAt: new Date(input.startsAt.getTime() - DAY),
        planParams: { title: input.title, durationMinutes: 60, topicIds: [topicOld.id, topicCurrent.id], targetDifficulty: null, teacherNote: "" }
      },
      select: { id: true }
    });

    for (const [participantIndex, entry] of input.participants.entries()) {
      const attended = entry.attendance === AttendanceStatus.PRESENT || entry.attendance === AttendanceStatus.LATE;
      const participant = await prisma.lessonParticipant.create({
        data: {
          lessonId: lesson.id,
          studentId: entry.student.id,
          speed: entry.student.speed,
          planSummary: input.finished
            ? "Идём от закреплённых номеров к новым: два повторения, затем три задачи текущей темы."
            : "Разминка по прошлой теме, затем новые номера с нарастающей сложностью.",
          planGeneratedAt: new Date(input.startsAt.getTime() - DAY + 60_000),
          attendance: input.finished ? entry.attendance : AttendanceStatus.UNKNOWN,
          joinedAt: input.finished && attended ? new Date(input.startsAt.getTime() + (entry.attendance === AttendanceStatus.LATE ? 12 : 2) * 60_000) : null
        },
        select: { id: true }
      });

      const items = [...lessonNumbers.map((number) => ({ number, isExtra: false })), ...extraNumbers.map((number) => ({ number, isExtra: true }))];

      for (const [order, item] of items.entries()) {
        let result: LessonItemResult | null = null;

        if (input.finished) {
          if (!attended) {
            result = LessonItemResult.SKIPPED;
          } else if (item.isExtra) {
            result = entry.student.profile === "strong" ? LessonItemResult.SOLVED : LessonItemResult.SKIPPED;
          } else {
            const roll = (order * 3 + participantIndex + (entry.student.profile === "weak" ? 4 : 0)) % 10;
            result = roll < 5 ? LessonItemResult.SOLVED : roll < 7 ? LessonItemResult.PARTIAL : roll < 9 ? LessonItemResult.NOT_SOLVED : LessonItemResult.SKIPPED;
          }
        }

        const created = await prisma.lessonAssignmentItem.create({
          data: { participantId: participant.id, homeworkNumberId: item.number.id, order, isExtra: item.isExtra, result },
          select: { id: true }
        });

        // Сдачи на уроке: у решённых и решённых с ошибками — зачтённая проверка, у «не решил» — неверная.
        if (input.finished && attended && result && result !== LessonItemResult.SKIPPED) {
          const submittedAt = new Date(input.startsAt.getTime() + (8 + order * 7) * 60_000);

          if (result === LessonItemResult.PARTIAL) {
            await prisma.lessonItemSubmission.create({
              data: {
                itemId: created.id,
                status: SolutionCheckStatus.DONE,
                activeSlot: null,
                verdict: SolutionVerdict.INCORRECT,
                comment: "Знаковая ошибка — проверь раскрытие скобок.",
                confidence: 0.9,
                errorKind: "SIGN",
                submittedAt: new Date(submittedAt.getTime() - 5 * 60_000),
                checkedAt: new Date(submittedAt.getTime() - 4 * 60_000)
              }
            });
          }

          await prisma.lessonItemSubmission.create({
            data: {
              itemId: created.id,
              status: SolutionCheckStatus.DONE,
              activeSlot: null,
              verdict: result === LessonItemResult.NOT_SOLVED ? SolutionVerdict.INCORRECT : SolutionVerdict.CORRECT,
              comment: result === LessonItemResult.NOT_SOLVED ? "Ответ не совпадает с эталоном — пересчитай." : "Верно.",
              confidence: 0.92,
              errorKind: result === LessonItemResult.NOT_SOLVED ? "ARITHMETIC" : "NONE",
              submittedAt,
              checkedAt: new Date(submittedAt.getTime() + 60_000)
            }
          });
        }

        // Итог урока зеркалится в статус номера, как делает доска.
        const mirrored = result ? RESULT_TO_STATUS[result] : null;

        if (mirrored) {
          await prisma.studentTopicNumberStatus.upsert({
            where: { studentId_homeworkNumberId: { studentId: entry.student.id, homeworkNumberId: item.number.id } },
            update: { status: mirrored, statusChangedAt: new Date(input.startsAt.getTime() + 55 * 60_000) },
            create: { studentId: entry.student.id, homeworkNumberId: item.number.id, status: mirrored, statusChangedAt: new Date(input.startsAt.getTime() + 55 * 60_000) }
          });
        }
      }
    }

    return lesson.id;
  };

  // Групповые занятия: четыре прошедших по неделям и одно завтра.
  for (const [lessonIndex, days] of [21, 14, 7, 2].entries()) {
    await createLesson({
      title: `Занятие группы · ${topicCurrent.title}`,
      groupId: group.id,
      startsAt: daysAgo(days, 17, 0),
      participants: groupStudents.map((student, index) => ({ student, attendance: attendancePlan[lessonIndex]![index]! })),
      finished: true
    });
  }

  const tomorrow = new Date(Date.now() + DAY);
  tomorrow.setHours(17, 0, 0, 0);
  await createLesson({
    title: `Занятие группы · ${topicNext.title}`,
    groupId: group.id,
    startsAt: tomorrow,
    participants: groupStudents.map((student) => ({ student, attendance: AttendanceStatus.UNKNOWN })),
    finished: false
  });

  // Индивидуальные: три прошедших и одно завтра.
  for (const days of [18, 11, 4]) {
    await createLesson({
      title: `Индивидуальное · ${topicCurrent.title}`,
      groupId: null,
      startsAt: daysAgo(days, 16, 0),
      participants: [{ student: soloStudent, attendance: AttendanceStatus.PRESENT }],
      finished: true
    });
  }

  const soloTomorrow = new Date(Date.now() + DAY);
  soloTomorrow.setHours(16, 0, 0, 0);
  await createLesson({
    title: `Индивидуальное · ${topicNext.title}`,
    groupId: null,
    startsAt: soloTomorrow,
    participants: [{ student: soloStudent, attendance: AttendanceStatus.UNKNOWN }],
    finished: false
  });

  // Уведомления ученикам — чтобы колокольчик не был пустым.
  for (const student of students) {
    await prisma.notification.createMany({
      data: [
        { userId: student.id, type: "homework-assigned", title: `Учитель выдал ДЗ по теме «${topicNext.title}»`, body: "Срок — через 3 дня.", href: "/student/homeworks", createdAt: daysAgo(3, 15) },
        { userId: student.id, type: "homework-checked", title: "Результат автопроверки готов", body: "Автопроверка: часть номеров нужно перерешать.", href: "/student/homeworks", createdAt: daysAgo(2, 17), readAt: daysAgo(2, 18) }
      ]
    });
  }

  console.log("Готово. Тестовые аккаунты (пароль у всех один):");
  console.log(`  учитель:  ${teacher.email}`);
  for (const student of students) {
    console.log(`  ученик:   ${student.email} — ${student.name}${student.inGroup ? " (Тест-группа 8А)" : " (индивидуально)"}`);
  }
  console.log(`  пароль:   ${password}`);
  console.log(`Темы в истории: ${usableTopics.map((topic) => `«${topic.title}»`).join(", ")}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
