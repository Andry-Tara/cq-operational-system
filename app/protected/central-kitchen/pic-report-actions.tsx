"use client";

import {
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";


type PicReportActionsProps = {
  formCode: string;
  reportId: string;
  reportNumber: string;
  pdfStoragePath: string;
  picName: string;
  reportArea: string;
};


export default function PicReportActions({
  formCode,
  reportId,
  reportNumber,
  pdfStoragePath,
  picName,
  reportArea,
}: PicReportActionsProps) {

  const supabase =
    createClient();

  const [
    busy,
    setBusy,
  ] =
    useState<
      "share" |
      "download" |
      "copy" |
      null
    >(null);


  async function loadPicReport() {

    const response =
      await fetch(
        `/api/operations/${formCode}/pic-report?reportId=${encodeURIComponent(
          reportId
        )}`,
        {
          cache:
            "no-store",
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data?.readyForPdf
    ) {
      throw new Error(
        data?.error ||
          "PIC report belum tersedia."
      );
    }

    return data;

  }


  function makeSafePicName(
    value: string
  ) {

    return String(
      value || "PIC"
    )
      .normalize(
        "NFKD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-zA-Z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .toUpperCase() ||
      "PIC";

  }


  function buildSummaryText(
    data: any
  ) {

    const sections:
      any[] =
      Array.isArray(
        data.sections
      )
        ? data.sections
        : [];

    let totalQuestions =
      0;

    let totalAnswers =
      0;

    let totalPhotos =
      0;

    let totalIssues =
      0;

    const sectionLines:
      string[] = [];

    for (
      const section of
      sections
    ) {

      const sectionName =
        section.displayName ||
        section.name ||
        section.code ||
        "Section";

      const questions:
        any[] =
        Array.isArray(
          section.questions
        )
          ? section.questions
          : [];

      const answers:
        any[] =
        Array.isArray(
          section.answers
        )
          ? section.answers
          : [];

      const questionCount =
        questions.length;

      const answerCount =
        answers.length;

      const photoCount =
        answers.filter(
          (
            answer: any
          ) =>
            Boolean(
              answer.existingPhoto
                ?.storagePath
            )
        ).length;

      const issueCount =
        answers.filter(
          (
            answer: any
          ) =>
            answer.isCompliant ===
            false
        ).length;

      totalQuestions +=
        questionCount;

      totalAnswers +=
        answerCount;

      totalPhotos +=
        photoCount;

      totalIssues +=
        issueCount;

      sectionLines.push(
        `- ${sectionName}: ${answerCount}/${questionCount} | Photos: ${photoCount} | Issues: ${issueCount}`
      );

    }


    const submittedDates =
      sections
        .map(
          (
            section: any
          ) =>
            section.submittedAt
        )
        .filter(
          Boolean
        )
        .map(
          (
            value: string
          ) =>
            new Date(
              value
            )
        )
        .filter(
          (
            value: Date
          ) =>
            !Number.isNaN(
              value.getTime()
            )
        );

    const submittedDate =
      submittedDates.length
        ? new Date(
            Math.max(
              ...submittedDates.map(
                (
                  value: Date
                ) =>
                  value.getTime()
              )
            )
          )
        : new Date();


    const timezone =
      data.outlet
        ?.timezone ||
      "Asia/Jakarta";

    const date =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          dateStyle:
            "long",
          timeZone:
            timezone,
        }
      ).format(
        submittedDate
      );

    const time =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          hour:
            "2-digit",
          minute:
            "2-digit",
          timeZone:
            timezone,
        }
      ).format(
        submittedDate
      );


    const resolvedPicName =
      data.pic?.name ||
      picName ||
      "PIC";

    const assignedCount =
      Number(
        data.picAssignedCount
      ) ||
      sections.length;

    const completedCount =
      Number(
        data.picCompletedCount
      ) ||
      sections.length;

    const operationTitle =
      String(
        data.operation
          ?.displayName ||
        (
          formCode.startsWith(
            "CLOSING"
          )
            ? "Central Kitchen Closing"
            : "Central Kitchen Opening"
        )
      ).toUpperCase();

    const parentReportNumber =
      String(
        data.report
          ?.reportNumber ||
        reportNumber
      );

    const picReportNumber =
      `${parentReportNumber}-${makeSafePicName(
        resolvedPicName
      )}`;


    const lines:
      string[] = [
        `*${operationTitle}*`,
        "*CHONG QING HOT POT*",
        "",
        `📍 Outlet: ${data.outlet?.name || "CQ Central"}`,
        `👤 PIC: ${resolvedPicName}`,
        `🏭 Area: ${reportArea}`,
        `📅 Date: ${date}`,
        `⏰ Submitted: ${time} WIB`,
        `🏷 Sections Completed: ${completedCount}/${assignedCount}`,
        "",
        "*OVERALL SUMMARY*",
        `- Total Checklist: ${totalAnswers}/${totalQuestions}`,
        `- Photo Evidence: ${totalPhotos}`,
        `- Issues: ${totalIssues}`,
        "- Status: Completed",
        "",
        "*SECTION SUMMARY*",
        ...sectionLines,
        "",
        "*REPORT INFO*",
        `- Report ID: ${picReportNumber}`,
        `- PIC: ${resolvedPicName}`,
        `- Sections: ${completedCount}/${assignedCount}`,
        "",
        `✅ *${operationTitle} COMPLETED*`,
      ];

    return lines.join(
      "\n"
    );

  }


  async function getPdfFile() {

    const {
      data,
      error,
    } =
      await supabase.storage
        .from(
          "operational-reports"
        )
        .download(
          pdfStoragePath
        );

    if (
      error ||
      !data
    ) {
      throw new Error(
        error?.message ||
          "Unable to download PDF."
      );
    }

    const storedFilename =
      pdfStoragePath
        .split("/")
        .pop() ||
      `${reportNumber}-${makeSafePicName(
        picName
      )}.pdf`;

    return new File(
      [
        data,
      ],
      storedFilename,
      {
        type:
          "application/pdf",
      }
    );

  }


  function downloadFile(
    file: File
  ) {

    const url =
      URL.createObjectURL(
        file
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    anchor.download =
      file.name;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1000
    );

  }


  async function copySummary() {

    try {

      setBusy(
        "copy"
      );

      const data =
        await loadPicReport();

      const text =
        buildSummaryText(
          data
        );

      await navigator.clipboard
        .writeText(
          text
        );

      alert(
        "PIC summary copied."
      );

    } catch (
      error: any
    ) {

      console.error(
        "Unable to copy PIC summary:",
        error
      );

      alert(
        error?.message ||
          "Unable to copy PIC summary."
      );

    } finally {

      setBusy(
        null
      );

    }

  }


  async function downloadPdf() {

    try {

      setBusy(
        "download"
      );

      const file =
        await getPdfFile();

      downloadFile(
        file
      );

    } catch (
      error: any
    ) {

      console.error(
        "Unable to download PIC PDF:",
        error
      );

      alert(
        error?.message ||
          "Unable to download PDF."
      );

    } finally {

      setBusy(
        null
      );

    }

  }


  async function shareReport() {

    try {

      setBusy(
        "share"
      );

      const [
        file,
        data,
      ] =
        await Promise.all([
          getPdfFile(),
          loadPicReport(),
        ]);

      const reportText =
        buildSummaryText(
          data
        );

      const shareTitle =
        `${data.operation?.displayName || "Central Kitchen"} - ${picName}`;

      const canShareFiles =
        typeof navigator.canShare ===
        "function"
          ? navigator.canShare({
              files: [
                file,
              ],
            })
          : true;


      if (
        navigator.share &&
        canShareFiles
      ) {

        try {

          await navigator.share({
            title:
              shareTitle,
            text:
              reportText,
            files: [
              file,
            ],
          });

          return;

        } catch (
          error: any
        ) {

          if (
            error?.name ===
            "AbortError"
          ) {
            return;
          }

          console.warn(
            "Native PIC report share failed:",
            error
          );

        }

      }


      // Desktop / unsupported native share fallback:
      // download PDF, copy summary, then open WhatsApp Web.

      downloadFile(
        file
      );

      try {

        await navigator.clipboard
          .writeText(
            reportText
          );

      } catch (
        clipboardError
      ) {

        console.warn(
          "Unable to copy PIC summary:",
          clipboardError
        );

      }

      // Encode WhatsApp text more strictly for desktop.
      //
      // encodeURIComponent intentionally leaves "*" unescaped.
      // WhatsApp's wa.me redirect can alter markdown characters
      // and Unicode while forwarding the pre-filled message.
      //
      // Use WhatsApp Web directly and force markdown characters
      // into percent-encoded form.

      // WhatsApp Web pre-filled messages may escape
      // "*" markdown characters. Keep the clipboard summary
      // formatted, but send a clean plain-text version to
      // WhatsApp Web.

      const whatsappReportText =
        reportText
          .replace(
            /\*/g,
            ""
          )
          .replace(
            /^OVERALL SUMMARY$/gm,
            "𝗢𝗩𝗘𝗥𝗔𝗟𝗟 𝗦𝗨𝗠𝗠𝗔𝗥𝗬"
          )
          .replace(
            /^SECTION SUMMARY$/gm,
            "𝗦𝗘𝗖𝗧𝗜𝗢𝗡 𝗦𝗨𝗠𝗠𝗔𝗥𝗬"
          )
          .replace(
            /^REPORT INFO$/gm,
            "𝗥𝗘𝗣𝗢𝗥𝗧 𝗜𝗡𝗙𝗢"
          );

      const whatsappText =
        encodeURIComponent(
          whatsappReportText
        );

      window.open(
        `https://web.whatsapp.com/send?text=${whatsappText}`,
        "_blank",
        "noopener,noreferrer"
      );

    } catch (
      error: any
    ) {

      console.error(
        "Unable to share PIC report:",
        error
      );

      alert(
        error?.message ||
          "Unable to share PIC report."
      );

    } finally {

      setBusy(
        null
      );

    }

  }


  const disabled =
    busy !== null;


  return (

    <div className="grid gap-2 sm:grid-cols-3">

      <button
        type="button"
        onClick={
          shareReport
        }
        disabled={
          disabled
        }
        className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ===
        "share"
          ? "Preparing..."
          : "📤 Share Report"}
      </button>

      <button
        type="button"
        onClick={
          downloadPdf
        }
        disabled={
          disabled
        }
        className="rounded-xl bg-red-700 px-4 py-3 text-xs font-black text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ===
        "download"
          ? "Downloading..."
          : "⬇ Download PDF"}
      </button>

      <button
        type="button"
        onClick={
          copySummary
        }
        disabled={
          disabled
        }
        className="rounded-xl bg-neutral-900 px-4 py-3 text-xs font-black text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ===
        "copy"
          ? "Copying..."
          : "📋 Copy Summary"}
      </button>

    </div>

  );

}
