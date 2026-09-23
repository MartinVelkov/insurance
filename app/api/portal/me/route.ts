import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

import {
  customerAuthErrorResponse,
  requireCustomer,
} from "@/lib/customer-auth";

import { db } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();

  const log = (
    step: string,
    data?: unknown,
  ) => {
    if (data !== undefined) {
      console.log(
        `[PORTAL:${requestId}] ${step}`,
        data,
      );
    } else {
      console.log(
        `[PORTAL:${requestId}] ${step}`,
      );
    }
  };

  const logError = (
    step: string,
    error: unknown,
  ) => {
    console.error(
      `[PORTAL:${requestId}] ${step}`,
      error,
    );

    if (error instanceof Error) {
      console.error(
        `[PORTAL:${requestId}] error message:`,
        error.message,
      );

      console.error(
        `[PORTAL:${requestId}] error stack:`,
        error.stack,
      );
    }

    if (
      typeof error === "object" &&
      error !== null
    ) {
      const firebaseError =
        error as {
          code?: unknown;
          details?: unknown;
        };

      if (firebaseError.code) {
        console.error(
          `[PORTAL:${requestId}] error code:`,
          firebaseError.code,
        );
      }

      if (firebaseError.details) {
        console.error(
          `[PORTAL:${requestId}] error details:`,
          firebaseError.details,
        );
      }
    }
  };

  try {
    log("1. GET /api/portal/me started");

    /*
     * ========================================
     * 1. AUTHENTICATION
     * ========================================
     */

    log("2. Calling requireCustomer()");

    let customer;

    try {
      customer =
        await requireCustomer(request);

      log(
        "3. Customer authenticated",
        {
          uid: customer.uid,
          clientId:
            customer.clientId,
          locationId:
            customer.locationId,

          // Не логваме token/password.
          // Email също не е необходим за debugging.
        },
      );
    } catch (error) {
      logError(
        "FAILED at requireCustomer()",
        error,
      );

      throw error;
    }

    /*
     * ========================================
     * 2. CLIENT
     * ========================================
     */

    log(
      "4. Loading client document",
      {
        collection: "clients",
        documentId:
          customer.clientId,
      },
    );

    let clientSnap;

    try {
      clientSnap =
        await db
          .collection("clients")
          .doc(customer.clientId)
          .get();

      log(
        "5. Client document loaded",
        {
          exists:
            clientSnap.exists,
          id:
            clientSnap.id,
        },
      );
    } catch (error) {
      logError(
        "FAILED loading client document",
        error,
      );

      throw error;
    }

    const client =
      clientSnap.data();

    if (!clientSnap.exists) {
      console.error(
        `[PORTAL:${requestId}] Client document does not exist`,
        {
          clientId:
            customer.clientId,
        },
      );

      throw new Error(
        "CUSTOMER_FORBIDDEN",
      );
    }

    log(
      "6. Checking client's location",
      {
        customerLocation:
          customer.locationId,
        clientLocation:
          client?.locationId,
        matches:
          client?.locationId ===
          customer.locationId,
      },
    );

    if (
      client?.locationId !==
      customer.locationId
    ) {
      console.error(
        `[PORTAL:${requestId}] LOCATION MISMATCH`,
        {
          clientId:
            customer.clientId,
          expectedLocation:
            customer.locationId,
          actualLocation:
            client?.locationId,
        },
      );

      throw new Error(
        "CUSTOMER_FORBIDDEN",
      );
    }

    /*
     * ========================================
     * 3. VEHICLES
     * ========================================
     */

    const loadVehicles =
      async () => {
        const queryStarted =
          Date.now();

        log(
          "7. Loading vehicles",
          {
            locationId:
              customer.locationId,
            clientId:
              customer.clientId,
          },
        );

        try {
          const snapshot =
            await db
              .collection(
                "vehicles",
              )
              .where(
                "locationId",
                "==",
                customer.locationId,
              )
              .where(
                "clientId",
                "==",
                customer.clientId,
              )
              .orderBy(
                "registrationNumber",
                "asc",
              )
              .get();

          log(
            "8. Vehicles loaded successfully",
            {
              count:
                snapshot.size,
              durationMs:
                Date.now() -
                queryStarted,
            },
          );

          return snapshot;
        } catch (error) {
          logError(
            "FAILED loading vehicles",
            error,
          );

          throw error;
        }
      };

    /*
     * ========================================
     * 4. POLICIES
     * ========================================
     */

    const loadPolicies =
      async () => {
        const queryStarted =
          Date.now();

        log(
          "9. Loading policies",
          {
            locationId:
              customer.locationId,
            clientId:
              customer.clientId,
          },
        );

        try {
          const snapshot =
            await db
              .collection(
                "policies",
              )
              .where(
                "locationId",
                "==",
                customer.locationId,
              )
              .where(
                "clientId",
                "==",
                customer.clientId,
              )
              .orderBy(
                "startDate",
                "desc",
              )
              .get();

          log(
            "10. Policies loaded successfully",
            {
              count:
                snapshot.size,
              durationMs:
                Date.now() -
                queryStarted,
            },
          );

          return snapshot;
        } catch (error) {
          logError(
            "FAILED loading policies",
            error,
          );

          throw error;
        }
      };

    /*
     * ========================================
     * 5. INSTALLMENTS
     * ========================================
     */

    const loadInstallments =
      async () => {
        const queryStarted =
          Date.now();

        log(
          "11. Loading installments",
          {
            locationId:
              customer.locationId,
            clientId:
              customer.clientId,
          },
        );

        try {
          const snapshot =
            await db
              .collection(
                "installments",
              )
              .where(
                "locationId",
                "==",
                customer.locationId,
              )
              .where(
                "clientId",
                "==",
                customer.clientId,
              )
              .orderBy(
                "dueDate",
                "asc",
              )
              .get();

          log(
            "12. Installments loaded successfully",
            {
              count:
                snapshot.size,
              durationMs:
                Date.now() -
                queryStarted,
            },
          );

          return snapshot;
        } catch (error) {
          logError(
            "FAILED loading installments",
            error,
          );

          throw error;
        }
      };

    /*
     * ========================================
     * 6. LOAD ALL DATA
     * ========================================
     */

    log(
      "13. Starting Firestore queries",
    );

    const [
      vehiclesSnap,
      policiesSnap,
      installmentsSnap,
    ] = await Promise.all([
      loadVehicles(),
      loadPolicies(),
      loadInstallments(),
    ]);

    log(
      "14. All Firestore queries completed",
      {
        vehicles:
          vehiclesSnap.size,
        policies:
          policiesSnap.size,
        installments:
          installmentsSnap.size,
      },
    );

    /*
     * ========================================
     * 7. MAP VEHICLES
     * ========================================
     */

    log(
      "15. Mapping vehicles",
    );

    const vehicles =
      vehiclesSnap.docs.map(
        (doc) => {
          const vehicle =
            doc.data();

          return {
            id: doc.id,

            registrationNumber:
              vehicle.registrationNumber,

            gtpStartDate:
              vehicle.gtpStartDate,

            gtpEndDate:
              vehicle.gtpEndDate,

            vignetteStartDate:
              vehicle.vignetteStartDate,

            vignetteEndDate:
              vehicle.vignetteEndDate,

            registrationCertificateNumber:
              vehicle.registrationCertificateNumber,
          };
        },
      );

    /*
     * ========================================
     * 8. MAP POLICIES
     * ========================================
     */

    log(
      "16. Mapping policies",
    );

    const policies =
      policiesSnap.docs.map(
        (doc) => {
          const policy =
            doc.data();

          return {
            id: doc.id,

            vehicleId:
              policy.vehicleId,

            policyNumber:
              policy.policyNumber,

            startDate:
              policy.startDate,

            endDate:
              policy.endDate,

            totalAmount:
              policy.totalAmount,

            currency:
              policy.currency,
          };
        },
      );

    /*
     * ========================================
     * 9. MAP INSTALLMENTS
     * ========================================
     */

    log(
      "17. Mapping installments",
    );

    const installments =
      installmentsSnap.docs.map(
        (doc) => {
          const installment =
            doc.data();

          return {
            id: doc.id,

            policyId:
              installment.policyId,

            sequence:
              installment.sequence,

            totalCount:
              installment.totalCount,

            dueDate:
              installment.dueDate,

            amount:
              installment.amount,

            currency:
              installment.currency,

            paymentStatus:
              installment.paymentStatus,

            paidAt:
              installment.paidAt ??
              null,
          };
        },
      );

    /*
     * ========================================
     * 10. RESPONSE
     * ========================================
     */

    const response = {
      client: {
        id:
          clientSnap.id,

        phone:
          typeof client?.phone ===
          "string"
            ? client.phone
            : "",

        email:
          typeof client?.email ===
          "string"
            ? client.email
            : customer.email,
      },

      vehicles,

      policies,

      installments,
    };

    log(
      "18. Portal data ready",
      {
        clientId:
          response.client.id,

        vehicles:
          response.vehicles
            .length,

        policies:
          response.policies
            .length,

        installments:
          response.installments
            .length,

        totalDurationMs:
          Date.now() -
          startedAt,
      },
    );

    log(
      "19. GET /api/portal/me SUCCESS",
    );

    return Response.json(
      response,
    );
  } catch (error) {
    /*
     * ========================================
     * ERROR
     * ========================================
     */

    logError(
      "GET /api/portal/me FAILED",
      error,
    );

    console.error(
      `[PORTAL:${requestId}] Request failed after ${
        Date.now() -
        startedAt
      }ms`,
    );

    const authResponse =
      customerAuthErrorResponse(
        error,
      );

    if (authResponse) {
      console.error(
        `[PORTAL:${requestId}] Returning customer auth error response`,
      );

      return authResponse;
    }

    console.error(
      `[PORTAL:${requestId}] Returning HTTP 500`,
    );

    return Response.json(
      {
        error:
          "Неуспешно зареждане на клиентските данни.",
      },
      {
        status: 500,
      },
    );
  }
}