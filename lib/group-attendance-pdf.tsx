import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { AttendanceValue } from "@/lib/attendance";
import { ensurePdfFonts, pdfColors as colors } from "@/lib/weekly-report-pdf";

/*
 * PDF «Посещаемость группы» за 7 / 30 дней / учебный год: сводка по ученикам
 * и матрица занятия × ученики (альбомная A4, по 14 занятий на таблицу).
 */

export type GroupAttendancePdfStudent = {
  name: string;
  attendedLabel: string; // «5 из 6»
  lateLabel: string;
  absentLabel: string;
  excusedLabel: string;
  percentLabel: string; // «83%» или «—»
  cells: Array<AttendanceValue | null>; // null — не участвовал
};

export type GroupAttendancePdfInput = {
  groupName: string;
  reportTitle: string;
  periodLabel: string;
  generatedLabel: string;
  lessons: Array<{ dateLabel: string; title: string }>;
  students: GroupAttendancePdfStudent[];
  totals: { lessons: number; averagePercentLabel: string; absent: number; excused: number };
};

const LESSONS_PER_TABLE = 14;

const cellText: Record<AttendanceValue, { label: string; bg: string; color: string }> = {
  PRESENT: { label: "был", bg: colors.greenSoft, color: colors.greenDark },
  LATE: { label: "опозд.", bg: colors.yellowSoft, color: colors.yellowDark },
  ABSENT: { label: "нет", bg: colors.redSoft, color: colors.redDark },
  EXCUSED: { label: "уваж.", bg: colors.softBg, color: colors.muted },
  UNKNOWN: { label: "—", bg: "transparent", color: colors.faint }
};

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 40, paddingHorizontal: 34, fontSize: 9, color: colors.text, fontFamily: "Montserrat" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontFamily: "Montserrat", fontWeight: 900, fontSize: 13, color: "#0a0a0a" },
  brandSub: { fontFamily: "Montserrat", fontWeight: 900, fontSize: 13, color: "#0e9b80" },
  kicker: { fontSize: 9, fontWeight: 700, letterSpacing: 1.6, textAlign: "right", color: "#0a0a0a" },
  generated: { fontSize: 8.5, color: colors.muted, marginTop: 4, textAlign: "right" },
  headRule: { height: 2, backgroundColor: "#0a0a0a", marginTop: 10, marginBottom: 12 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 },
  groupName: { fontSize: 16, fontWeight: 700 },
  period: { fontSize: 8.5, color: colors.muted },
  kpiRow: { flexDirection: "row", marginBottom: 14 },
  kpiCard: { flexGrow: 1, flexBasis: 0, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginRight: 6 },
  kpiLabel: { fontSize: 7.5 },
  kpiValue: { fontSize: 15, fontWeight: 700, marginTop: 2 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  table: { marginBottom: 14 },
  tableHeader: { flexDirection: "row", backgroundColor: colors.headerBg },
  th: { fontSize: 7.5, fontWeight: 700, color: colors.headerText, paddingVertical: 5, paddingHorizontal: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.border, alignItems: "center" },
  td: { fontSize: 8, paddingVertical: 4, paddingHorizontal: 5 },
  cell: { fontSize: 7.5, fontWeight: 700, borderRadius: 5, paddingVertical: 2, paddingHorizontal: 4, textAlign: "center" },
  empty: { fontSize: 8.5, color: colors.muted, paddingVertical: 8, paddingHorizontal: 5 },
  footer: { position: "absolute", left: 34, right: 34, bottom: 18, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6 },
  footerText: { fontSize: 7.5, color: colors.soft }
});

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function GroupAttendanceDocument({ input }: { input: GroupAttendancePdfInput }) {
  const lessonChunks = chunk(
    input.lessons.map((lesson, index) => ({ ...lesson, index })),
    LESSONS_PER_TABLE
  );

  return (
    <Document title={`${input.reportTitle} — ${input.groupName}`} author="ШБЗ Школа">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row" }}>
            <Text style={styles.brand}>ШБЗ</Text>
            <Text style={styles.brandSub}>Школа</Text>
          </View>
          <View>
            <Text style={styles.kicker}>{input.reportTitle}</Text>
            <Text style={styles.generated}>сформирован {input.generatedLabel}</Text>
          </View>
        </View>
        <View style={styles.headRule} />

        <View style={styles.titleRow}>
          <Text style={styles.groupName}>{input.groupName}</Text>
          <Text style={styles.period}>период: {input.periodLabel}</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: colors.softBg }]}>
            <Text style={[styles.kpiLabel, { color: colors.soft }]}>Занятий за период</Text>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{String(input.totals.lessons)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.greenSoft }]}>
            <Text style={[styles.kpiLabel, { color: colors.green }]}>Средняя посещаемость</Text>
            <Text style={[styles.kpiValue, { color: colors.greenDark }]}>{input.totals.averagePercentLabel}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.redSoft }]}>
            <Text style={[styles.kpiLabel, { color: colors.red }]}>Пропусков</Text>
            <Text style={[styles.kpiValue, { color: colors.redDark }]}>{String(input.totals.absent)}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.softBg }]}>
            <Text style={[styles.kpiLabel, { color: colors.soft }]}>По уважительной</Text>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{String(input.totals.excused)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Сводка по ученикам</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            {[
              ["Ученик", 34],
              ["Был", 14],
              ["Опоздал", 13],
              ["Не был", 13],
              ["Уважит.", 13],
              ["Посещаемость", 13]
            ].map(([label, grow]) => (
              <Text key={String(label)} style={[styles.th, { flexBasis: 0, flexGrow: Number(grow) }]}>
                {label}
              </Text>
            ))}
          </View>
          {input.students.length === 0 ? (
            <Text style={styles.empty}>В группе нет учеников.</Text>
          ) : (
            input.students.map((student, index) => (
              <View key={`${student.name}-${index}`} style={[styles.tr, index % 2 === 1 ? { backgroundColor: colors.zebra } : {}]} wrap={false}>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 34, fontWeight: 700 }]}>{student.name}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 14 }]}>{student.attendedLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 13, color: colors.yellow }]}>{student.lateLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 13, color: colors.red }]}>{student.absentLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 13, color: colors.muted }]}>{student.excusedLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 13, fontWeight: 700 }]}>{student.percentLabel}</Text>
              </View>
            ))
          )}
        </View>

        {input.lessons.length === 0 ? (
          <Text style={styles.empty}>За этот период занятий у группы не было.</Text>
        ) : (
          lessonChunks.map((lessonsChunk, chunkIndex) => (
            <View key={`chunk-${chunkIndex}`} style={styles.table} wrap={false}>
              <Text style={styles.sectionTitle}>
                {lessonChunks.length > 1 ? `Занятия ${chunkIndex * LESSONS_PER_TABLE + 1}–${chunkIndex * LESSONS_PER_TABLE + lessonsChunk.length}` : "По занятиям"}
              </Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flexBasis: 0, flexGrow: 24 }]}>Ученик</Text>
                {lessonsChunk.map((lesson) => (
                  <Text key={`${lesson.index}`} style={[styles.th, { flexBasis: 0, flexGrow: 6, textAlign: "center" }]}>
                    {lesson.dateLabel}
                  </Text>
                ))}
              </View>
              {input.students.map((student, index) => (
                <View key={`${student.name}-${chunkIndex}-${index}`} style={[styles.tr, index % 2 === 1 ? { backgroundColor: colors.zebra } : {}]}>
                  <Text style={[styles.td, { flexBasis: 0, flexGrow: 24 }]}>{student.name}</Text>
                  {lessonsChunk.map((lesson) => {
                    const value = student.cells[lesson.index] ?? null;
                    const meta = value ? cellText[value] : null;

                    return (
                      <View key={`${lesson.index}`} style={[styles.td, { flexBasis: 0, flexGrow: 6, alignItems: "center" }]}>
                        <Text style={[styles.cell, meta ? { backgroundColor: meta.bg, color: meta.color } : { color: colors.faint }]}>
                          {meta ? meta.label : "·"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ШБЗ Школа · был / опозд. / нет / уваж. · «·» — не участвовал</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `стр. ${pageNumber} из ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderGroupAttendancePdf(input: GroupAttendancePdfInput): Promise<Buffer> {
  if (!ensurePdfFonts()) {
    throw new Error("PDF fonts unavailable");
  }

  return renderToBuffer(<GroupAttendanceDocument input={input} />);
}
