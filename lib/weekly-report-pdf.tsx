import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { logWarnEvent } from "@/lib/logger";

const colors = {
  text: "#14161a",
  label: "#2c2e33",
  muted: "#6a6e75",
  soft: "#9aa0a6",
  faint: "#c7cad0",
  border: "#ececee",
  zebra: "#fbfbfc",
  softBg: "#f8f9fa",
  track: "#efeff1",
  headerBg: "#eaf7f0",
  headerText: "#085041",
  green: "#1b9e63",
  greenSoft: "#eaf7ef",
  greenDark: "#085041",
  teal: "#36e0a4",
  tealDark: "#0f6e56",
  tealSoft: "#d9f3e7",
  yellow: "#c98a1e",
  yellowSoft: "#fef4e3",
  yellowDark: "#633806",
  red: "#d64550",
  redSoft: "#fceded",
  redDark: "#791f1f",
  orange: "#b5701a",
  orangeSoft: "#fff3e4",
  gradient: ["#5ac8ea", "#4dcdc6", "#41d2b0", "#3bd9aa", "#36e0a4"]
};

export type WeeklyPdfDay = {
  label: string;
  closedCount: number;
  redCount: number;
};

export type WeeklyPdfAssignment = {
  topicTitle: string;
  label: string;
  deadlineLabel: string;
  doneLabel: string;
  /** Итог последней автопроверки ИИ, например «4 верно · 1 с ошибками»; «—» если проверок не было. */
  checkLabel: string;
  stateLabel: string;
  stateKind: "done" | "progress" | "attention" | "muted";
};

export type WeeklyPdfTopicSummary = {
  topicTitle: string;
  periodDone: string; // разобрано за период
  green: string;
  yellow: string;
  red: string;
  progressLabel: string; // текущий прогресс темы, например «34 из 60»
};

export type WeeklyPdfLesson = {
  dateLabel: string;
  title: string;
  topicsLabel: string;
  totalLabel: string;
  resultsLabel: string;
};

export type WeeklyPdfAttendance = {
  summaryLabel: string; // «был на 5 из 6 · 83%»
  /** Только не-«был»: опоздания, пропуски, уважительные. Пусто — пропусков не было. */
  rows: Array<{ dateLabel: string; title: string; label: string; kind: "late" | "absent" | "excused" }>;
};

export type WeeklyPdfRow = {
  whenLabel: string;
  topicTitle: string;
  number: string;
  statusKey: string;
  statusLabel: string;
  note: string;
};

export type WeeklyPdfInput = {
  studentName: string;
  studentEmail: string;
  reportTitle: string; // например «ОТЧЁТ ЗА 30 ДНЕЙ»
  activityTitle: string; // «Активность по дням/неделям/месяцам»
  periodLabel: string;
  generatedLabel: string;
  closedCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  streakDays: number;
  totalSolved: number;
  totalNumbers: number;
  days: WeeklyPdfDay[];
  lessons: WeeklyPdfLesson[];
  lessonsFootnote: string | null;
  assignments: WeeklyPdfAssignment[];
  assignmentsFootnote: string | null;
  // null — понедельный режим со списком номеров (rows); иначе сводка по темам.
  topicSummaries: WeeklyPdfTopicSummary[] | null;
  rows: WeeklyPdfRow[];
  // null — ученик не состоял в группе / групповых занятий за период не было.
  attendance?: WeeklyPdfAttendance | null;
};

// Шрифт вшит в репозиторий (assets/fonts/montserrat) и грузится с диска — без запроса к
// Google Fonts в рантайме. Раньше registerFonts() тянул fonts.googleapis.com на
// каждом холодном старте, и при недоступности сети отчёт падал 500: обещанного
// фолбэка на Helvetica по факту не было (и кириллицы в ней тоже нет).
const FONT_DIR = path.join(process.cwd(), "assets", "fonts", "montserrat");

let fontsRegistered: boolean | null = null;

function registerFonts() {
  try {
    // Единая гарнитура — Montserrat; вес 900 использует логотип «ШБЗШкола».
    Font.register({
      family: "Montserrat",
      fonts: [
        { src: path.join(FONT_DIR, "Montserrat-Regular.ttf"), fontWeight: 400 },
        { src: path.join(FONT_DIR, "Montserrat-Bold.ttf"), fontWeight: 700 },
        { src: path.join(FONT_DIR, "Montserrat-Black.ttf"), fontWeight: 900 }
      ]
    });
    Font.registerHyphenationCallback((word) => [word]);
    return true;
  } catch (error) {
    logWarnEvent(
      "student.export.pdf_fonts_failed",
      {},
      error instanceof Error ? error : undefined,
      "Failed to register bundled Montserrat fonts for PDF export."
    );
    return false;
  }
}

