import { HomeworkNumberStatus, SolutionCheckStatus, SolutionVerdict } from "@prisma/client";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { parseCheckResponse, type ParsedCheckResult } from "@/lib/solution-check-parse";
import { readStoredFile } from "@/lib/storage";

const MAX_PHOTOS_PER_CHECK = 10;
const MODEL_TIMEOUT_MS = 120_000;

export function getAiCheckConfig() {
  const apiKey = process.env.AI_CHECK_API_KEY?.trim();
  const model = process.env.AI_CHECK_MODEL?.trim();

  if (!apiKey || !model) {
    return null;
  }

  return {
    apiKey,
    model,
    baseUrl: process.env.AI_CHECK_BASE_URL?.trim() || "https://openrouter.ai/api/v1"
  };
}

const SYSTEM_PROMPT = [
  "Ты — внимательный проверяющий домашних заданий по математике для школьников.",
  "Тебе дают фото рукописного решения и список номеров с условиями и эталонными ответами.",
  "Действуй так: сначала найди на фото решение каждого номера и транскрибируй итоговый ответ ученика,",
  "затем сравни его с эталонным ответом и оцени ход решения.",
  "Правила вердиктов:",
  "- CORRECT — ответ совпадает с эталоном (с точностью до эквивалентных форм) и ход решения не содержит грубых ошибок;",
  "- INCORRECT — ответ не совпадает с эталоном или в решении явная ошибка; в comment укажи, где ошибка, и предложи перерешать;",
  "- UNCERTAIN — решение этого номера не найдено на фото, почерк нечитаем или эталонного ответа нет; не угадывай.",
  "Комментарии пиши по-русски, кратко (1–3 предложения), формулы — в LaTeX между $.",
  "Ответь СТРОГО одним JSON-объектом без пояснений вокруг, в формате:",
  '{"results":[{"number":1,"verdict":"CORRECT","recognized_answer":"...","comment":"...","confidence":0.9}]}',
  "Включи в results каждый номер из списка ровно один раз."
].join("\n");

type CheckAssignment = {
  id: string;
  studentId: string;
  topicId: string;
  topicTitle: string;
  numbers: Array<{
    homeworkNumberId: string;
    number: number;
    conditionLatex: string | null;
    answerLatex: string | null;
  }>;
  photos: Array<{
    storageKey: string;
    mimeType: string;
  }>;
};

function buildUserText(assignment: CheckAssignment) {
  const lines: string[] = [
    `Тема: «${assignment.topicTitle}». Проверь номера из домашнего задания по фото решения.`,
    ""
  ];

  for (const number of assignment.numbers) {
    lines.push(`Номер ${number.number}:`);
    lines.push(`  Условие: ${number.conditionLatex?.trim() || "не задано"}`);
    lines.push(`  Эталонный ответ: ${number.answerLatex?.trim() || "не задан (если решение не видно, ставь UNCERTAIN)"}`);
  }

  lines.push("");
  lines.push(`Всего номеров: ${assignment.numbers.length}. Фото решения приложены ниже.`);

  return lines.join("\n");
}

