export type OperationConfig = {
  formCode: string;
  permissionCode: string;
  reportPrefix: string;
  displayName: string;

  /**
   * Section-scoped operations use has_section_permission()
   * instead of the legacy global app permission as the
   * authoritative fill / submit gate.
   *
   * Existing OPENING / CLOSING remain false/undefined.
   */
  sectionScoped?: boolean;

  /**
   * Split Restaurant Outlet operations use form-level access
   * from user_form_permissions.
   *
   * Legacy OPENING / CLOSING stay on app permissions.
   * Central Kitchen stays sectionScoped.
   */
  formScoped?: boolean;
};

const OPERATION_CONFIGS: Record<
  string,
  OperationConfig
> = {
  CLOSING: {
    formCode: "CLOSING",
    permissionCode: "closing.submit",
    reportPrefix: "CLS",
    displayName: "Closing Outlet",
  },

  OPENING: {
    formCode: "OPENING",
    permissionCode: "opening.submit",
    reportPrefix: "OPN",
    displayName: "Opening Outlet",
  },

  /**
   * Split Restaurant Outlet operations.
   *
   * permissionCode is compatibility metadata only.
   * Runtime fill / submit authority is form-scoped.
   */
  OPENING_FOH: {
    formCode: "OPENING_FOH",
    permissionCode: "opening.submit",
    reportPrefix: "OPNFOH",
    displayName: "Opening FOH",
    formScoped: true,
  },

  OPENING_BOH: {
    formCode: "OPENING_BOH",
    permissionCode: "opening.submit",
    reportPrefix: "OPNBOH",
    displayName: "Opening BOH",
    formScoped: true,
  },

  CLOSING_FOH: {
    formCode: "CLOSING_FOH",
    permissionCode: "closing.submit",
    reportPrefix: "CLSFOH",
    displayName: "Closing FOH",
    formScoped: true,
  },

  CLOSING_BOH: {
    formCode: "CLOSING_BOH",
    permissionCode: "closing.submit",
    reportPrefix: "CLSBOH",
    displayName: "Closing BOH",
    formScoped: true,
  },

  /**
   * Central Kitchen operations are multi-user and multi-section.
   * permissionCode is retained for metadata / legacy compatibility,
   * while runtime authorization is section-driven.
   */
  CLOSING_CK: {
    formCode: "CLOSING_CK",
    permissionCode: "closing.submit",
    reportPrefix: "CLSCK",
    displayName: "Central Kitchen Closing",
    sectionScoped: true,
  },

  OPENING_CK: {
    formCode: "OPENING_CK",
    permissionCode: "opening.submit",
    reportPrefix: "OPNCK",
    displayName: "Central Kitchen Opening",
    sectionScoped: true,
  },
};

export function normalizeOperationCode(
  value: string
) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function getOperationConfig(
  formCode: string
): OperationConfig | null {
  const normalized =
    normalizeOperationCode(formCode);

  return (
    OPERATION_CONFIGS[normalized] ??
    null
  );
}
