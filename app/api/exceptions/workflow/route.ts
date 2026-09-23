import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";


const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


const ACTIONS =
  new Set([
    "assign",
    "schedule",
    "start",
    "escalate",
    "resolve",
    "verify",
    "close",
  ]);


const PIC_ACTIONS =
  new Set([
    "start",
    "escalate",
    "resolve",
  ]);


type ParsedEvidencePhoto = {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  extension: string;
};

type EvidenceParseResult =
  | {
      ok: true;
      photo: ParsedEvidencePhoto;
    }
  | {
      ok: false;
      error: string;
    };

const MAX_EVIDENCE_PHOTO_BYTES =
  6 * 1024 * 1024;

const ALLOWED_EVIDENCE_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

function cleanText(
  value: unknown
) {
  return String(
    value ??
    ""
  ).trim();
}

function evidenceExtension(
  mimeType: string,
  fileName: string
) {
  const lowerName =
    fileName.toLowerCase();

  if (
    lowerName.endsWith(
      ".png"
    )
  ) {
    return "png";
  }

  if (
    lowerName.endsWith(
      ".webp"
    )
  ) {
    return "webp";
  }

  if (
    lowerName.endsWith(
      ".heic"
    )
  ) {
    return "heic";
  }

  if (
    lowerName.endsWith(
      ".heif"
    )
  ) {
    return "heif";
  }

  if (
    mimeType ===
    "image/png"
  ) {
    return "png";
  }

  if (
    mimeType ===
    "image/webp"
  ) {
    return "webp";
  }

  if (
    mimeType ===
    "image/heic"
  ) {
    return "heic";
  }

  if (
    mimeType ===
    "image/heif"
  ) {
    return "heif";
  }

  return "jpg";
}

function parseEvidencePhoto(
  value: unknown
): EvidenceParseResult {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {
      ok: false,
      error:
        "Completion photo is required.",
    };
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  const dataUrl =
    cleanText(
      record.dataUrl
    );

  const originalFilename =
    cleanText(
      record.name
    ).slice(
      0,
      240
    ) ||
    "completion-photo.jpg";

  const match =
    dataUrl.match(
      /^data:([^;]+);base64,([\s\S]+)$/
    );

  if (!match) {
    return {
      ok: false,
      error:
        "Invalid completion photo.",
    };
  }

  const mimeType =
    cleanText(
      record.type
    ) ||
    match[1];

  if (
    !ALLOWED_EVIDENCE_MIME_TYPES.has(
      mimeType
    )
  ) {
    return {
      ok: false,
      error:
        "Completion photo must be JPG, PNG, WEBP, HEIC, or HEIF.",
    };
  }

  const buffer =
    Buffer.from(
      match[2],
      "base64"
    );

  if (
    buffer.length <=
    0
  ) {
    return {
      ok: false,
      error:
        "Completion photo is empty.",
    };
  }

  if (
    buffer.length >
    MAX_EVIDENCE_PHOTO_BYTES
  ) {
    return {
      ok: false,
      error:
        "Completion photo is too large. Maximum size is 6 MB.",
    };
  }

  return {
    ok: true,
    photo: {
      originalFilename,
      mimeType,
      fileSize:
        buffer.length,
      buffer,
      extension:
        evidenceExtension(
          mimeType,
          originalFilename
        ),
    },
  };
}


function normalizeSource(
  value: unknown
) {
  const source =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (
    source ===
      "operations" ||
    source ===
      "operations_issue"
  ) {
    return "operations_issue";
  }

  if (
    source ===
      "audit" ||
    source ===
      "audit_finding"
  ) {
    return "audit_finding";
  }

  return null;
}