async function storedFileToDataUrl(storageKey: string, mimeType: string) {
  const payload = await readStoredFile(storageKey);

  if (!payload) {
    return null;
  }

  let buffer: Buffer;

  if (payload.body instanceof Uint8Array) {
    buffer = Buffer.from(payload.body);
  } else {
    const chunks: Uint8Array[] = [];
    const reader = payload.body.getReader();

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value) {
        chunks.push(value);
      }
    }

    buffer = Buffer.concat(chunks);
  }

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function callModel(
  config: NonNullable<ReturnType<typeof getAiCheckConfig>>,
  userText: string,
  imageUrls: string[],
  extraInstruction?: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://shetya.ru",
        "X-Title": "TutorFlow"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: extraInstruction ? `${userText}\n\n${extraInstruction}` : userText },
              ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } }))
            ]
          }
        ]
      }),
      signal: controller.signal
    });

    const rawBody = await response.text();
    let payload: {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    } | null = null;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = null;
    }

    if (!response.ok) {
      logWarnEvent(
        "solution.check.api_error",
        { status: response.status, body: rawBody.slice(0, 600) },
        undefined,
        "Model API returned an error."
      );
      throw new Error(
        payload?.error?.message || `Модель вернула статус ${response.status}: ${rawBody.slice(0, 200) || "пустой ответ"}`
      );
    }

    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Модель вернула пустой ответ.");
    }

    return {
      content,
      inputTokens: payload?.usage?.prompt_tokens ?? null,
      outputTokens: payload?.usage?.completion_tokens ?? null
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function applyVerdicts(assignment: CheckAssignment, results: ParsedCheckResult[]) {
  const numberByValue = new Map(assignment.numbers.map((number) => [number.number, number]));
  const operations = [];

  for (const result of results) {
    const target = numberByValue.get(result.number);

    if (!target || result.verdict === "UNCERTAIN") {
      continue;
    }

    const nextStatus =
      result.verdict === "CORRECT" ? HomeworkNumberStatus.GREEN : HomeworkNumberStatus.RED;

    operations.push(
      prisma.studentTopicNumberStatus.upsert({
        where: {
          studentId_homeworkNumberId: {
            studentId: assignment.studentId,
            homeworkNumberId: target.homeworkNumberId
          }
        },
        update: { status: nextStatus },
        create: {
          studentId: assignment.studentId,
          homeworkNumberId: target.homeworkNumberId,
          status: nextStatus
        }
      })
    );
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }
}

export async function runHomeworkCheck(checkId: string) {
  const config = getAiCheckConfig();

  const check = await prisma.homeworkCheck.findUnique({
    where: { id: checkId },
    select: {
      id: true,
      status: true,
      assignment: {
        select: {
          id: true,
          studentId: true,
          topicId: true,
          topic: { select: { title: true } },
          numbers: {
            select: {
              homeworkNumber: {
                select: {
                  id: true,
                  number: true,
                  conditionLatex: true,
                  answerLatex: true
                }
              }
            }
          },
          photos: {
            orderBy: { createdAt: "asc" },
            select: {
              file: {
                select: {
                  storageKey: true,
                  mimeType: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!check || !check.assignment) {
    return;
  }

  const assignment: CheckAssignment = {
    id: check.assignment.id,
    studentId: check.assignment.studentId,
    topicId: check.assignment.topicId,
    topicTitle: check.assignment.topic.title,
    numbers: check.assignment.numbers
      .map((entry) => ({
        homeworkNumberId: entry.homeworkNumber.id,
        number: entry.homeworkNumber.number,
        conditionLatex: entry.homeworkNumber.conditionLatex,
        answerLatex: entry.homeworkNumber.answerLatex
      }))
      .sort((left, right) => left.number - right.number),
    photos: check.assignment.photos.map((photo) => ({
      storageKey: photo.file.storageKey,
      mimeType: photo.file.mimeType
    }))
  };

  const failCheck = async (message: string) => {
    await prisma.homeworkCheck.update({
      where: { id: checkId },
      data: {
        status: SolutionCheckStatus.FAILED,
        error: message.slice(0, 500),
        checkedAt: new Date()
      }
    });
  };

  if (!config) {
    await failCheck("Автопроверка не настроена: нет AI_CHECK_API_KEY или AI_CHECK_MODEL.");
    return;
  }

  if (assignment.photos.length === 0 || assignment.numbers.length === 0) {
    await failCheck("Нет фото решения или номеров для проверки.");
    return;
  }

  await prisma.homeworkCheck.update({
    where: { id: checkId },
    data: { status: SolutionCheckStatus.CHECKING, modelUsed: config.model }
  });

  logInfoEvent("solution.check.started", {
    checkId,
    assignmentId: assignment.id,
    studentId: assignment.studentId,
    photosCount: assignment.photos.length,
    numbersCount: assignment.numbers.length
  });

  try {
    const imageUrls: string[] = [];

    for (const photo of assignment.photos.slice(0, MAX_PHOTOS_PER_CHECK)) {
      const dataUrl = await storedFileToDataUrl(photo.storageKey, photo.mimeType);

      if (dataUrl) {
        imageUrls.push(dataUrl);
      }
    }

    if (imageUrls.length === 0) {
      await failCheck("Не удалось прочитать фото решения из хранилища.");
      return;
    }

    const userText = buildUserText(assignment);
    const validNumbers = assignment.numbers.map((number) => number.number);

    let modelResponse = await callModel(config, userText, imageUrls);
    let results: ParsedCheckResult[];

    try {
      results = parseCheckResponse(modelResponse.content, validNumbers);
    } catch {
      logWarnEvent("solution.check.retry", { checkId }, undefined, "Model returned invalid JSON, retrying once.");
      modelResponse = await callModel(
        config,
        userText,
        imageUrls,
        "Предыдущий ответ не удалось разобрать. Верни СТРОГО один JSON-объект по формату, без текста вокруг."
      );
      results = parseCheckResponse(modelResponse.content, validNumbers);
    }

    if (results.length === 0) {
      await failCheck("Модель не вернула ни одного вердикта.");
      return;
    }

    const numberByValue = new Map(assignment.numbers.map((number) => [number.number, number]));

    await prisma.$transaction([
      prisma.homeworkCheckResult.deleteMany({ where: { checkId } }),
      prisma.homeworkCheckResult.createMany({
        data: results.map((result) => ({
          checkId,
          homeworkNumberId: numberByValue.get(result.number)!.homeworkNumberId,
          verdict: result.verdict as SolutionVerdict,
          recognizedAnswer: result.recognizedAnswer,
          comment: result.comment,
          confidence: result.confidence
        }))
      })
    ]);

    await applyVerdicts(assignment, results);

    await prisma.homeworkCheck.update({
      where: { id: checkId },
      data: { status: SolutionCheckStatus.DONE, checkedAt: new Date() }
    });

    const correctCount = results.filter((result) => result.verdict === "CORRECT").length;
    const incorrectCount = results.filter((result) => result.verdict === "INCORRECT").length;
    const uncertainCount = results.filter((result) => result.verdict === "UNCERTAIN").length;

    await createNotification({
      userId: assignment.studentId,
      type: "homework-checked",
      title: "ИИ проверил ваше решение",
      body: `Верно: ${correctCount} · перерешать: ${incorrectCount}${uncertainCount > 0 ? ` · не распознано: ${uncertainCount}` : ""}`,
      href: `/student/homeworks/${assignment.id}`
    });

    publishDashboardRealtimeEvent({
      kind: "student-progress-changed",
      studentId: assignment.studentId,
      topicId: assignment.topicId
    });

    try {
      revalidateAllPlatformData();
    } catch {
      // Вне request-контекста ревалидация может быть недоступна — страховка в GET-роуте статуса.
    }

    logInfoEvent("solution.check.succeeded", {
      checkId,
      assignmentId: assignment.id,
      correctCount,
      incorrectCount,
      uncertainCount,
      inputTokens: modelResponse.inputTokens,
      outputTokens: modelResponse.outputTokens
    });
  } catch (error) {
    logErrorEvent("solution.check.failed", { checkId, assignmentId: assignment.id }, error, "Homework check failed.");
    await failCheck(error instanceof Error ? error.message : "Не удалось проверить решение.");
  }
}
