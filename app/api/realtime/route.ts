import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import {
  acquireDashboardRealtimeConnection,
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

  const rateLimitResponse = await enforceApiRateLimit("api:realtime-connect", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const releaseConnection = acquireDashboardRealtimeConnection(user.id);

  if (!releaseConnection) {
    return NextResponse.json(
      { error: "Слишком много одновременных realtime-соединений." },
      {
        status: 429,
        headers: { "Retry-After": "5" }
      }
    );
  }

  let cleanup = releaseConnection;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let cleanedUp = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let unsubscribe = () => {};

      const abortHandler = () => cleanup();

      cleanup = () => {
        if (cleanedUp) {
          return;
        }

        cleanedUp = true;
        request.signal.removeEventListener("abort", abortHandler);

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        unsubscribe();
        releaseConnection();

        try {
          controller.close();
        } catch {
          // stream may already be closed or cancelled
        }
      };

      const enqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          cleanup();
          return false;
        }
      };

      if (!enqueue(formatSseData({ kind: "connected", occurredAt: new Date().toISOString() }))) {
        return;
      }

      unsubscribe = subscribeDashboardRealtimeEvent((event) => {
        if (!shouldReceiveDashboardRealtimeEvent(user, event)) {
          return;
        }

        enqueue(formatSseData(event));
      });

      heartbeat = setInterval(() => {
        enqueue(formatSseComment("ping"));
      }, 25_000);

      if (request.signal.aborted) {
        cleanup();
        return;
      }

      request.signal.addEventListener("abort", abortHandler, { once: true });
    },
    cancel() {
      cleanup();
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
