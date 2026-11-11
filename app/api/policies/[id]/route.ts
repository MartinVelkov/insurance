import { NextRequest } from "next/server";
import { z } from "zod";

import {
  authErrorResponse,
  requireAccessibleDocument,
  requireEmployee,
  employeeRecordFields,
} from "@/lib/auth-server";

import { db } from "@/lib/firebase/admin";
import { normalizePolicyNumber } from "@/lib/normalizers";
import { syncInstallmentToCalendar } from "@/lib/calendar-sync";

const patchSchema = z.object({
  policyNumber: z
    .string()
    .trim()
    .min(1, "Номерът на полицата е задължителен.")
    .max(200, "Номерът на полицата е твърде дълъг."),
});

/**
 * GET /api/policies/[id]
 *
 * Връща:
 * - полицата
 * - клиента
 * - автомобила
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const employee =
      await requireEmployee(request);

    const { id } = await params;

    const policy =
      await requireAccessibleDocument(
        "policies",
        id,
        employee,
      );

    const data = policy.data()!;

    const [client, vehicle] =
      await Promise.all([
        requireAccessibleDocument(
          "clients",
          data.clientId,
          employee,
        ),

        requireAccessibleDocument(
          "vehicles",
          data.vehicleId,
          employee,
        ),
      ]);

    return Response.json({
      policy: {
        id: policy.id,
        ...data,
      },

      client: {
        id: client.id,
        ...client.data(),
      },

      vehicle: {
        id: vehicle.id,
        ...vehicle.data(),
      },
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      Response.json(
        {
          error:
            "Грешка при зареждане на полицата.",
        },
        {
          status: 500,
        },
      )
    );
  }
}

/**
 * PATCH /api/policies/[id]
 *
 * В момента позволява редакция на:
 * - policyNumber
 *
 * При промяна:
 * - проверява дали номерът вече съществува
 * - обновява policyNumberNormalized
 * - записва audit log
 * - синхронизира Google Calendar събитията
 *   на всички вноски по полицата
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const employee =
      await requireEmployee(request);

    const { id } = await params;

    /*
     * Проверяваме дали служителят има
     * достъп до тази полица.
     */
    const policyDoc =
      await requireAccessibleDocument(
        "policies",
        id,
        employee,
      );

    const currentPolicy =
      policyDoc.data()!;

    /*
     * Валидираме входните данни.
     */
    const body = patchSchema.parse(
      await request.json(),
    );

    const policyNumber =
      body.policyNumber.trim();

    const normalizedPolicyNumber =
      normalizePolicyNumber(
        policyNumber,
      );

    /*
     * Проверка за дублиран номер.
     *
     * Важно:
     * query-то може да върне и текущата
     * полица, ако normalized стойността
     * не се е променила.
     *
     * Затова игнорираме текущия id.
     */
    const duplicateSnapshot =
      await db
        .collection("policies")
        .where(
          "locationId",
          "==",
          employee.locationId,
        )
        .where(
          "policyNumberNormalized",
          "==",
          normalizedPolicyNumber,
        )
        .limit(2)
        .get();

    const duplicate =
      duplicateSnapshot.docs.find(
        (doc) => doc.id !== id,
      );

    if (duplicate) {
      return Response.json(
        {
          error:
            "Вече съществува полица с този номер.",
        },
        {
          status: 409,
        },
      );
    }

    /*
     * Ако няма реална промяна,
     * няма нужда от update/sync.
     */
    if (
      currentPolicy.policyNumber ===
        policyNumber &&
      currentPolicy.policyNumberNormalized ===
        normalizedPolicyNumber
    ) {
      return Response.json({
        success: true,
        changed: false,

        policy: {
          id,
          policyNumber,
          policyNumberNormalized:
            normalizedPolicyNumber,
        },

        calendar: {
          synced: 0,
          failed: 0,
          skipped: 0,
        },
      });
    }

    const now =
      new Date().toISOString();

    /*
     * Обновяваме полицата.
     */
    await db
      .collection("policies")
      .doc(id)
      .update({
        policyNumber,

        policyNumberNormalized:
          normalizedPolicyNumber,

        updatedAt: now,
        updatedBy: employee.uid,
      });

    /*
     * Audit log.
     */
    const auditRef = db
      .collection("auditLogs")
      .doc();

    await auditRef.set({
      ...employeeRecordFields(employee),

      actorUid: employee.uid,
      actorEmail: employee.email,

      action:
        "Променен номер на полица",

      entityType: "policy",
      entityId: id,

      subjectClientId:
        currentPolicy.clientId,

      before: {
        policyNumber:
          currentPolicy.policyNumber ??
          "",
      },

      after: {
        policyNumber,
      },

      createdAt: now,
    });

    /*
     * Намираме всички вноски към тази
     * полица.
     *
     * Те съдържат googleEventId и
     * googleCalendarId и съществуващата
     * sync логика ще обнови същото
     * Calendar събитие.
     */
    const installmentsSnapshot =
      await db
        .collection("installments")
        .where(
          "policyId",
          "==",
          id,
        )
        .get();

    /*
     * Проверяваме дали потребителят има
     * активна Google Calendar връзка.
     *
     * Това следва същата логика като
     * POST /api/policies.
     */
    const [
      connectionSnap,
      employeeSnap,
    ] = await Promise.all([
      db
        .collection(
          "googleConnections",
        )
        .doc(employee.uid)
        .get(),

      db
        .collection("employees")
        .doc(employee.uid)
        .get(),
    ]);

    const connection =
      connectionSnap.data();

    const employeeData =
      employeeSnap.data();

    const canSync =
      connectionSnap.exists &&
      connection
        ?.reauthorizationRequired !==
        true &&
      Boolean(
        connection?.calendarId ??
          employeeData
            ?.calendarSettings
            ?.calendarId,
      );

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    if (canSync) {
      for (const installmentDoc of installmentsSnapshot.docs) {
        try {
          await syncInstallmentToCalendar(
            installmentDoc.id,
            employee,
          );

          synced++;
        } catch (error) {
          failed++;

          /*
           * Не прекъсваме промяната
           * на номера на полицата само
           * защото един Calendar event
           * не е успял да се синхронизира.
           */
          console.error(
            `Failed to sync installment ${installmentDoc.id} after policy number change:`,
            error,
          );
        }
      }
    } else {
      skipped =
        installmentsSnapshot.size;
    }

    return Response.json({
      success: true,
      changed: true,

      policy: {
        id,

        policyNumber,

        policyNumberNormalized:
          normalizedPolicyNumber,
      },

      calendar: {
        synced,
        failed,
        skipped,
      },
    });
  } catch (error) {
    const auth =
      authErrorResponse(error);

    if (auth) {
      return auth;
    }

    if (
      error instanceof z.ZodError
    ) {
      return Response.json(
        {
          error:
            "Невалиден номер на полицата.",

          details: error.issues,
        },
        {
          status: 400,
        },
      );
    }

    console.error(
      "Policy update error:",
      error,
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Грешка при редакция на полицата.",
      },
      {
        status: 500,
      },
    );
  }
}