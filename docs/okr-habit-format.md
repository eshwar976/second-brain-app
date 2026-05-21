# OKR Habit Tracking Format

The Dashboard habit tracker reads habits from the active personal OKR file and counts matching activity logs from monthly fleeting notes.

Markdown remains the source of truth. The app only reads OKR habit definitions and fleeting activity logs; it does not write habit state.

## OKR Frontmatter

Add optional quarter dates at the top of the OKR file. These make quarter-level habit stats precise:

```yaml
quarter: Q1-FY2027
quarter-start: "2026-04-15"
quarter-end: "2026-07-14"
```

If `quarter-start` and `quarter-end` are missing, the app infers the range from labels like `Q1-FY2027` using the personal fiscal-year convention:

- Q1: Apr 15-Jul 14
- Q2: Jul 15-Oct 14
- Q3: Oct 15-Jan 14
- Q4: Jan 15-Apr 14

## Daily Habit KR

Use `type: habit` for habits that should be checked daily.

Use `weekly-target` when consistency does not require a perfect 7/7 week. For example, `weekly-target: 6` means six logged days turns the weekly consistency dot green.

```yaml
key-results:
  - id: "1.3"
    objective: 1
    objective-title: "Establish health baseline"
    description: "Apply psoriasis ointment consistently"
    type: habit
    activity: ointment
    domain: self-care
    cadence: daily
    weekly-target: 6
    status: in-progress
```

The Dashboard shows:

- whether it was logged today
- current day streak
- weekly consistency dots, with small dots for the current week
- logged days this quarter
- whether it needs attention

## Weekly Habit KR

For frequency KRs that should also appear in Dashboard habit tracking, add `habit: true`.

```yaml
key-results:
  - id: "1.1"
    objective: 1
    objective-title: "Establish health baseline"
    description: "Go to the gym at least 3x/week"
    type: frequency
    habit: true
    target: 3
    unit: sessions/week
    activity: gym
    domain: self-care
    cadence: weekly
    status: in-progress
```

The Dashboard shows:

- current week count vs `target`
- current week streak
- weekly consistency dots
- logged days this quarter
- whether it needs attention

## Fleeting Log Format

Habit progress is counted from fleeting-note activity fields:

```md
## 2026-05-20

- 7:24 PM Bath, moisturize, ointment [domain:: self-care] [activity:: ointment]
- 6:10 AM Gym push day [domain:: self-care] [activity:: gym]
```

The important part is the activity field:

```md
[activity:: ointment]
```

For habit tracking to work, the OKR `activity` value and fleeting `[activity:: ...]` value must match exactly.

## What Not To Do

- Do not create a separate habit database.
- Do not manually edit Dashboard state.
- Do not duplicate habit logs outside fleeting notes.
- Do not mark every frequency KR as a habit; use `habit: true` only for behaviors you want to deliberately track until they become second nature.
