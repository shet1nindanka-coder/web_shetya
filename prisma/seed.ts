import { promises as fs } from "node:fs";
import { HomeworkNumberStatus, PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { ensureStorageRoot, getStorageRoot, removeStoredFile, saveBufferToStorage } from "../lib/storage";

const prisma = new PrismaClient();

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createSimplePdfBuffer(title: string, lines: string[]) {
  const pdfLines = [title, ...lines].map((line, index) => {
    const yOffset = index === 0 ? "72 760 Td" : "0 -28 Td";
    return `${yOffset}\n(${escapePdfText(line)}) Tj`;
  });

  const stream = `BT
/F1 18 Tf
${pdfLines.join("\n")}
ET`;

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`;

  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n 
`;
  }

  pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`;

  return Buffer.from(pdf, "utf8");
}

async function createPdfFileRecord(
  uploadedById: string,
  fileName: string,
  title: string,
  lines: string[]
) {
  const buffer = createSimplePdfBuffer(title, lines);
  const stored = await saveBufferToStorage(buffer, fileName, "application/pdf");

  return prisma.storedFile.create({
    data: {
      ...stored,
      uploadedById
    }
  });
}

async function main() {
  const existingFiles = await prisma.storedFile.findMany({
    select: {
      storageKey: true
    }
  });

  await prisma.session.deleteMany();
  await prisma.studentTopicNumberStatus.deleteMany();
  await prisma.topicHomeworkNumber.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.storedFile.deleteMany();
  await prisma.user.deleteMany();

  await Promise.all(existingFiles.map((file) => removeStoredFile(file.storageKey)));
  await fs.rm(getStorageRoot(), { recursive: true, force: true }).catch(() => undefined);
  await ensureStorageRoot();

  const teacherPassword = await hashPassword("teacher123");
  const developerPassword = await hashPassword("dev123");
  const studentPassword = await hashPassword("student123");

  const teacher = await prisma.user.create({
    data: {
      name: "Анна Петрова",
      email: "teacher@example.com",
      passwordHash: teacherPassword,
      role: UserRole.TEACHER
    }
  });

  await prisma.user.create({
    data: {
      name: "Даниил (разработчик)",
      email: "dev@example.com",
      passwordHash: developerPassword,
      role: UserRole.DEVELOPER
    }
  });

  const ilya = await prisma.user.create({
    data: {
      name: "Илья Смирнов",
      email: "ilya@example.com",
      passwordHash: studentPassword,
      role: UserRole.STUDENT,
      teacherId: teacher.id
    }
  });

  const maria = await prisma.user.create({
    data: {
      name: "Мария Волкова",
      email: "maria@example.com",
      passwordHash: studentPassword,
      role: UserRole.STUDENT,
      teacherId: teacher.id
    }
  });

  const topicOneTheory = await createPdfFileRecord(
    teacher.id,
    "linear-equations-theory.pdf",
    "Linear Equations Theory",
    ["Topic summary for the student.", "Focus on transformations and checking the answer."]
  );

  const topicOneHomework = await createPdfFileRecord(
    teacher.id,
    "linear-equations-homework.pdf",
    "Linear Equations Homework",
    ["Solve the listed numbers.", "Mark each number with green, yellow or red status."]
  );

  const topicTwoTheory = await createPdfFileRecord(
    teacher.id,
    "quadratic-functions-theory.pdf",
    "Quadratic Functions Theory",
    ["Review graph properties and the vertex.", "Pay attention to symmetry and zeros."]
  );

  const topicTwoHomework = await createPdfFileRecord(
    teacher.id,
    "quadratic-functions-homework.pdf",
    "Quadratic Functions Homework",
    ["Practice the assigned numbers.", "Use the graph and formula interpretation."]
  );

  const topicThreeTheory = await createPdfFileRecord(
    teacher.id,
    "derivative-theory.pdf",
    "Derivative Theory",
    ["Review the definition of derivative.", "Focus on increasing and decreasing intervals."]
  );

  const topicThreeHomework = await createPdfFileRecord(
    teacher.id,
    "derivative-homework.pdf",
    "Derivative Homework",
    ["Solve the selected derivative tasks.", "Mark difficult items with the red status."]
  );

  const topicOne = await prisma.topic.create({
    data: {
      title: "Линейные уравнения",
      description: "Базовые свойства линейных уравнений, перенос слагаемых и проверка решения.",
      displayOrder: 1,
      theoryFileId: topicOneTheory.id,
      homeworkFileId: topicOneHomework.id,
      homeworkNumbers: {
        create: [
          { number: "112", displayOrder: 1 },
          { number: "113", displayOrder: 2 },
          { number: "118", displayOrder: 3 },
          { number: "120", displayOrder: 4 }
        ]
      }
    },
    include: {
      homeworkNumbers: true
    }
  });

  const topicTwo = await prisma.topic.create({
    data: {
      title: "Квадратные функции",
      description: "Парабола, вершина, ветви, ось симметрии и чтение графика.",
      displayOrder: 2,
      theoryFileId: topicTwoTheory.id,
      homeworkFileId: topicTwoHomework.id,
      homeworkNumbers: {
        create: [
          { number: "204", displayOrder: 1 },
          { number: "207", displayOrder: 2 },
          { number: "211", displayOrder: 3 },
          { number: "215", displayOrder: 4 }
        ]
      }
    },
    include: {
      homeworkNumbers: true
    }
  });

  const topicThree = await prisma.topic.create({
    data: {
      title: "Производная и исследование функций",
      description: "Производная, интервалы возрастания и убывания, критические точки и анализ графика.",
      displayOrder: 3,
      theoryFileId: topicThreeTheory.id,
      homeworkFileId: topicThreeHomework.id,
      homeworkNumbers: {
        create: [
          { number: "301", displayOrder: 1 },
          { number: "302", displayOrder: 2 },
          { number: "305", displayOrder: 3 }
        ]
      }
    },
    include: {
      homeworkNumbers: true
    }
  });

  const topicOneNumbers = new Map(topicOne.homeworkNumbers.map((number) => [number.number, number.id]));
  const topicTwoNumbers = new Map(topicTwo.homeworkNumbers.map((number) => [number.number, number.id]));
  const topicThreeNumbers = new Map(topicThree.homeworkNumbers.map((number) => [number.number, number.id]));
  const now = new Date();
  const atHourWithOffset = (daysOffset: number, hour: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + daysOffset);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  await prisma.studentTopicNumberStatus.createMany({
    data: [
      {
        studentId: ilya.id,
        homeworkNumberId: topicOneNumbers.get("112")!,
        status: HomeworkNumberStatus.GREEN,
        deadlineAt: atHourWithOffset(-2, 18)
      },
      {
        studentId: ilya.id,
        homeworkNumberId: topicOneNumbers.get("113")!,
        status: HomeworkNumberStatus.YELLOW,
        deadlineAt: atHourWithOffset(1, 18)
      },
      {
        studentId: ilya.id,
        homeworkNumberId: topicOneNumbers.get("118")!,
        status: HomeworkNumberStatus.RED,
        deadlineAt: atHourWithOffset(-1, 18)
      },
      {
        studentId: ilya.id,
        homeworkNumberId: topicOneNumbers.get("120")!,
        status: null,
        deadlineAt: atHourWithOffset(2, 19)
      },
      {
        studentId: ilya.id,
        homeworkNumberId: topicTwoNumbers.get("204")!,
        status: HomeworkNumberStatus.GREEN,
        deadlineAt: atHourWithOffset(4, 19)
      },
      {
        studentId: ilya.id,
        homeworkNumberId: topicTwoNumbers.get("207")!,
        status: HomeworkNumberStatus.GREEN
      },
      {
        studentId: ilya.id,
        homeworkNumberId: topicTwoNumbers.get("211")!,
        status: null,
        deadlineAt: atHourWithOffset(7, 19)
      },
      {
        studentId: ilya.id,
        homeworkNumberId: topicThreeNumbers.get("301")!,
        status: HomeworkNumberStatus.YELLOW,
        deadlineAt: atHourWithOffset(9, 20)
      },
      {
        studentId: ilya.id,
        homeworkNumberId: topicThreeNumbers.get("302")!,
        status: null,
        deadlineAt: atHourWithOffset(12, 20)
      },
      {
        studentId: maria.id,
        homeworkNumberId: topicOneNumbers.get("112")!,
        status: HomeworkNumberStatus.GREEN
      },
      {
        studentId: maria.id,
        homeworkNumberId: topicOneNumbers.get("113")!,
        status: HomeworkNumberStatus.GREEN,
        deadlineAt: atHourWithOffset(3, 18)
      },
      {
        studentId: maria.id,
        homeworkNumberId: topicOneNumbers.get("120")!,
        status: HomeworkNumberStatus.RED,
        deadlineAt: atHourWithOffset(1, 19)
      },
      {
        studentId: maria.id,
        homeworkNumberId: topicTwoNumbers.get("204")!,
        status: HomeworkNumberStatus.YELLOW
      },
      {
        studentId: maria.id,
        homeworkNumberId: topicTwoNumbers.get("215")!,
        status: HomeworkNumberStatus.RED,
        deadlineAt: atHourWithOffset(-3, 19)
      },
      {
        studentId: maria.id,
        homeworkNumberId: topicThreeNumbers.get("305")!,
        status: HomeworkNumberStatus.GREEN,
        deadlineAt: atHourWithOffset(6, 20)
      }
    ]
  });

  console.log("Seed completed.");
  console.log("Teacher:", teacher.email, "teacher123");
  console.log("Developer:", "dev@example.com", "dev123");
  console.log("Students:", ilya.email, "student123", "|", maria.email, "student123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
