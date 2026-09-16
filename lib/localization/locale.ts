export const SUPPORTED_LOCALES = [
  "en",
  "id-ID",
] as const;

export type AppLocale =
  (typeof SUPPORTED_LOCALES)[number];

export type OperationCopy = {
  yes: string;
  no: string;
  notes: string;
  correctiveAction: string;
  actionRequired: string;
  photoEvidence: string;
  takePhoto: string;
  gallery: string;
  required: string;
  correctionRequired: string;
  adminRequestedCorrection: string;
  submit: string;
  submitting: string;
  resubmitCorrection: string;
  resubmittingCorrection: string;
  saved: string;
  saving: string;
  loading: string;
  sessionError: string;
  startingSession: string;
  checklist: string;
  answers: string;
  requiredPhotos: string;
  issues: string;
  standard: string;
  outOfStandard: string;
  withinStandard: string;
  photoOptimizing: string;
  photoUploading: string;
  photoUploadFailed: string;
  newPhoto: string;
  photoRequiredForQuestion: string;
  photoRequiredForIssue: string;
  photoRequiredOnlyForIssue: string;
  photoNotRequired: string;
  overallCompletion: string;
  draftSaved: string;
  loadingDraft: string;
  savingDraft: string;
  draftUnsaved: string;
  sessionNotReady: string;
  retrySession: string;
  missingAnswers: string;
  missingRequiredPhotoEvidence: string;
  incompleteIssueActions: string;
  opening: string;
  closing: string;
  complete: string;
};

export const OPERATION_COPY: Record<
  AppLocale,
  OperationCopy
> = {
  en: {
    yes: "YES",
    no: "NO",
    notes: "Notes",
    correctiveAction: "Corrective Action",
    actionRequired: "Action Required",
    photoEvidence: "Photo Evidence",
    takePhoto: "Take Photo",
    gallery: "Gallery / Device",
    required: "Required",
    correctionRequired: "Correction Required",
    adminRequestedCorrection: "Admin Requested Correction",
    submit: "Submit",
    submitting: "Submitting...",
    resubmitCorrection: "Resubmit Correction",
    resubmittingCorrection: "Resubmitting Correction...",
    saved: "Saved",
    saving: "Saving...",
    loading: "Loading...",
    sessionError: "Session Error",
    startingSession: "Starting operational session...",
    checklist: "Checklist",
    answers: "answers",
    requiredPhotos: "required photos",
    issues: "issues",
    standard: "Standard",
    outOfStandard: "OUT OF STANDARD",
    withinStandard: "WITHIN STANDARD",
    photoOptimizing: "Optimizing...",
    photoUploading: "Uploading...",
    photoUploadFailed: "Upload Failed",
    newPhoto: "New Photo",
    photoRequiredForQuestion: "Required for this question",
    photoRequiredForIssue: "Required because an issue was found",
    photoRequiredOnlyForIssue: "Required only if an issue is found",
    photoNotRequired: "Not required",
    overallCompletion: "Overall Completion",
    draftSaved: "Draft saved",
    loadingDraft: "Loading draft...",
    savingDraft: "Saving draft...",
    draftUnsaved: "Draft was not saved. Check your connection.",
    sessionNotReady: "Operational session is not ready.",
    retrySession: "Retry Session",
    missingAnswers: "answers are still incomplete.",
    missingRequiredPhotoEvidence: "required photo evidence still needs to be uploaded.",
    incompleteIssueActions: "issues are missing Notes & Corrective Action.",
    opening: "Opening",
    closing: "Closing",
    complete: "COMPLETE",
  },
  "id-ID": {
    yes: "YA",
    no: "TIDAK",
    notes: "Catatan",
    correctiveAction: "Tindakan Korektif",
    actionRequired: "Tindakan Diperlukan",
    photoEvidence: "Bukti Foto",
    takePhoto: "Ambil Foto",
    gallery: "Galeri / Perangkat",
    required: "Wajib",
    correctionRequired: "Wajib Diperbaiki",
    adminRequestedCorrection: "Koreksi dari Admin",
    submit: "Kirim",
    submitting: "Mengirim...",
    resubmitCorrection: "Kirim Ulang Koreksi",
    resubmittingCorrection: "Mengirim Ulang Koreksi...",
    saved: "Tersimpan",
    saving: "Menyimpan...",
    loading: "Memuat...",
    sessionError: "Kesalahan Sesi",
    startingSession: "Memulai sesi operasional...",
    checklist: "Daftar Periksa",
    answers: "jawaban",
    requiredPhotos: "foto wajib",
    issues: "masalah",
    standard: "Standar",
    outOfStandard: "DI LUAR STANDAR",
    withinStandard: "SESUAI STANDAR",
    photoOptimizing: "Mengoptimalkan...",
    photoUploading: "Mengunggah...",
    photoUploadFailed: "Gagal Mengunggah",
    newPhoto: "Foto Baru",
    photoRequiredForQuestion: "Wajib untuk pertanyaan ini",
    photoRequiredForIssue: "Wajib karena ditemukan masalah",
    photoRequiredOnlyForIssue: "Wajib hanya jika ditemukan masalah",
    photoNotRequired: "Tidak wajib",
    overallCompletion: "Penyelesaian Keseluruhan",
    draftSaved: "Draft tersimpan",
    loadingDraft: "Memuat draft...",
    savingDraft: "Menyimpan draft...",
    draftUnsaved: "Draft belum tersimpan. Periksa koneksi.",
    sessionNotReady: "Sesi operasional belum siap.",
    retrySession: "Coba Lagi",
    missingAnswers: "jawaban belum diisi.",
    missingRequiredPhotoEvidence: "bukti foto wajib belum diunggah.",
    incompleteIssueActions: "masalah belum memiliki Catatan & Tindakan Korektif.",
    opening: "Pembukaan",
    closing: "Penutupan",
    complete: "SELESAI",
  },
};

export function isSupportedLocale(
  value: unknown
): value is AppLocale {
  return (
    typeof value === "string" &&
    SUPPORTED_LOCALES.includes(
      value as AppLocale
    )
  );
}

export function resolveLocalizedText(
  canonicalText: string | null | undefined,
  translations: Partial<
    Record<AppLocale, string | null | undefined>
  > | null | undefined,
  locale: AppLocale
): string | null {
  const translatedText =
    translations?.[locale];

  if (
    typeof translatedText === "string" &&
    translatedText.trim() !== ""
  ) {
    return translatedText;
  }

  return canonicalText ?? null;
}

export function resolveOperationLocale({
  reportLocaleSnapshot,
  outletDefaultLocale,
  hasExistingReport,
}: {
  reportLocaleSnapshot: unknown;
  outletDefaultLocale: unknown;
  hasExistingReport: boolean;
}): AppLocale {
  if (hasExistingReport) {
    return isSupportedLocale(
      reportLocaleSnapshot
    )
      ? reportLocaleSnapshot
      : "en";
  }

  return isSupportedLocale(
    outletDefaultLocale
  )
    ? outletDefaultLocale
    : "en";
}