function ensureFonts() {
  if (fontsRegistered === null) {
    fontsRegistered = registerFonts();
  }

  return fontsRegistered;
}

/** Шрифты и палитра общие для всех PDF-отчётов (посещаемость группы — lib/group-attendance-pdf.tsx). */
export function ensurePdfFonts() {
  return ensureFonts();
}

export const pdfColors = colors;

const stateChipColors: Record<WeeklyPdfAssignment["stateKind"], { bg: string; text: string }> = {
  done: { bg: colors.greenSoft, text: colors.green },
  progress: { bg: colors.tealSoft, text: colors.tealDark },
  attention: { bg: colors.redSoft, text: colors.red },
  muted: { bg: colors.softBg, text: colors.muted }
};

const attendanceRowColors: Record<"late" | "absent" | "excused", string> = {
  late: colors.yellow,
  absent: colors.red,
  excused: colors.muted
};

const statusTextColors: Record<string, string> = {
  GREEN: colors.green,
  YELLOW: colors.yellow,
  RED: colors.red
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 46,
    paddingHorizontal: 38,
    fontSize: 9,
    color: colors.text,
    fontFamily: "Montserrat"
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  // Иконка лока: буква Ш на фирменной плашке (радиус ≈ 22 %, кегль ≈ 60 %).
  brandBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#16c79f",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8
  },
  brandBadgeText: { color: "#ffffff", fontFamily: "Montserrat", fontWeight: 900, fontSize: 17, lineHeight: 1 },
  // Лок «ШБЗШкола» в мелком кегле: приписка уходит в --brand-deep.
  brandLock: { flexDirection: "row", alignItems: "flex-end" },
  brand: { fontFamily: "Montserrat", fontWeight: 900, fontSize: 13, letterSpacing: -0.2, color: "#0a0a0a" },
  brandSub: { fontFamily: "Montserrat", fontWeight: 900, fontSize: 13, letterSpacing: -0.2, color: "#0e9b80" },
  kicker: { fontSize: 9, fontWeight: 700, letterSpacing: 1.6, color: "#0a0a0a", textAlign: "right" },
  kickerAccent: {
    height: 3,
    width: 34,
    backgroundColor: "#16b07e",
    borderRadius: 2,
    marginTop: 4,
    marginLeft: "auto"
  },
  generated: { fontSize: 8.5, color: colors.muted, marginTop: 4, textAlign: "right" },
  headRule: { height: 2, backgroundColor: "#0a0a0a", marginTop: 12, marginBottom: 14 },
  studentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  studentName: { fontSize: 16, fontWeight: 700 },
  studentEmail: { fontSize: 8.5, color: colors.muted, marginTop: 2 },
  period: { fontSize: 8.5, color: colors.muted },
  kpiRow: { flexDirection: "row", marginBottom: 14 },
  kpiCard: { flexGrow: 1, flexBasis: 0, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginRight: 6 },
  kpiLabel: { fontSize: 7.5 },
  kpiValue: { fontSize: 15, fontWeight: 700, marginTop: 2 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: "hidden", marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  daysRow: { flexDirection: "row", marginBottom: 16 },
  dayColumn: { flexGrow: 1, flexBasis: 0, alignItems: "center", marginRight: 5 },
  dayBarArea: { height: 30, width: "100%", justifyContent: "flex-end" },
  dayLabel: { fontSize: 7, color: colors.soft, marginTop: 3 },
  table: { marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: colors.headerBg },
  th: { fontSize: 7.5, fontWeight: 700, color: colors.headerText, paddingVertical: 5, paddingHorizontal: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: colors.border },
  td: { fontSize: 8, paddingVertical: 5, paddingHorizontal: 6 },
  chip: { borderRadius: 7, paddingVertical: 2, paddingHorizontal: 7, fontSize: 7.5, fontWeight: 700, alignSelf: "flex-start" },
  empty: { fontSize: 8.5, color: colors.muted, paddingVertical: 8, paddingHorizontal: 6 },
  footer: {
    position: "absolute",
    left: 38,
    right: 38,
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: 7
  },
  footerText: { fontSize: 7.5, color: colors.soft }
});

