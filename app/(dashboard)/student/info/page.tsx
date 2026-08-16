import { redirect } from "next/navigation";

// «Общая инфа» заменена вкладкой «Теория» (15.08.2026); старые ссылки и
// закладки уводим туда же.
export default function StudentInfoPage() {
  redirect("/student/theory");
}
