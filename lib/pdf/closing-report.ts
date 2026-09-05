import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

type Group = {
  id: string;
  name: string;
};

type Question = {
  id: string;
  question_group_id: string | null;
  code: string;
  question_text: string;
  question_type: string;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
};

type Answer = {
  value?: boolean | number | string;
  notes?: string;
  correctiveAction?: string;
  photo?: File;
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 34,
  top: 34,
  bottom: 28,
};

const COLORS = {
  red: rgb(0.73, 0.21, 0.14),
  redSoft: rgb(0.98, 0.93, 0.92),
  green: rgb(0.08, 0.60, 0.42),
  greenSoft: rgb(0.90, 0.97, 0.94),
  text: rgb(0.12, 0.12, 0.13),
  muted: rgb(0.47, 0.49, 0.52),
  line: rgb(0.88, 0.88, 0.88),
  card: rgb(1, 1, 1),
  page: rgb(0.985, 0.985, 0.985),
  blackSoft: rgb(0.16, 0.16, 0.16),
};

const BRAND = {
  cq: "/brand/chongqing-hotpot.png",
  dd: "/brand/dingding-hotpot.png",
};

function safeText(value: unknown) {
  if (value === null || value === undefined) return "-";
  return String(value);
}

function formatDateID(date = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatTimeID(date = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function isException(
  question: Question,
  answer?: Answer
) {
  if (!answer) return false;

  if (question.question_type === "yes_no") {
    return answer.value === false;
  }

  if (
    question.question_type === "temperature" &&
    typeof answer.value === "number"
  ) {
    if (
      question.min_value !== null &&
      answer.value < Number(question.min_value)
    ) {
      return true;
    }

    if (
      question.max_value !== null &&
      answer.value > Number(question.max_value)
    ) {
      return true;
    }
  }

  return false;
}

function answerText(
  question: Question,
  answer?: Answer
) {
  if (!answer) return "-";

  if (question.question_type === "yes_no") {
    return answer.value === true
      ? "YES"
      : answer.value === false
        ? "NO"
        : "-";
  }

  if (question.question_type === "temperature") {
    const value = safeText(answer.value);
    return `${value}${question.unit ? ` ${question.unit}` : ""}`.trim();
  }

  return safeText(answer.value);
}

function standardText(question: Question) {
  if (question.question_type !== "temperature") {
    return "";
  }

  const min =
    question.min_value !== null
      ? `${question.min_value}${question.unit ? ` ${question.unit}` : ""}`
      : null;

  const max =
    question.max_value !== null
      ? `${question.max_value}${question.unit ? ` ${question.unit}` : ""}`
      : null;

  if (min && max) {
    return `${min} - ${max}`;
  }

  return min || max || "-";
}

function wrapText(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
) {
  const normalized = safeText(text).replace(/\s+/g, " ").trim();

  if (!normalized) return ["-"];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);

    if (width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines;
}

function drawTextLines(
  page: any,
  lines: string[],
  {
    x,
    y,
    lineHeight,
    font,
    size,
    color,
  }: {
    x: number;
    y: number;
    lineHeight: number;
    font: any;
    size: number;
    color: any;
  }
) {
  let cursor = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: cursor,
      size,
      font,
      color,
    });

    cursor -= lineHeight;
  }

  return cursor;
}

function drawLabelValue(
  page: any,
  {
    x,
    y,
    label,
    value,
    width,
    labelFont,
    valueFont,
  }: {
    x: number;
    y: number;
    label: string;
    value: string;
    width: number;
    labelFont: any;
    valueFont: any;
  }
) {
  page.drawText(label.toUpperCase(), {
    x,
    y,
    size: 8,
    font: labelFont,
    color: COLORS.muted,
  });

  const lines = wrapText(value, valueFont, 11, width);
  drawTextLines(page, lines, {
    x,
    y: y - 18,
    lineHeight: 14,
    font: valueFont,
    size: 11,
    color: COLORS.text,
  });
}