function KpiCard({ label, value, bg, labelColor, valueColor }: {
  label: string;
  value: string;
  bg: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: bg }]}>
      <Text style={[styles.kpiLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function WeeklyReportDocument({ input }: { input: WeeklyPdfInput }) {
  const maxDayValue = Math.max(1, ...input.days.map((day) => Math.max(day.closedCount, day.redCount)));
  const totalPercent = input.totalNumbers > 0 ? Math.round((input.totalSolved / input.totalNumbers) * 100) : 0;
  const assignmentColumns = [0.22, 0.18, 0.14, 0.12, 0.16, 0.18];
  const lessonColumns = [0.15, 0.27, 0.24, 0.08, 0.26];
  const rowColumns = [0.17, 0.27, 0.08, 0.24, 0.24];
  const topicColumns = [0.32, 0.14, 0.12, 0.12, 0.12, 0.18];

  return (
    <Document title={`${input.reportTitle} — ${input.studentName}`} author="ШБЗ Школа">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>ШБЗ</Text>
            </View>
            <View style={styles.brandLock}>
              <Text style={styles.brand}>ШБЗ</Text>
              <Text style={styles.brandSub}>Школа</Text>
            </View>
          </View>
          <View>
            <Text style={styles.kicker}>{input.reportTitle}</Text>
            <View style={styles.kickerAccent} />
            <Text style={styles.generated}>сформирован {input.generatedLabel}</Text>
          </View>
        </View>
        <View style={styles.headRule} />

        <View style={styles.studentRow}>
          <View>
            <Text style={styles.studentName}>{input.studentName}</Text>
            <Text style={styles.studentEmail}>{input.studentEmail}</Text>
          </View>
          <Text style={styles.period}>период: {input.periodLabel}</Text>
        </View>

        <View style={styles.kpiRow}>
          <KpiCard label="Закрыто" value={String(input.closedCount)} bg={colors.softBg} labelColor={colors.soft} valueColor={colors.text} />
          <KpiCard label="С первого раза" value={String(input.greenCount)} bg={colors.greenSoft} labelColor={colors.green} valueColor={colors.greenDark} />
          <KpiCard label="Самопроверка" value={String(input.yellowCount)} bg={colors.yellowSoft} labelColor={colors.yellow} valueColor={colors.yellowDark} />
          <KpiCard label="Нужен разбор" value={String(input.redCount)} bg={colors.redSoft} labelColor={colors.red} valueColor={colors.redDark} />
          <KpiCard label="Огонёк" value={`${input.streakDays} дн.`} bg={colors.orangeSoft} labelColor={colors.orange} valueColor={colors.orange} />
        </View>

        {input.totalNumbers > 0 ? (
          <>
            <View style={styles.progressHeader}>
              <Text style={{ fontSize: 8.5, color: colors.muted }}>Прогресс по выданным ДЗ</Text>
              <Text style={{ fontSize: 8.5, fontWeight: 700 }}>
                {input.totalSolved} из {input.totalNumbers} · {totalPercent}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={{ height: "100%", width: `${totalPercent}%`, borderRadius: 3, backgroundColor: colors.teal }} />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{input.activityTitle}</Text>
        <View style={styles.daysRow}>
          {input.days.map((day) => {
            const value = Math.max(day.closedCount, day.redCount);
            const heightPercent = value > 0 ? Math.max(18, Math.round((value / maxDayValue) * 100)) : 0;
            const barColor = day.closedCount > 0 ? colors.teal : "#f2a93b";

            return (
              <View key={day.label} style={styles.dayColumn}>
                <View style={styles.dayBarArea}>
                  {value > 0 ? (
                    <View style={{ height: `${heightPercent}%`, backgroundColor: barColor, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
                  ) : (
                    <View style={{ height: 2, backgroundColor: "#e4e5e7" }} />
                  )}
                </View>
                <Text style={[styles.dayLabel, value === 0 ? { color: colors.faint } : {}]}>
                  {day.label} · {day.closedCount + day.redCount}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Занятия</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            {["Когда", "Занятие", "Темы", "Задач", "Итоги"].map((label, index) => (
              <Text key={label} style={[styles.th, { flexBasis: 0, flexGrow: lessonColumns[index]! * 100 }]}>
                {label}
              </Text>
            ))}
          </View>
          {input.lessons.length === 0 ? (
            <Text style={styles.empty}>Занятий за эту неделю не было.</Text>
          ) : (
            input.lessons.map((lesson, index) => (
              <View
                key={`${lesson.title}-${lesson.dateLabel}-${index}`}
                style={[styles.tr, index % 2 === 1 ? { backgroundColor: colors.zebra } : {}]}
                wrap={false}
              >
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 15, color: colors.muted }]}>{lesson.dateLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 27 }]}>{lesson.title}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 24, color: colors.muted }]}>{lesson.topicsLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 8 }]}>{lesson.totalLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 26 }]}>{lesson.resultsLabel}</Text>
              </View>
            ))
          )}
          {input.lessonsFootnote ? <Text style={styles.empty}>{input.lessonsFootnote}</Text> : null}
        </View>

        {input.attendance ? (
          <>
            <Text style={styles.sectionTitle}>Посещаемость групповых занятий</Text>
            <View style={styles.table}>
              <Text style={[styles.td, { fontWeight: 700 }]}>{input.attendance.summaryLabel}</Text>
              {input.attendance.rows.length === 0 ? (
                <Text style={styles.empty}>Пропусков и опозданий за период не было.</Text>
              ) : (
                input.attendance.rows.map((row, index) => (
                  <View
                    key={`${row.dateLabel}-${index}`}
                    style={[styles.tr, index % 2 === 1 ? { backgroundColor: colors.zebra } : {}]}
                    wrap={false}
                  >
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 15, color: colors.muted }]}>{row.dateLabel}</Text>
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 55 }]}>{row.title}</Text>
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 30, fontWeight: 700, color: attendanceRowColors[row.kind] }]}>
                      {row.label}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Домашние задания</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            {["Тема", "ДЗ", "Дедлайн", "Выполнено", "Проверка ИИ", "Итог"].map((label, index) => (
              <Text key={label} style={[styles.th, { flexBasis: 0, flexGrow: assignmentColumns[index]! * 100 }]}>
                {label}
              </Text>
            ))}
          </View>
          {input.assignments.length === 0 ? (
            <Text style={styles.empty}>Активных домашних заданий нет.</Text>
          ) : (
            input.assignments.map((assignment, index) => (
              <View
                key={`${assignment.topicTitle}-${assignment.label}-${index}`}
                style={[styles.tr, index % 2 === 1 ? { backgroundColor: colors.zebra } : {}]}
                wrap={false}
              >
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 22 }]}>{assignment.topicTitle}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 18 }]}>{assignment.label}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 14, color: colors.muted }]}>{assignment.deadlineLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 12 }]}>{assignment.doneLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 16, color: colors.muted }]}>{assignment.checkLabel}</Text>
                <View style={[styles.td, { flexBasis: 0, flexGrow: 18 }]}>
                  <Text
                    style={[
                      styles.chip,
                      {
                        backgroundColor: stateChipColors[assignment.stateKind].bg,
                        color: stateChipColors[assignment.stateKind].text
                      }
                    ]}
                  >
                    {assignment.stateLabel}
                  </Text>
                </View>
              </View>
            ))
          )}
          {input.assignmentsFootnote ? <Text style={styles.empty}>{input.assignmentsFootnote}</Text> : null}
        </View>

        {input.topicSummaries ? (
          <>
            <Text style={styles.sectionTitle}>Темы за период</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                {["Тема", "Разобрано", "Зелёные", "Жёлтые", "Красные", "Прогресс темы"].map((label, index) => (
                  <Text key={label} style={[styles.th, { flexBasis: 0, flexGrow: topicColumns[index]! * 100 }]}>
                    {label}
                  </Text>
                ))}
              </View>
              {input.topicSummaries.length === 0 ? (
                <Text style={styles.empty}>За этот период активности по темам не было.</Text>
              ) : (
                input.topicSummaries.map((topic, index) => (
                  <View
                    key={`${topic.topicTitle}-${index}`}
                    style={[styles.tr, index % 2 === 1 ? { backgroundColor: colors.zebra } : {}]}
                    wrap={false}
                  >
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 32 }]}>{topic.topicTitle}</Text>
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 14, fontWeight: 700 }]}>{topic.periodDone}</Text>
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 12, color: colors.green }]}>{topic.green}</Text>
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 12, color: colors.yellow }]}>{topic.yellow}</Text>
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 12, color: colors.red }]}>{topic.red}</Text>
                    <Text style={[styles.td, { flexBasis: 0, flexGrow: 18, color: colors.muted }]}>{topic.progressLabel}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : (
          <>
        <Text style={styles.sectionTitle}>Разобранные номера</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            {["Когда", "Тема", "№", "Результат", "Комментарий"].map((label, index) => (
              <Text key={label} style={[styles.th, { flexBasis: 0, flexGrow: rowColumns[index]! * 100 }]}>
                {label}
              </Text>
            ))}
          </View>
          {input.rows.length === 0 ? (
            <Text style={styles.empty}>За эту неделю ученик не отметил ни одного номера.</Text>
          ) : (
            input.rows.map((row, index) => (
              <View
                key={`${row.topicTitle}-${row.number}-${index}`}
                style={[styles.tr, index % 2 === 1 ? { backgroundColor: colors.zebra } : {}]}
                wrap={false}
              >
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 17, color: colors.muted }]}>{row.whenLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 27 }]}>{row.topicTitle}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 8 }]}>{String(row.number)}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 24, fontWeight: 700, color: statusTextColors[row.statusKey] ?? colors.muted }]}>
                  {row.statusLabel}
                </Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 24, color: colors.muted }]}>{row.note || "—"}</Text>
              </View>
            ))
          )}
        </View>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ШБЗ Школа</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `стр. ${pageNumber} из ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderWeeklyReportPdf(input: WeeklyPdfInput): Promise<Buffer> {
  if (!ensureFonts()) {
    fontsRegistered = null;
    throw new Error("PDF fonts unavailable");
  }

  return renderToBuffer(<WeeklyReportDocument input={input} />);
}