export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();


    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();


    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }


    const authAdmin =
      createAdminClient();


    const {
      data:
        profile,
      error:
        profileError,
    } =
      await authAdmin
        .from(
          "profiles"
        )
        .select(`
          id,
          organization_id,
          is_active
        `)
        .eq(
          "id",
          user.id
        )
        .maybeSingle();


    if (
      profileError
    ) {
      throw profileError;
    }


    if (
      !profile ||
      !profile.organization_id ||
      profile.is_active === false
    ) {
      return NextResponse.json(
        {
          error:
            "Access denied.",
        },
        {
          status: 403,
        }
      );
    }


    const managementAccess =
      await checkPermissionApi(
        "exceptions.manage"
      );


    const canManage =
      managementAccess.ok;


    const organizationId =
      String(
        profile.organization_id
      );


    const actorUserId =
      user.id;


    const body =
      await request
        .json()
        .catch(
          () => null
        );


    if (
      !body ||
      typeof body !==
        "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid workflow request.",
        },
        {
          status: 400,
        }
      );
    }


    const sourceType =
      normalizeSource(
        body.sourceType
      );


    const sourceId =
      typeof body.sourceId ===
        "string"
        ? body.sourceId
        : "";


    const action =
      typeof body.action ===
        "string"
        ? body.action
            .trim()
            .toLowerCase()
        : "";


    if (
      !sourceType ||
      !UUID.test(
        sourceId
      ) ||
      !ACTIONS.has(
        action
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid exception workflow request.",
        },
        {
          status: 400,
        }
      );
    }


    let assignedTo:
      string | null =
      null;


    if (
      body.assignedTo !==
        undefined &&
      body.assignedTo !==
        null &&
      body.assignedTo !==
        ""
    ) {
      if (
        typeof body.assignedTo !==
          "string" ||
        !UUID.test(
          body.assignedTo
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid PIC.",
          },
          {
            status: 400,
          }
        );
      }

      assignedTo =
        body.assignedTo;
    }


    let dueAt:
      string | null =
      null;


    if (
      body.dueAt !==
        undefined &&
      body.dueAt !==
        null &&
      body.dueAt !==
        ""
    ) {
      if (
        typeof body.dueAt !==
        "string"
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid due date.",
          },
          {
            status: 400,
          }
        );
      }


      const parsed =
        new Date(
          body.dueAt
        );


      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid due date.",
          },
          {
            status: 400,
          }
        );
      }


      dueAt =
        parsed.toISOString();
    }


    let slaHours:
      number | null =
      null;


    if (
      body.slaHours !==
        undefined &&
      body.slaHours !==
        null &&
      body.slaHours !==
        ""
    ) {
      const parsed =
        Number(
          body.slaHours
        );


      if (
        !Number.isInteger(
          parsed
        ) ||
        parsed < 1 ||
        parsed > 8760
      ) {
        return NextResponse.json(
          {
            error:
              "SLA hours must be between 1 and 8760.",
          },
          {
            status: 400,
          }
        );
      }


      slaHours =
        parsed;
    }


    const note =
      typeof body.note ===
        "string"
        ? body.note
            .trim()
            .slice(
              0,
              4000
            )
        : null;


    let evidencePhoto:
      ParsedEvidencePhoto |
      null =
      null;

    if (
      action ===
      "resolve"
    ) {
      const parsedEvidencePhoto =
        parseEvidencePhoto(
          body.evidencePhoto
        );

      if (
        !parsedEvidencePhoto.ok
      ) {
        return NextResponse.json(
          {
            error:
              parsedEvidencePhoto.error,
          },
          {
            status: 400,
          }
        );
      }

      evidencePhoto =
        parsedEvidencePhoto.photo;
    }


    const admin =
      createAdminClient();


    if (!canManage) {
      if (
        !PIC_ACTIONS.has(
          action
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Only Management can perform this action.",
          },
          {
            status: 403,
          }
        );
      }


      const {
        data:
          assignedWorkflow,
        error:
          assignedWorkflowError,
      } =
        await admin
          .from(
            "exception_workflows"
          )
          .select(`
            id,
            outlet_id,
            assigned_to,
            status
          `)
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "source_type",
            sourceType
          )
          .eq(
            "source_id",
            sourceId
          )
          .eq(
            "assigned_to",
            actorUserId
          )
          .maybeSingle();


      if (
        assignedWorkflowError
      ) {
        throw assignedWorkflowError;
      }


      if (
        !assignedWorkflow
      ) {
        return NextResponse.json(
          {
            error:
              "This exception is not assigned to you.",
          },
          {
            status: 403,
          }
        );
      }


      const {
        data:
          outletAccess,
        error:
          outletAccessError,
      } =
        await admin
          .from(
            "user_outlets"
          )
          .select(
            "outlet_id"
          )
          .eq(
            "user_id",
            actorUserId
          )
          .eq(
            "outlet_id",
            assignedWorkflow.outlet_id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();


      if (
        outletAccessError
      ) {
        throw outletAccessError;
      }


      if (
        !outletAccess
      ) {
        return NextResponse.json(
          {
            error:
              "Your outlet access is no longer active.",
          },
          {
            status: 403,
          }
        );
      }
    }


    let uploadedEvidence:
      | {
          storageBucket: string;
          storagePath: string;
          originalFilename: string;
          mimeType: string;
          fileSize: number;
        }
      | null =
      null;

    if (
      evidencePhoto
    ) {
      const storageBucket =
        "operational-photos";

      const storagePath =
        [
          "exceptions",
          organizationId,
          sourceType,
          sourceId,
          `${randomUUID()}.${evidencePhoto.extension}`,
        ].join(
          "/"
        );

      const {
        error:
          uploadError,
      } =
        await admin
          .storage
          .from(
            storageBucket
          )
          .upload(
            storagePath,
            evidencePhoto.buffer,
            {
              contentType:
                evidencePhoto.mimeType,
              upsert:
                false,
            }
          );

      if (
        uploadError
      ) {
        throw uploadError;
      }

      uploadedEvidence = {
        storageBucket,
        storagePath,
        originalFilename:
          evidencePhoto.originalFilename,
        mimeType:
          evidencePhoto.mimeType,
        fileSize:
          evidencePhoto.fileSize,
      };
    }


    const {
      data,
      error,
    } =
      await admin.rpc(
        "mutate_exception_workflow",
        {
          p_organization_id:
            organizationId,

          p_source_type:
            sourceType,

          p_source_id:
            sourceId,

          p_action:
            action,

          p_actor_user_id:
            actorUserId,

          p_assigned_to:
            assignedTo,

          p_due_at:
            dueAt,

          p_sla_hours:
            slaHours,

          p_note:
            note,
        }
      );


    if (error) {

      if (
        uploadedEvidence
      ) {
        await admin
          .storage
          .from(
            uploadedEvidence.storageBucket
          )
          .remove([
            uploadedEvidence.storagePath,
          ]);
      }

      throw error;

    }


    if (
      uploadedEvidence
    ) {
      const workflowId =
        cleanText(
          (data as any)?.id
        );

      if (
        !UUID.test(
          workflowId
        )
      ) {
        await admin
          .storage
          .from(
            uploadedEvidence.storageBucket
          )
          .remove([
            uploadedEvidence.storagePath,
          ]);

        throw new Error(
          "Unable to attach completion evidence."
        );
      }

      const {
        error:
          evidenceInsertError,
      } =
        await admin
          .from(
            "exception_workflow_evidence"
          )
          .insert({
            workflow_id:
              workflowId,
            organization_id:
              organizationId,
            source_type:
              sourceType,
            source_id:
              sourceId,
            evidence_type:
              "resolution_photo",
            storage_bucket:
              uploadedEvidence.storageBucket,
            storage_path:
              uploadedEvidence.storagePath,
            original_filename:
              uploadedEvidence.originalFilename,
            mime_type:
              uploadedEvidence.mimeType,
            file_size:
              uploadedEvidence.fileSize,
            note,
            uploaded_by:
              actorUserId,
          });

      if (
        evidenceInsertError
      ) {
        await admin
          .storage
          .from(
            uploadedEvidence.storageBucket
          )
          .remove([
            uploadedEvidence.storagePath,
          ]);

        throw evidenceInsertError;
      }
    }


    return NextResponse.json(
      {
        workflow:
          data,
      }
    );

  } catch (
    error: any
  ) {
    console.error(
      "Exception workflow error:",
      error
    );


    const message =
      error?.message ||
      "Unable to update exception workflow.";


    const lower =
      message.toLowerCase();


    const status =
      lower.includes(
        "not found"
      )
        ? 404
        : lower.includes(
              "another organization"
            ) ||
            lower.includes(
              "permission"
            )
          ? 403
          : lower.includes(
                "cannot"
              ) ||
              lower.includes(
                "required"
              ) ||
              lower.includes(
                "must"
              )
            ? 409
            : 500;


    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status,
      }
    );
  }
}