function drawStatCard(
  page: any,
  {
    x,
    y,
    width,
    height,
    title,
    value,
    valueColor,
    labelFont,
    valueFont,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    value: string;
    valueColor: any;
    labelFont: any;
    valueFont: any;
  }
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: COLORS.card,
    borderColor: COLORS.line,
    borderWidth: 1,
  });

  page.drawText(title.toUpperCase(), {
    x: x + 14,
    y: y + height - 18,
    size: 8,
    font: labelFont,
    color: COLORS.muted,
  });

  page.drawText(value, {
    x: x + 14,
    y: y + 22,
    size: 16,
    font: valueFont,
    color: valueColor,
  });
}

function fitContain(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  const ratio = Math.min(
    maxWidth / sourceWidth,
    maxHeight / sourceHeight
  );

  return {
    width: sourceWidth * ratio,
    height: sourceHeight * ratio,
  };
}

async function loadBrandImage(
  pdf: PDFDocument,
  url: string
) {
  try {
    const response = await fetch(url);

    if (!response.ok) return null;

    const bytes = await response.arrayBuffer();

    try {
      return await pdf.embedPng(bytes);
    } catch {
      return await pdf.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}

async function imageFileToJpeg(
  file: File
): Promise<Uint8Array> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            `Foto ${file.name} tidak dapat dibaca. Gunakan JPEG/PNG.`
          )
        );
      image.src = objectUrl;
    });

    const maxWidth = 1100;
    const maxHeight = 1100;

    const ratio = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight
    );

    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to process photo.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Unable to compress photo."));
          }
        },
        "image/jpeg",
        0.58
      );
    });

    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function createOrderedQuestions(
  groups: Group[],
  questions: Question[]
) {
  const grouped: Question[] = [];

  for (const group of groups) {
    const groupQuestions = questions.filter(
      (q) => q.question_group_id === group.id
    );

    grouped.push(...groupQuestions);
  }

  const leftover = questions.filter(
    (q) => !grouped.some((g) => g.id === q.id)
  );

  grouped.push(...leftover);

  return grouped;
}

function groupNameForQuestion(
  groups: Group[],
  question: Question
) {
  return (
    groups.find((g) => g.id === question.question_group_id)?.name ||
    "General"
  );
}

function issueSummaryRows(
  groups: Group[],
  questions: Question[],
  answers: Record<string, Answer>
) {
  return questions
    .filter((q) => isException(q, answers[q.id]))
    .map((q, index) => ({
      order: index + 1,
      group: groupNameForQuestion(groups, q),
      question: q,
      answer: answers[q.id],
    }));
}

function cardHeightForQuestion(
  question: Question,
  answer: Answer | undefined,
  fonts: { normal: any; bold: any }
) {
  const leftWidth = 245;
  const qLines = wrapText(
    question.question_text,
    fonts.bold,
    12,
    leftWidth
  );

  const noteLines =
    answer?.notes && isException(question, answer)
      ? wrapText(answer.notes, fonts.normal, 8.5, leftWidth - 20).slice(0, 4)
      : [];

  const actionLines =
    answer?.correctiveAction && isException(question, answer)
      ? wrapText(answer.correctiveAction, fonts.normal, 8.5, leftWidth - 20).slice(0, 4)
      : [];

  let height = 190;
  height += Math.max(0, qLines.length - 2) * 14;

  if (question.question_type === "temperature") {
    height += 14;
  }

  if (isException(question, answer)) {
    height += 20;

    if (noteLines.length) {
      height += 18 + noteLines.length * 11;
    }

    if (actionLines.length) {
      height += 18 + actionLines.length * 11;
    }

    height += 16;
  }

  return Math.max(200, Math.min(height, 320));
}

