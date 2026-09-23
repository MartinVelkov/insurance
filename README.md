# Insurance Desk

Уеб приложение за застрахователна фирма с Next.js, TypeScript, shadcn/ui-style компоненти, Firebase Authentication, Cloud Firestore и Google Calendar API.

## Какво работи

- Вход с Firebase Authentication.
- Отделна проверка дали потребителят е упълномощен служител (`staff: true` custom claim + активен документ в `employees`).
- Създаване на клиент, автомобил и полица.
- Един клиент може да има много автомобили и полици.
- Нормализация на български телефони (`08...`, `359...`, `+359...`).
- Нормализация на регистрационни номера, включително визуално еквивалентни кирилски букви.
- Автоматичен погасителен план с правилно разпределение на стотинките.
- Коректно преместване по месеци (31 януари -> последния валиден ден на целевия месец).
- Ръчна корекция на дата и сума преди запис.
- Досие на клиента с автомобили, полици, вноски и история.
- Редакция на телефон без промяна на вътрешния client ID и без загуба на свързаните записи.
- Статуси: предстояща, просрочена, платена.
- Отбелязване на плащане и отмяна на погрешно плащане.
- Редакция на падеж след запис с audit log.
- Google OAuth е отделен от Firebase login.
- Избор на Google календар.
- Настройка на напомняне.
- Един Google event за всяка вноска; пази се `googleEventId` и събитието се update-ва, вместо да се дублира.
- При Calendar грешка полицата остава записана и вноската се маркира с `calendarSyncStatus = error`.
- Dashboard за предстоящи, просрочени и скоро изтичащи полици, с филтри по период и статус.
- Server-side Firestore операции и audit logs.

## 1. Инсталация

```bash
npm install
cp .env.example .env.local
npm run dev
```

Отвори `http://localhost:3000`.

## 2. Firebase

1. Създай Firebase проект.
2. В `Authentication -> Sign-in method` активирай Email/Password.
3. Създай Firestore database.
4. Създай Web App и постави публичните стойности в `NEXT_PUBLIC_FIREBASE_*`.
5. В Firebase / Google Cloud Service Accounts създай service account key и попълни:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
6. Deploy rules и indexes:

```bash
npm i -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

### Активиране на служител

Първо създай потребителя във Firebase Authentication, после:

```bash
npm run grant:staff -- employee@example.com pernik employee
```

Последният аргумент може да бъде `employee` или `owner`. Командата създава/активира `employees/{uid}` с избрания `locationId`.

## 3. Google Calendar API

1. В Google Cloud Console избери проекта.
2. Enable: **Google Calendar API**.
3. Конфигурирай OAuth consent screen.
4. Създай OAuth Client ID от тип **Web application**.
5. Добави Authorized redirect URI:

```text
http://localhost:3000/api/google/callback
```

За production използвай например:

```text
https://your-domain.bg/api/google/callback
```

6. Добави в `.env.local`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

7. Генерирай ключ за криптиране на refresh token:

```bash
openssl rand -base64 32
```

и го постави като:

```env
CALENDAR_TOKEN_ENCRYPTION_KEY=...
```

Refresh token-ът се пази криптиран в `googleConnections/{uid}`. Firestore Rules забраняват client-side четене на тази колекция.

## 4. Firestore модел

### `employees/{uid}`

```ts
{
  uid: string,
  email: string,
  active: boolean,
  role: "owner" | "employee",
  locationId: string,
  calendarSettings?: {
    calendarId: string,
    reminderMinutes: number[]
  }
}
```

### `customerAccounts/{uid}`

Клиентските акаунти са напълно отделени от служителите. Document ID е Firebase Auth UID на клиента.

```ts
{
  uid: string,
  clientId: string,
  locationId: string,
  email: string,
  active: boolean,
  createdAt: string,
  lastLoginAt?: string
}
```

### Ръчно създаване на първи test customer

1. Отвори Firebase Console → Authentication → Users → Add user.
2. Създай потребител с email и парола.
3. Копирай Firebase UID на новия потребител.
4. В Firestore създай документ `customerAccounts/{UID}`:

```ts
{
  uid: "<UID>",
  clientId: "<ID на съществуващ client>",
  email: "client@example.com",
  locationId: "pernik",
  active: true,
  createdAt: "2026-09-23T10:00:00.000Z"
}
```

`clientId` трябва да сочи към съществуващ `clients/{clientId}`, а неговият `locationId` трябва да съвпада с този в customer account.

- Login: `http://localhost:3000/portal/login`
- Портал след вход: `http://localhost:3000/portal`

