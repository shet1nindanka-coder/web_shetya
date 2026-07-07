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
  stateLabel: string;
  stateKind: "done" | "progress" | "attention" | "muted";
};

export type WeeklyPdfRow = {
  whenLabel: string;
  topicTitle: string;
  number: number;
  statusKey: string;
  statusLabel: string;
  note: string;
};

export type WeeklyPdfInput = {
  studentName: string;
  studentEmail: string;
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
  assignments: WeeklyPdfAssignment[];
  rows: WeeklyPdfRow[];
};

let fontsPromise: Promise<boolean> | null = null;

async function registerFonts() {
  try {
    const response = await fetch(
      "https://fonts.googleapis.com/css2?family=Onest:wght@400;700&display=swap",
      { headers: { "User-Agent": "curl/8.0" } }
    );

    if (!response.ok) {
      throw new Error(`Font CSS request failed: ${response.status}`);
    }

    const css = await response.text();
    const blocks = css.split("@font-face").slice(1);
    const fonts: Array<{ src: string; fontWeight: number }> = [];

    for (const block of blocks) {
      const urlMatch = block.match(/url\((https:[^)]+\.ttf)\)/);
      const weightMatch = block.match(/font-weight:\s*(\d+)/);

      if (urlMatch && weightMatch) {
        fonts.push({ src: urlMatch[1]!, fontWeight: Number(weightMatch[1]) });
      }
    }

    if (fonts.length === 0) {
      throw new Error("No TTF urls found in font CSS");
    }

    Font.register({ family: "Onest", fonts });
    Font.registerHyphenationCallback((word) => [word]);
    return true;
  } catch (error) {
    logWarnEvent(
      "student.export.pdf_fonts_failed",
      {},
      error,
      "Failed to register Onest for PDF export, falling back to Helvetica."
    );
    return false;
  }
}

function ensureFonts() {
  if (!fontsPromise) {
    fontsPromise = registerFonts();
  }

  return fontsPromise;
}

const stateChipColors: Record<WeeklyPdfAssignment["stateKind"], { bg: string; text: string }> = {
  done: { bg: colors.greenSoft, text: colors.green },
  progress: { bg: colors.tealSoft, text: colors.tealDark },
  attention: { bg: colors.redSoft, text: colors.red },
  muted: { bg: colors.softBg, text: colors.muted }
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
    fontFamily: "Onest"
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { fontSize: 18, fontWeight: 700, letterSpacing: -0.8 },
  brandDivider: { width: 1, height: 14, backgroundColor: "#e4e5e7", marginHorizontal: 8 },
  brandSub: { fontSize: 8.5, color: colors.soft },
  kicker: { fontSize: 8.5, letterSpacing: 1.4, color: colors.soft, textAlign: "right" },
  generated: { fontSize: 8.5, color: colors.muted, marginTop: 3, textAlign: "right" },
  gradientLine: { flexDirection: "row", height: 3, borderRadius: 2, overflow: "hidden", marginTop: 12, marginBottom: 16 },
  gradientSegment: { flexGrow: 1 },
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
  const assignmentColumns = [0.3, 0.12, 0.18, 0.16, 0.24];
  const rowColumns = [0.17, 0.27, 0.08, 0.24, 0.24];

  return (
    <Document title={`Активность за 7 дней — ${input.studentName}`} author="ШБЗ · Школа Базовых Знаний">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>ШБЗ</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandSub}>Школа Базовых Знаний</Text>
          </View>
          <View>
            <Text style={styles.kicker}>ОТЧЁТ ЗА 7 ДНЕЙ</Text>
            <Text style={styles.generated}>сформирован {input.generatedLabel}</Text>
          </View>
        </View>
        <View style={styles.gradientLine}>
          {colors.gradient.map((color) => (
            <View key={color} style={[styles.gradientSegment, { backgroundColor: color }]} />
          ))}
        </View>

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

        <View style={styles.progressHeader}>
          <Text style={{ fontSize: 8.5, color: colors.muted }}>Общий прогресс по номерам</Text>
          <Text style={{ fontSize: 8.5, fontWeight: 700 }}>
            {input.totalSolved} из {input.totalNumbers} · {totalPercent}%
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={{ height: "100%", width: `${totalPercent}%`, borderRadius: 3, backgroundColor: colors.teal }} />
        </View>

        <Text style={styles.sectionTitle}>Активность по дням</Text>
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

        <Text style={styles.sectionTitle}>Домашние задания</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            {["Тема", "ДЗ", "Дедлайн", "Выполнено", "Итог"].map((label, index) => (
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
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 30 }]}>{assignment.topicTitle}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 12 }]}>{assignment.label}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 18, color: colors.muted }]}>{assignment.deadlineLabel}</Text>
                <Text style={[styles.td, { flexBasis: 0, flexGrow: 16 }]}>{assignment.doneLabel}</Text>
                <View style={[styles.td, { flexBasis: 0, flexGrow: 24 }]}>
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
        </View>

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

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ШБЗ · Школа Базовых Знаний</Text>
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
  const fontsRegistered = await ensureFonts();

  if (!fontsRegistered) {
    fontsPromise = null;
    throw new Error("PDF fonts unavailable");
  }

  return renderToBuffer(<WeeklyReportDocument input={input} />);
}