async function drawBrandHeader(
  page: any,
  fonts: { normal: any; bold: any },
  logos: { cq: any; dd: any },
  {
    compact = false,
    reportNumber,
    outletName,
    reportDate,
  }: {
    compact?: boolean;
    reportNumber: string;
    outletName: string;
    reportDate: string;
  }
) {
  page.drawRectangle({
    x: 0,
    y: PAGE.height - 8,
    width: PAGE.width,
    height: 8,
    color: COLORS.red,
  });

  if (!compact) {
    if (logos.cq) {
      const box = fitContain(logos.cq.width, logos.cq.height, 180, 54);

      page.drawImage(logos.cq, {
        x: PAGE.marginX,
        y: PAGE.height - 76,
        width: box.width,
        height: box.height,
      });
    }

    if (logos.dd) {
      const box = fitContain(logos.dd.width, logos.dd.height, 170, 58);

      page.drawImage(logos.dd, {
        x: PAGE.width - PAGE.marginX - box.width,
        y: PAGE.height - 78,
        width: box.width,
        height: box.height,
      });
    }
  } else {
    if (logos.cq) {
      const box = fitContain(logos.cq.width, logos.cq.height, 120, 34);

      page.drawImage(logos.cq, {
        x: PAGE.marginX,
        y: PAGE.height - 48,
        width: box.width,
        height: box.height,
      });
    }

    if (logos.dd) {
      const box = fitContain(logos.dd.width, logos.dd.height, 108, 34);

      page.drawImage(logos.dd, {
        x: PAGE.width - PAGE.marginX - box.width,
        y: PAGE.height - 48,
        width: box.width,
        height: box.height,
      });
    }
  }

  page.drawLine({
    start: { x: PAGE.marginX, y: PAGE.height - (compact ? 58 : 92) },
    end: { x: PAGE.width - PAGE.marginX, y: PAGE.height - (compact ? 58 : 92) },
    thickness: 1,
    color: COLORS.line,
  });

  if (compact) {
    page.drawText("CLOSING REPORT", {
      x: PAGE.marginX,
      y: PAGE.height - 76,
      size: 11,
      font: fonts.bold,
      color: COLORS.text,
    });

    page.drawText(`${outletName} - ${reportDate}`, {
      x: PAGE.width - PAGE.marginX - 155,
      y: PAGE.height - 76,
      size: 8,
      font: fonts.normal,
      color: COLORS.muted,
    });

    page.drawText("CHECKLIST DETAIL", {
      x: PAGE.marginX,
      y: PAGE.height - 96,
      size: 8,
      font: fonts.bold,
      color: COLORS.muted,
    });

    page.drawText(reportNumber, {
      x: PAGE.marginX,
      y: PAGE.height - 110,
      size: 7,
      font: fonts.normal,
      color: COLORS.muted,
    });
  }
}

