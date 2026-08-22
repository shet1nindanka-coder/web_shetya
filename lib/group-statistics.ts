/*
 * Статистика группы: чистая логика поверх посчитанных метрик участников.
 * Данные собирает getGroupStatistics в lib/platform-data.ts; здесь — ранжирование,
 * топы и «кому нужно внимание». Без БД, покрыто тестами.
 */

export type GroupMemberActivity = {
  id: string;
  name: string;
  /** Закрыто номеров (зелёный/жёлтый) за последние 7 дней. */
  closed7: number;
  /** Закрыто за последние 30 дней. */
  closed30: number;
  /** Красных отметок за последние 30 дней. */
  red30: number;
  /** Текущий стрик, дней. */
  streak: number;
  /** ДЗ, у которых прошёл дедлайн и не все номера закрыты. */
  overdueHomeworks: number;
  /** ДЗ в работе (не завершены, дедлайн не прошёл или не задан). */
  activeHomeworks: number;
  /** Дата последнего изменения статуса по номеру. */
  lastActivityAt: Date | null;
};

export type GroupMemberRow = GroupMemberActivity & {
  rank: number;
  /** Дней без активности (null — активности не было вообще). */
  idleDays: number | null;
  attention: string[];
};

export type GroupStatistics = {
  members: GroupMemberRow[];
  mostActive: GroupMemberRow | null;
  leastActive: GroupMemberRow | null;
  totals: { closed7: number; closed30: number; red30: number; overdueHomeworks: number; attentionCount: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const IDLE_ATTENTION_DAYS = 7;

function idleDaysOf(lastActivityAt: Date | null, now: Date): number | null {
  if (!lastActivityAt) return null;
  return Math.max(0, Math.floor((now.getTime() - lastActivityAt.getTime()) / DAY_MS));
}

function attentionFlags(member: GroupMemberActivity, idleDays: number | null): string[] {
  const flags: string[] = [];

  if (member.overdueHomeworks > 0) {
    flags.push(member.overdueHomeworks === 1 ? "просрочено ДЗ" : `просрочено ДЗ: ${member.overdueHomeworks}`);
  }
  if (idleDays === null) {
    flags.push("ещё не начинал");
  } else if (idleDays >= IDLE_ATTENTION_DAYS) {
    flags.push(`без активности ${idleDays} дн.`);
  }
  if (member.red30 >= 5) {
    flags.push(`красных за месяц: ${member.red30}`);
  }

  return flags;
}

/** Самый активный выше: за 7 дней, затем за 30, затем стрик, затем имя. */
export function compareByActivity(a: GroupMemberActivity, b: GroupMemberActivity): number {
  return (
    b.closed7 - a.closed7 ||
    b.closed30 - a.closed30 ||
    b.streak - a.streak ||
    a.name.localeCompare(b.name, "ru")
  );
}

export function buildGroupStatistics(members: GroupMemberActivity[], now: Date): GroupStatistics {
  const rows: GroupMemberRow[] = [...members].sort(compareByActivity).map((member, index) => {
    const idleDays = idleDaysOf(member.lastActivityAt, now);
    return { ...member, rank: index + 1, idleDays, attention: attentionFlags(member, idleDays) };
  });

  const mostActive = rows.length >= 2 && rows[0].closed30 > 0 ? rows[0] : null;
  const leastActive = rows.length >= 2 ? rows[rows.length - 1] : null;

  return {
    members: rows,
    mostActive,
    leastActive,
    totals: {
      closed7: rows.reduce((sum, row) => sum + row.closed7, 0),
      closed30: rows.reduce((sum, row) => sum + row.closed30, 0),
      red30: rows.reduce((sum, row) => sum + row.red30, 0),
      overdueHomeworks: rows.reduce((sum, row) => sum + row.overdueHomeworks, 0),
      attentionCount: rows.filter((row) => row.attention.length > 0).length
    }
  };
}
