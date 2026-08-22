import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { StudentExamInfo } from "@/components/student-exam-info";

/* «Общая инфа» ученика: баллы ЕГЭ / ОГЭ с переключателем (components/student-exam-info.tsx). */
export default function StudentInfoPage() {
  return (
    <div>
      <ShbzPageHeader
        kicker="Общая инфа"
        title="Баллы и разбалловка"
        aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />}
      />
      <StudentExamInfo />
    </div>
  );
}
