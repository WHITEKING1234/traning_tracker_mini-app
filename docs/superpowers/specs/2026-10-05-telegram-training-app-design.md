# Telegram Training App Design

Date: 2026-10-05

## Goal

Build a personal mobile-first training web app that opens inside Telegram as a Mini App. The app should feel close to WHOOP: dark, premium, fast, focused on readiness, training load, recovery signals, progress, and daily execution.

The first version is for one primary user. It should make it easy to open Telegram on iPhone, start today's workout, record sets with weight and reps, rest between sets with an automatic timer, and see progress over time.

## Product Scope

### In Scope For MVP

- Telegram Mini App entry through a bot/menu button.
- Telegram-based identity using Mini App launch data.
- Mobile-first UI optimized for iPhone inside Telegram WebView.
- Three-day workout program:
  - Monday
  - Wednesday
  - Friday
- Workout day screen with the exercises for that day.
- Exercise screen with set logging:
  - weight in kilograms
  - reps
  - completed set timestamp
  - optional notes
- Automatic rest timer after completing a set.
- Exercise progress:
  - best set
  - estimated volume
  - recent history
  - simple chart per exercise
- Body weight tracking:
  - date
  - body weight in kilograms
  - trend chart
- Exercise technique media:
  - attach a video URL, photo URL, or local reference field per exercise
  - show it inside the exercise detail view
- Data persisted server-side so it is not lost when opening from Telegram on another device.

### Out Of Scope For MVP

- Automatic Apple Health, WHOOP, Garmin, or smartwatch sync.
- AI form analysis from uploaded video.
- Social feed, friends, groups, leaderboards.
- Paid subscriptions.
- Nutrition tracking.
- Complex periodization or auto-generated training plans.
- Public multi-user SaaS administration.

These can be added later after the workout journal is solid.

## Workout Program

### Monday

- Жим штанги лёжа
- Тяга верхнего блока
- Жим ногами
- Тяга горизонтального блока
- Разводка гантелей
- Сгибание ног лёжа
- Подъём гантелей на бицепс
- Разгибание рук на блоке
- Пресс

### Wednesday

- Приседания со штангой
- Жим гантелей сидя
- Тяга верхнего блока
- Румынская тяга
- Разведения гантелей в стороны
- Тяга горизонтального блока
- Сгибание ног лёжа
- Молотки
- Французский жим

### Friday

- Жим гантелей на наклонной скамье
- Тяга Т-грифа
- Разгибание ног
- Жим в тренажёре
- Тяга верхнего блока узким хватом
- Разведения гантелей в стороны
- Сгибание рук на скамье Скотта
- Разгибание рук на блоке
- Подъём на носки стоя

Exercise names in the UI should match these Russian names.

## User Experience

### Launch

The user opens Telegram, taps the bot's app button, and lands directly in the Mini App. The app reads Telegram launch data, validates it on the backend, creates or finds the user profile, then loads today's workout.

### Home / Today Screen

The first screen should show:

- Today workout name, such as "Понедельник".
- A compact WHOOP-style metric row:
  - "Готовность" as a simple manually derived score for now.
  - "Объем" for today's completed workout volume.
  - "Подходы" completed versus planned.
  - "Вес тела" latest entry.
- Primary button to start or continue today's workout.
- Workout day switcher for Monday, Wednesday, Friday.
- Recent activity/progress preview.

The app should not feel like a landing page. It opens directly into the training tool.

### Workout Screen

The workout screen shows all exercises for the selected day. Each exercise row includes:

- Exercise name.
- Last recorded working weight or best recent set.
- Completed set count for the current session.
- Status indicator: not started, in progress, complete.

Tapping an exercise opens the exercise detail screen.

### Exercise Detail Screen

The exercise detail screen includes:

- Exercise name and current workout day.
- Technique media block:
  - video/photo/link if configured
  - empty state to add media later
- Set logger:
  - rows for each set
  - inputs for kg and reps
  - "Готово" action for each set
- Automatic rest timer:
  - starts after "Готово"
  - visible countdown
  - haptic feedback if Telegram supports it
  - default rest duration can differ by exercise type
- Progress preview:
  - best set
  - previous session result
  - recent trend chart

The interface should make logging very fast: kg and reps should be easy to edit with thumb-friendly inputs.

### Progress Screen

The progress screen includes:

- Exercise selector.
- Chart of best working weight over time.
- Chart or stat for total volume over time.
- Best set ever.
- Last five sessions for the exercise.
- Body weight trend section.

Charts should be simple and readable on iPhone.

### Settings Screen

The settings screen includes:

