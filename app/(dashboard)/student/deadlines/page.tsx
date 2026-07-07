import { UserRole } from "@prisma/client";
import { DeadlinesCalendar } from "@/components/deadlines-calendar";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { StudentHomeworkSubmissions } from "@/components/student-homework-submissions";
import { requireUser } from "@/lib/auth";
import { getStudentDeadlines, getStudentHomeworks } from "@/lib/platform-data";
import { groupStudentDeadlinesAsAssignments } from "@/lib/student-deadline-groups";
import { toIsoDateTimeString } from "@/lib/utils";

export default async function StudentDeadlinesPage() {
  const user = await requireUser(UserRole.STUDENT);
  const [deadlines, homeworks] = await Promise.all([getStudentDeadlines(user.id), getStudentHomeworks(user.id)]);
  const assignmentDeadlines = groupStudentDeadlinesAsAssignments(deadlines);

  return (
    <div className="min-h-[70vh]">
      <ShbzPageHeader kicker="Дедлайны" title="Календарь домашних заданий" aside={<ShbzNumberSearch />} />

      <DeadlinesCalendar deadlines={assignmentDeadlines} />

      {homeworks.assignmentsEnabled && homeworks.assignments.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-[19px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
            Фото решений
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Прикрепите фото решённого ДЗ — учитель увидит их при проверке.
          </p>
          <div className="mt-4">
            <StudentHomeworkSubmissions
              assignments={homeworks.assignments.map((assignment) => ({
                id: assignment.id,
                label: assignment.label,
                topicId: assignment.topicId,
                topicTitle: assignment.topicTitle,
                deadlineAt: toIsoDateTimeString(assignment.deadlineAt),
                totalNumbers: assignment.totalNumbers,
                solvedCount: assignment.solvedCount,
                solvedPercent: assignment.solvedPercent,
                photos: assignment.photos.map((photo) => ({
                  id: photo.id,
                  fileId: photo.fileId,
                  originalName: photo.originalName
                }))
              }))}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