Порталът е read-only и зарежда данните само през `/api/portal/me`. Firestore Rules не разрешават директно четене или записване на `customerAccounts` и оперативните колекции от клиентския браузър.

### `clients/{clientId}`

```ts
{
  phone: string,
  normalizedPhone: string,
  createdAt: string,
  updatedAt: string,
  createdBy: string,
  updatedBy: string
}
```

### `vehicles/{vehicleId}`

```ts
{
  clientId: string,
  registrationNumber: string,
  normalizedRegistrationNumber: string
}
```

### `policies/{policyId}`

```ts
{
  clientId: string,
  vehicleId: string,
  policyNumber: string,
  normalizedPolicyNumber: string,
  startDate: "YYYY-MM-DD",
  endDate: "YYYY-MM-DD",
  totalAmount: number,
  currency: "EUR" | "BGN",
  installmentCount: number,
  periodMonths: number
}
```

### `installments/{installmentId}`

```ts
{
  policyId: string,
  clientId: string,
  vehicleId: string,
  sequence: number,
  totalCount: number,
  dueDate: "YYYY-MM-DD",
  amount: number,
  currency: "EUR" | "BGN",
  paymentStatus: "pending" | "paid",
  paidAt: string | null,
  googleEventId: string | null,
  calendarSyncStatus: "not_synced" | "synced" | "error",
  calendarSyncError: string | null
}
```

### `auditLogs/{id}`

Записва служителя, действието, типа и ID на записа, клиента, `before`, `after` и timestamp.

## 5. Падежи

Автоматичният план приема:

- начална дата;
- обща сума;
- брой вноски;
- период между вноските в месеци.

Пример: 4 вноски през 3 месеца = тримесечна схема.

Първият падеж е на началната дата на полицата. Преди запис всяка дата и сума може да се коригира. Server-side се проверява сборът на всички вноски да е равен на общата стойност.

## 6. Google Calendar

Примерно събитие:

```text
Вноска 2/4 — СВ1234АВ — Полица №123456
```

Описание:

```text
Телефон: 0888123456
Регистрационен номер: СВ1234АВ
Полица №123456
Вноска: 2/4
Сума: 125.00 EUR
Падеж: 2026-12-19
Валидност: 2026-09-19 – 2027-09-18
Статус: Неплатена
```

Събитията са all-day на датата на падежа. Бизнес часовата зона е `Europe/Sofia`; при all-day event Google Calendar използва календарната дата и не се допуска UTC изместване на деня.

## 7. Сигурност

- Firebase login сам по себе си не дава достъп.
- Backend проверява Firebase ID token, custom claim `staff`, както и `employees/{uid}.active`.
- Client-side Firestore writes са забранени; ежедневните промени минават през защитени Next.js Route Handlers.
- Firebase Admin SDK заобикаля Firestore Security Rules, затова server route-овете правят собствена authorization проверка преди всяка операция.
- Google refresh token не се изпраща към браузъра.
- OAuth `state` е еднократен и с 10-минутна валидност.

## 8. Production препоръки

Преди реално внедряване:

- използвай Firebase App Check, rate limiting и server logging;
- добави backup/export политика за Firestore;
- добави отделен административен екран за активиране/деактивиране на служители;
- при повече от една фирма добави `tenantId/companyId` към всички записи и claims;
- настрой monitoring за неуспешни Calendar sync операции;
- използвай HTTPS production redirect URI;
- ограничи Service Account IAM правата до необходимото.
