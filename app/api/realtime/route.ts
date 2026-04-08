import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import {
  publishDashboardRealtimeEvent,
  shouldReceiveDashboardRealtimeEvent,
  subscribeDashboardRealtimeEvent
} from "@/lib/dashboard-realtime";

export const runtime = "nodejs";

const encoder = new TextEncoder();

function formatSseData(data: unknown) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function formatSseComment(comment: string) {
  return encoder.encode(`: ${comment}\n\n`);
}

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(formatSseData({ kind: "connected", occurredAt: new Date().toISOString() }));

      const unsubscribe = subscribeDashboardRealtimeEvent((event) => {
        if (!shouldReceiveDashboardRealtimeEvent(user, event)) {
          return;
        }

        controller.enqueue(formatSseData(event));
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(formatSseComment("ping"));
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // stream may already be closed
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
