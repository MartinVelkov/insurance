import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function waitForAuthUser(): Promise<User | null> {
  // Ако Firebase вече е заредил потребителя
  if (auth.currentUser) {
    return auth.currentUser;
  }

  // Изчакваме Firebase да приключи инициализацията
  return new Promise<User | null>((resolve, reject) => {
    let unsubscribe = () => {};

    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

export async function apiFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const user = await waitForAuthUser();

  if (!user) {
    throw new Error("Няма активна сесия.");
  }

  const token = await user.getIdToken();

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error ?? "Възникна грешка.", response.status);
  }

  return data as T;
}