async function drawCoverPage(
  pdf: PDFDocument,
  fonts: { normal: any; bold: any },
  logos: { cq: any; dd: any },
  {
    reportNumber,
    outletName,
    submittedBy,
    groups,
    questions,
    answers,
  }: {
    reportNumber: string;
    outletName: string;
    submittedBy: string;
    groups: Group[];
    questions: Question[];
    answers: Record<string, Answer>;
  }
) {
  const page = pdf.addPage([PAGE.width, PAGE.height]);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: COLORS.page,
  });

  const now = new Date();
  const reportDate = formatDateID(now);
  const reportTime = formatTimeID(now);
  const issues = issueSummaryRows(groups, questions, answers);
  const photoCount = Object.values(answers).filter((a) => a?.photo).length;

  await drawBrandHeader(page, fonts, logos, {
    reportNumber,
    outletName,
    reportDate,
  });

  page.drawText("CQ OPERATIONAL SYSTEM", {
    x: PAGE.marginX,
    y: PAGE.height - 115,
    size: 9,
    font: fonts.bold,
    color: COLORS.red,
  });

  page.drawText("CLOSING REPORT", {
    x: PAGE.marginX,
    y: PAGE.height - 160,
    size: 28,
    font: fonts.bold,
    color: COLORS.text,
  });

  page.drawText("BOH / KITCHEN", {
    x: PAGE.marginX,
    y: PAGE.height - 190,
    size: 16,
    font: fonts.bold,
    color: COLORS.red,
  });

  page.drawText("Operational closing checklist & photo evidence", {
    x: PAGE.marginX,
    y: PAGE.height - 216,
    size: 10,
    font: fonts.normal,
    color: COLORS.muted,
  });

  const pillX = PAGE.width - PAGE.marginX - 130;
  const pillY = PAGE.height - 176;

  page.drawRectangle({
    x: pillX,
    y: pillY,
    width: 130,
    height: 32,
    color: COLORS.greenSoft,
  });

  page.drawCircle({
    x: pillX + 19,
    y: pillY + 16,
    size: 4,
    color: COLORS.green,
  });

  page.drawText("COMPLETED", {
    x: pillX + 31,
    y: pillY + 10,
    size: 10,
    font: fonts.bold,
    color: COLORS.green,
  });

  page.drawRectangle({
    x: PAGE.marginX,
    y: PAGE.height - 360,
    width: PAGE.width - PAGE.marginX * 2,
    height: 140,
    color: COLORS.card,
    borderColor: COLORS.line,
    borderWidth: 1,
  });

  const leftX = PAGE.marginX + 18;
  const rightX = PAGE.width / 2 + 8;
  const infoTop = PAGE.height - 260;

  drawLabelValue(page, {
    x: leftX,
    y: infoTop,
    label: "Outlet",
    value: outletName,
    width: 180,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  drawLabelValue(page, {
    x: leftX,
    y: infoTop - 54,
    label: "Date",
    value: reportDate,
    width: 180,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  drawLabelValue(page, {
    x: leftX,
    y: infoTop - 108,
    label: "Submitted",
    value: `${reportTime} WIB`,
    width: 180,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  drawLabelValue(page, {
    x: rightX,
    y: infoTop,
    label: "PIC",
    value: submittedBy,
    width: 180,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  drawLabelValue(page, {
    x: rightX,
    y: infoTop - 54,
    label: "Report ID",
    value: reportNumber,
    width: 190,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  const statY = PAGE.height - 490;
  const statW = 117;
  const statH = 82;
  const gap = 12;

  drawStatCard(page, {
    x: PAGE.marginX,
    y: statY,
    width: statW,
    height: statH,
    title: "Checklist",
    value: `${questions.length} / ${questions.length}`,
    valueColor: COLORS.green,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  drawStatCard(page, {
    x: PAGE.marginX + statW + gap,
    y: statY,
    width: statW,
    height: statH,
    title: "Photos",
    value: String(photoCount),
    valueColor: COLORS.text,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  drawStatCard(page, {
    x: PAGE.marginX + (statW + gap) * 2,
    y: statY,
    width: statW,
    height: statH,
    title: "Issues",
    value: String(issues.length),
    valueColor: issues.length ? COLORS.red : COLORS.green,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  drawStatCard(page, {
    x: PAGE.marginX + (statW + gap) * 3,
    y: statY,
    width: statW + 4,
    height: statH,
    title: "Status",
    value: "Completed",
    valueColor: COLORS.green,
    labelFont: fonts.bold,
    valueFont: fonts.bold,
  });

  const followY = PAGE.height - 650;
  const followH = issues.length ? 124 : 82;

  page.drawRectangle({
    x: PAGE.marginX,
    y: followY,
    width: PAGE.width - PAGE.marginX * 2,
    height: followH,
    color: issues.length ? COLORS.redSoft : COLORS.greenSoft,
    borderColor: issues.length ? rgb(0.93, 0.78, 0.76) : rgb(0.76, 0.90, 0.84),
    borderWidth: 1,
  });

  if (issues.length) {
    page.drawText("FOLLOW-UP REQUIRED", {
      x: PAGE.marginX + 18,
      y: followY + followH - 22,
      size: 10,
      font: fonts.bold,
      color: COLORS.red,
    });

    let issueY = followY + followH - 48;
    const showIssues = issues.slice(0, 3);

    for (const row of showIssues) {
      const answer = row.answer;
      const value = answerText(row.question, answer);

      page.drawText(
        `${String(
          questions.findIndex((q) => q.id === row.question.id) + 1
        ).padStart(2, "0")}  ${row.question.question_text}  ·  ${value}`,
        {
          x: PAGE.marginX + 18,
          y: issueY,
          size: 10.5,
          font: fonts.bold,
          color: COLORS.text,
        }
      );

      issueY -= 16;

      const notes = answer?.notes ? `Notes: ${answer.notes}` : "";
      const action = answer?.correctiveAction
        ? `Corrective: ${answer.correctiveAction}`
        : "";

      const meta = [notes, action].filter(Boolean).join("  |  ");

      if (meta) {
        const lines = wrapText(meta, fonts.normal, 8.5, PAGE.width - PAGE.marginX * 2 - 36);
        issueY = drawTextLines(page, lines, {
          x: PAGE.marginX + 18,
          y: issueY,
          lineHeight: 11,
          font: fonts.normal,
          size: 8.5,
          color: COLORS.muted,
        });
      }

      issueY -= 8;
    }
  } else {
    page.drawText("NO FOLLOW-UP REQUIRED", {
      x: PAGE.marginX + 18,
      y: followY + 48,
      size: 11,
      font: fonts.bold,
      color: COLORS.green,
    });

    page.drawText("All checklist items are within standard.", {
      x: PAGE.marginX + 18,
      y: followY + 28,
      size: 9,
      font: fonts.normal,
      color: COLORS.muted,
    });
  }

  page.drawText("CQ OPERATIONAL SYSTEM", {
    x: PAGE.width - PAGE.marginX - 128,
    y: 24,
    size: 9,
    font: fonts.bold,
    color: COLORS.red,
  });

  return page;
}

function createDetailPage(
  pdf: PDFDocument,
  fonts: { normal: any; bold: any },
  logos: { cq: any; dd: any },
  meta: {
    reportNumber: string;
    outletName: string;
    reportDate: string;
  }
) {
  const page = pdf.addPage([PAGE.width, PAGE.height]);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: COLORS.page,
  });

  drawBrandHeader(page, fonts, logos, {
    compact: true,
    reportNumber: meta.reportNumber,
    outletName: meta.outletName,
    reportDate: meta.reportDate,
  });

  return page;
}

async function drawQuestionCard(
  page: any,
  pdf: PDFDocument,
  fonts: { normal: any; bold: any },
  {
    x,
    yTop,
    width,
    questionNumber,
    groupName,
    question,
    answer,
  }: {
    x: number;
    yTop: number;
    width: number;
    questionNumber: number;
    groupName: string;
    question: Question;
    answer?: Answer;
  }
) {
  const issue = isException(question, answer);
  const cardHeight = cardHeightForQuestion(question, answer, fonts);
  const y = yTop - cardHeight;
  const padding = 14;
  const accent = issue ? COLORS.red : COLORS.green;

  page.drawRectangle({
    x,
    y,
    width,
    height: cardHeight,
    color: COLORS.card,
    borderColor: COLORS.line,
    borderWidth: 1,
  });

  page.drawRectangle({
    x,
    y,
    width: 5,
    height: cardHeight,
    color: accent,
  });

  const leftX = x + 16;
  const leftWidth = 255;
  const photoW = 190;
  const photoX = x + width - photoW - 14;
  const photoY = y + 16;
  const photoH = cardHeight - 32;

  page.drawRectangle({
    x: leftX,
    y: y + cardHeight - 28,
    width: 24,
    height: 18,
    color: issue ? COLORS.redSoft : COLORS.greenSoft,
  });

  page.drawText(String(questionNumber).padStart(2, "0"), {
    x: leftX + 5,
    y: y + cardHeight - 21,
    size: 8,
    font: fonts.bold,
    color: issue ? COLORS.red : COLORS.green,
  });

  page.drawText(groupName.toUpperCase(), {
    x: leftX + 34,
    y: y + cardHeight - 20,
    size: 8,
    font: fonts.bold,
    color: COLORS.muted,
  });

  const qLines = wrapText(
    question.question_text,
    fonts.bold,
    12,
    leftWidth
  );

  let cursor = drawTextLines(page, qLines, {
    x: leftX,
    y: y + cardHeight - 48,
    lineHeight: 15,
    font: fonts.bold,
    size: 12,
    color: COLORS.text,
  });

  cursor -= 12;

  page.drawText("ANSWER", {
    x: leftX,
    y: cursor,
    size: 7.5,
    font: fonts.bold,
    color: COLORS.muted,
  });

  page.drawText("STATUS", {
    x: leftX + 85,
    y: cursor,
    size: 7.5,
    font: fonts.bold,
    color: COLORS.muted,
  });

  const answerPillY = cursor - 20;

  page.drawRectangle({
    x: leftX,
    y: answerPillY,
    width: 56,
    height: 18,
    color: issue ? COLORS.redSoft : COLORS.greenSoft,
  });

  page.drawText(answerText(question, answer), {
    x: leftX + 8,
    y: answerPillY + 5,
    size: 8,
    font: fonts.bold,
    color: issue ? COLORS.red : COLORS.green,
  });

  page.drawRectangle({
    x: leftX + 85,
    y: answerPillY,
    width: issue ? 104 : 44,
    height: 18,
    color: issue ? COLORS.redSoft : COLORS.greenSoft,
  });

  page.drawText(issue ? "ISSUE / OUT OF STANDARD" : "OK", {
    x: leftX + 92,
    y: answerPillY + 5,
    size: issue ? 7.2 : 8,
    font: fonts.bold,
    color: issue ? COLORS.red : COLORS.green,
  });

  let infoY = answerPillY - 18;

  if (question.question_type === "temperature") {
    page.drawText(`STANDARD: ${standardText(question)}`, {
      x: leftX,
      y: infoY,
      size: 8,
      font: fonts.normal,
      color: COLORS.muted,
    });

    infoY -= 14;
  }

  if (issue) {
    let issueBoxY = y + 18;
    const noteLines =
      answer?.notes
        ? wrapText(answer.notes, fonts.normal, 8.5, leftWidth - 20).slice(0, 4)
        : [];

    const actionLines =
      answer?.correctiveAction
        ? wrapText(answer.correctiveAction, fonts.normal, 8.5, leftWidth - 20).slice(0, 4)
        : [];

    let issueBoxHeight = 18;

    if (noteLines.length) {
      issueBoxHeight += 16 + noteLines.length * 11;
    }

    if (actionLines.length) {
      issueBoxHeight += 16 + actionLines.length * 11;
    }

    if (!noteLines.length && !actionLines.length) {
      issueBoxHeight += 24;
    }

    page.drawRectangle({
      x: leftX,
      y: issueBoxY,
      width: leftWidth + 8,
      height: issueBoxHeight,
      color: COLORS.redSoft,
      borderColor: rgb(0.93, 0.78, 0.76),
      borderWidth: 1,
    });

    let iy = issueBoxY + issueBoxHeight - 14;

    if (noteLines.length) {
      page.drawText("NOTES", {
        x: leftX + 10,
        y: iy,
        size: 7.5,
        font: fonts.bold,
        color: COLORS.red,
      });

      iy -= 12;

      iy = drawTextLines(page, noteLines, {
        x: leftX + 10,
        y: iy,
        lineHeight: 11,
        font: fonts.normal,
        size: 8.5,
        color: COLORS.text,
      });

      iy -= 8;
    }

    if (actionLines.length) {
      page.drawText("CORRECTIVE ACTION", {
        x: leftX + 10,
        y: iy,
        size: 7.5,
        font: fonts.bold,
        color: COLORS.red,
      });

      iy -= 12;

      drawTextLines(page, actionLines, {
        x: leftX + 10,
        y: iy,
        lineHeight: 11,
        font: fonts.normal,
        size: 8.5,
        color: COLORS.text,
      });
    }

    if (!noteLines.length && !actionLines.length) {
      page.drawText("Follow-up required.", {
        x: leftX + 10,
        y: issueBoxY + 10,
        size: 8.5,
        font: fonts.normal,
        color: COLORS.text,
      });
    }
  } else {
    page.drawText("No notes recorded", {
      x: leftX,
      y: y + 14,
      size: 8.5,
      font: fonts.normal,
      color: COLORS.muted,
    });
  }

  page.drawRectangle({
    x: photoX,
    y: photoY,
    width: photoW,
    height: photoH,
    color: rgb(0.995, 0.995, 0.995),
    borderColor: COLORS.line,
    borderWidth: 1,
  });

  page.drawText("PHOTO EVIDENCE", {
    x: photoX + 10,
    y: photoY + photoH - 16,
    size: 7.5,
    font: fonts.bold,
    color: COLORS.muted,
  });

  const innerX = photoX + 10;
  const innerY = photoY + 10;
  const innerW = photoW - 20;
  const innerH = photoH - 32;

  page.drawRectangle({
    x: innerX,
    y: innerY,
    width: innerW,
    height: innerH,
    color: rgb(1, 1, 1),
    borderColor: COLORS.line,
    borderWidth: 1,
  });

  if (answer?.photo) {
    const jpegBytes = await imageFileToJpeg(answer.photo);
    const image = await pdf.embedJpg(jpegBytes);

    const fit = fitContain(image.width, image.height, innerW - 8, innerH - 8);

    page.drawImage(image, {
      x: innerX + (innerW - fit.width) / 2,
      y: innerY + (innerH - fit.height) / 2,
      width: fit.width,
      height: fit.height,
    });
  } else {
    page.drawText("No photo attached", {
      x: innerX + 34,
      y: innerY + innerH / 2 - 5,
      size: 8.5,
      font: fonts.normal,
      color: COLORS.muted,
    });
  }

  return cardHeight;
}

export async function buildClosingPdf({
  reportNumber,
  outletName,
  submittedBy,
  groups,
  questions,
  answers,
}: {
  reportNumber: string;
  outletName: string;
  submittedBy: string;
  groups: Group[];
  questions: Question[];
  answers: Record<string, Answer>;
}) {
  const pdf = await PDFDocument.create();

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const fonts = { normal, bold };

  const [cqLogo, ddLogo] = await Promise.all([
    loadBrandImage(pdf, BRAND.cq),
    loadBrandImage(pdf, BRAND.dd),
  ]);

  const logos = {
    cq: cqLogo,
    dd: ddLogo,
  };

  const orderedQuestions = createOrderedQuestions(groups, questions);
  const reportDate = formatDateID(new Date());

  await drawCoverPage(pdf, fonts, logos, {
    reportNumber,
    outletName,
    submittedBy,
    groups,
    questions: orderedQuestions,
    answers,
  });

  let page = createDetailPage(pdf, fonts, logos, {
    reportNumber,
    outletName,
    reportDate,
  });

  let cursorY = PAGE.height - 122;

  for (let i = 0; i < orderedQuestions.length; i++) {
    const question = orderedQuestions[i];
    const answer = answers[question.id];
    const groupName = groupNameForQuestion(groups, question);
    const cardHeight = cardHeightForQuestion(question, answer, fonts);
    const gap = 14;

    if (cursorY - cardHeight < PAGE.bottom + 20) {
      page = createDetailPage(pdf, fonts, logos, {
        reportNumber,
        outletName,
        reportDate,
      });

      cursorY = PAGE.height - 122;
    }

    await drawQuestionCard(page, pdf, fonts, {
      x: PAGE.marginX,
      yTop: cursorY,
      width: PAGE.width - PAGE.marginX * 2,
      questionNumber: i + 1,
      groupName,
      question,
      answer,
    });

    cursorY -= cardHeight + gap;
  }

  const totalPages = pdf.getPageCount();
  const pages = pdf.getPages();

  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: PAGE.marginX, y: 22 },
      end: { x: PAGE.width - PAGE.marginX, y: 22 },
      thickness: 1,
      color: COLORS.line,
    });

    page.drawText(reportNumber, {
      x: PAGE.marginX,
      y: 10,
      size: 7,
      font: normal,
      color: COLORS.muted,
    });

    page.drawText(`Page ${index + 1} of ${totalPages}`, {
      x: PAGE.width - PAGE.marginX - 52,
      y: 10,
      size: 7,
      font: normal,
      color: COLORS.muted,
    });
  });

  return await pdf.save({
    useObjectStreams: true,
  });
}