- Rest timer defaults:
  - heavy compound exercises
  - accessory exercises
  - abs/calves
- Exercise media management.
- Body weight entry.
- Telegram profile display.

## Data Model

### User

- id
- telegram_id
- username
- first_name
- photo_url
- created_at
- updated_at

### WorkoutDay

- id
- user_id
- weekday
- title
- sort_order

### Exercise

- id
- user_id
- workout_day_id
- name
- slug
- category
- sort_order
- default_rest_seconds
- technique_media_type
- technique_media_url
- created_at
- updated_at

### WorkoutSession

- id
- user_id
- workout_day_id
- session_date
- started_at
- completed_at
- notes

### ExerciseSet

- id
- user_id
- workout_session_id
- exercise_id
- set_number
- weight_kg
- reps
- completed_at
- notes

### BodyWeightEntry

- id
- user_id
- entry_date
- weight_kg
- created_at

## Progress Calculations

### Set Volume

`weight_kg * reps`

### Exercise Session Volume

Sum of all set volume for one exercise in one workout session.

### Workout Session Volume

Sum of all set volume for all exercises in one workout session.

### Best Set

For the MVP, rank by highest weight first, then reps. Later this can be improved with estimated one-rep max.

### Readiness Score

The MVP can start with a simple starter score derived from recent completion:

- 85 if no workout yesterday and last workout was completed.
- 70 if there was a workout yesterday.
- 60 if the previous planned workout was skipped.

This is intentionally not medical or recovery advice. It is a motivational UI metric until real sleep/recovery inputs exist.

## Technical Architecture

### Recommended Stack

- Frontend: React + TypeScript + Vite.
- Styling: Tailwind CSS or scoped CSS with CSS variables.
- Charts: lightweight chart library such as Recharts.
- Backend: Node.js + Express or Next.js API routes.
- Database: SQLite for local/simple deployment, with a path to Postgres later.
- ORM: Prisma or Drizzle.
- Telegram: official Telegram Mini App JavaScript bridge.

For fastest local build and deployment, a single Next.js app is also acceptable:

- App routes for UI.
- API routes for data.
- Server-side Telegram init data validation.
- SQLite database for MVP.

### Telegram Integration

The Mini App must:

- Load Telegram's Mini App script.
- Read `Telegram.WebApp.initData`.
- Send init data to the backend.
- Validate init data on the backend using the bot token.
- Create a session for the Telegram user.
- Use Telegram theme parameters where useful.
- Respect safe areas inside Telegram WebView.

The bot setup must:

- Create a bot with BotFather.
- Configure the Mini App URL.
- Add a menu button or main Mini App launch button.
- Use HTTPS for production deployment.

### Persistence

All workout logs and body weight entries should be saved server-side. Client-side local storage can be used only for temporary UI state, not as the source of truth.

### Security

- Do not trust Telegram user data from the client unless init data is validated server-side.
- Keep bot token in server environment variables only.
- Never expose the bot token in frontend code.
- Scope all queries by authenticated Telegram user.
- Validate numeric inputs for weight and reps.

## Visual Direction

The app should feel:

- dark
- premium
- data-first
- sharp
- athletic
- fast

Use:

- black or near-black background
- high-contrast white text
- restrained neon accents
- circular/ring metrics
- compact cards with clear hierarchy
- smooth but subtle transitions

Avoid:

- marketing landing page layout
- oversized hero section
- decorative gradients that hide the product
- cluttered dashboards
- cartoon fitness styling

## MVP Acceptance Criteria

- User can open the app in a mobile viewport.
- User can view Monday, Wednesday, and Friday workout plans.
- User can create a workout session.
- User can record weight and reps for every exercise.
- Completing a set starts a rest timer.
- User can see previous results for an exercise.
- User can see progress charts for exercise weight/volume.
- User can record and view body weight history.
- Exercise technique media can be configured and displayed.
- Data survives page reloads.
- Telegram identity is the account identity when launched from Telegram.

## Open Decisions

The following details can be decided during implementation without changing the product direction:

- Exact rest defaults per exercise category.
- Whether technique media is stored as external links only in MVP or uploaded files later.
- Whether the first deployment uses SQLite or a managed Postgres database.
- Whether the first UI uses Tailwind or plain CSS modules.

## First Implementation Slice

The first build should prioritize a working vertical slice:

1. Mobile UI shell with WHOOP-like styling.
2. Seeded workout program.
3. Local development auth fallback plus Telegram auth adapter.
4. Workout session creation.
5. Set logging with kg and reps.
6. Automatic rest timer.
7. Exercise history/progress.
8. Body weight tracker.

After this slice works locally, configure deployment and Telegram bot launch.
