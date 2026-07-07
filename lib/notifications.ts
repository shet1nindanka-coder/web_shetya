import { prisma } from "@/lib/prisma";
import { logWarnEvent } from "@/lib/logger";

export type StudentNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

// Модель Notification может отсутствовать в сгенерированном клиенте/БД до
// prisma generate + db push, поэтому обращаемся через мягкую обёртку и не
// роняем основной сценарий, если таблицы ещё нет.
type NotificationDelegate = {
  create(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
  count(args: unknown): Promise<number>;
  updateMany(args: unknown): Promise<unknown>;
};

function getNotificationDelegate(): NotificationDelegate | null {
  const delegate = (prisma as unknown as { notification?: NotificationDelegate }).notification;
  return delegate ?? null;
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
}) {
  const delegate = getNotificationDelegate();

  if (!delegate) {
    return;
  }

  try {
    await delegate.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null
      }
    });
  } catch (error) {
    logWarnEvent(
      "notifications.create.failed",
      { userId: input.userId, type: input.type },
      error,
      "Failed to create notification (is the Notification table migrated?)."
    );
  }
}

export async function listNotifications(userId: string, limit = 20) {
  const delegate = getNotificationDelegate();

  if (!delegate) {
    return { notifications: [] as StudentNotification[], unreadCount: 0 };
  }

  try {
    const [rows, unreadCount] = await Promise.all([
      delegate.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          href: true,
          readAt: true,
          createdAt: true
        }
      }),
      delegate.count({ where: { userId, readAt: null } })
    ]);

    const notifications: StudentNotification[] = rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      title: String(row.title),
      body: row.body ? String(row.body) : null,
      href: row.href ? String(row.href) : null,
      readAt: row.readAt ? new Date(row.readAt as string | Date).toISOString() : null,
      createdAt: new Date(row.createdAt as string | Date).toISOString()
    }));

    return { notifications, unreadCount };
  } catch (error) {
    logWarnEvent(
      "notifications.list.failed",
      { userId },
      error,
      "Failed to list notifications (is the Notification table migrated?)."
    );
    return { notifications: [] as StudentNotification[], unreadCount: 0 };
  }
}

export async function markNotificationsRead(userId: string, notificationId?: string) {
  const delegate = getNotificationDelegate();

  if (!delegate) {
    return;
  }

  try {
    await delegate.updateMany({
      where: {
        userId,
        readAt: null,
        ...(notificationId ? { id: notificationId } : {})
      },
      data: { readAt: new Date() }
    });
  } catch (error) {
    logWarnEvent(
      "notifications.mark_read.failed",
      { userId },
      error,
      "Failed to mark notifications as read."
    );
  }
}
