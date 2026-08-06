# Orthodox Calendar — Clergy Review

**Status: ONE ITEM RESOLVED, ONE STILL OPEN.** See "Decisions" below.

The parish calendar used to be a hand-written list of 2025 dates. It ran out at
28 December 2025, so from January 2026 the calendar on the website rendered a
correct Ethiopian grid with no feasts or fasts marked on it at all.

It is now generated. The dates below are produced by code, not transcribed from
a printed calendar, and they still need Keshi Tadesse (or whoever the parish
designates) to check them before anyone relies on them for fasting.

## How the dates are produced

Two mechanisms, both derived from the parish's own 2025 calendar — the one
credited to ቦክረ ሊቃዉንት መምህር አፈወርቅ:

- **Fixed feasts** sit on a fixed Ethiopian date (Gena is Tahsas 29, Timket is
  Tir 11, and so on) and are converted to Gregorian arithmetically.
- **Movable feasts** are an offset in days from Fasika, and Fasika is computed
  with the Alexandrian (Julian-reckoned) Paschal computus that the Eastern
  churches use.

The rules live in one file, `frontend/src/data/orthodoxEventRules.ts`. That is
the only file a correction needs to touch.

## What has already been checked

- The generator reproduces the published 2025 calendar exactly — same date,
  English title, Tigrigna title, category, and major-feast flag — **apart from
  the two corrected Abune Aregawi dates below**, which it deviates from
  deliberately. A test fails the build if that ever stops being true
  (`orthodoxEvents.golden.test.ts`).
- Fasika matches independently known Orthodox Pascha dates for 2024–2028, and
  always lands on a Sunday.
- Ethiopian↔Gregorian conversion round-trips every single day across a full
  four-year leap cycle, Pagumen's sixth day included.
- Weekdays land where they should: Nineveh and Abiy Tsom begin on Mondays,
  Hosanna and Fasika fall on Sundays, Siklet on a Friday, Ascension on a
  Thursday.

## Decisions

### RESOLVED — Abune Aregawi is Ethiopian day 14

*Decided 5 August 2026 by Dawit Yifter.*

The 2025 calendar labelled both occurrences "14" (ጥሪ 14 and ጥቅምቲ 14), and the
monthly commemoration table in the same file also places Abune Aregawi on the
14th — but the dates it actually printed, 23 January and 25 October 2025, were
both Ethiopian day **15**. The printed dates were off by one.

The generator now uses day **14**. This is the one place where it deliberately
does not reproduce the 2025 calendar:

| Feast | 2025 printed | Corrected |
|---|---|---|
| Feast of Abune Aregawi (Tir 14) | 2025-01-23 | **2025-01-22** |
| Feast of Abune Aregawi (Tikemt 14) | 2025-10-25 | **2025-10-24** |

The published 2025 list is kept unedited in the code as the historical record;
the two deviations are declared explicitly in `REVIEWED_CORRECTIONS_2025` in the
golden test, so the difference stays visible and auditable rather than
disappearing into a silent edit.

### STILL OPEN — where does each fast season end?

The dashboard now shows a band saying what today is in the church, including
which fast season is running and which day of it today is. Season *starts* are
the dates the parish published and are already checked by the golden test.
Season *ends* are not — the published calendar names a start and a feast, and
where the last fasting day falls between them is a judgement. Here is what the
code currently assumes:

| Fast | Last fasting day used | Why |
|---|---|---|
| Tsome Nebiyat | Gahad of Gena (Tahsas 28) | The 2025 calendar marks Tahsas 28 as a fast; Gena on 29 is a feast |
| Nineveh | 3rd day | Exactly the three days printed |
| Abiy Tsom | day before Fasika | Fasika is a feast |
| Apostles' Fast | Hamle 5 | The 2025 calendar types "End of Apostles' Fast (Hamle 5)" as a **fast**, so it is treated as the last fasting day rather than the first day after |
| Filseta | Nehasse 15 | Ends the day before the Assumption (Nehasse 16). **Some reckonings fast through the 16th itself** — this is the one most likely to be wrong |

Please confirm, particularly Filseta and the Apostles' Fast.

### ALSO NOT YET MODELLED — Wednesday and Friday fasting

Ordinary Wed/Fri fasting is deliberately **not** shown. It is kept year-round
except during fast-free periods whose boundaries the code has no authority to
assert, and marking an ordinary Wednesday as a fast when the Church does not
would be worse than saying nothing. The band currently says "an ordinary day"
on those days.

To switch it on, the fast-free windows need to be stated — at minimum the
period after Fasika, and the days between Gena and Timket. Once those are
written down, it is a small addition to `frontend/src/data/fastingSeasons.ts`.

### STILL OPEN — when does Abiy Tsom begin?

The published 2025 calendar starts Great Lent on 17 February 2025, which is 62
days before Fasika and exactly one week after Nineveh begins. Some reckonings
put Great Lent at 55 days before Fasika, which would have been 24 February 2025.
The generator follows the parish's published figure of 62. **Please confirm.**

If 55 is correct, change the `offset: -62` rule for "Start of Abiy Tsom" in
`orthodoxEventRules.ts` to `-55` and add the 2025 date to
`REVIEWED_CORRECTIONS_2025`, the same way the Abune Aregawi correction was
recorded.

## Generated dates for review

Weekdays are shown so errors are easy to spot — a fast that should start on a
Monday appearing on a Thursday is visible at a glance.


## 2026    (Fasika: 2026-04-12)

| Gregorian | Day | Feast / Fast | Tigrigna | Rule |
|---|---|---|---|---|
| 2026-01-06 | Tue | Gahad of Gena | ጋድ ብርሃነ ልደት | Tahsas 28 |
| 2026-01-07 | Wed | Gena | ብርሃነ ልደት | Tahsas 29 |
| 2026-01-18 | Sun | Gahad of Timket | ጋድ ብርሃነ ጥምቀት | Tir 10 |
| 2026-01-19 | Mon | Timket | ብርሃነ ጥምቀት | Tir 11 |
| 2026-01-20 | Tue | Kana Ze Galilee | ቃና ዘገሊላ | Tir 12 |
| 2026-01-22 | Thu | Abune Aregawi (Tir) | በዓል ኣቡነ ኣረጋዊ | Tir 14 |
| 2026-02-02 | Mon | Nineveh Day 1 | ጾመ ነነዌ | Fasika -69 |
| 2026-02-03 | Tue | Nineveh Day 2 | ጾመ ነነዌ | Fasika -68 |
| 2026-02-04 | Wed | Nineveh Day 3 | ጾመ ነነዌ | Fasika -67 |
| 2026-02-09 | Mon | Abiy Tsom start | ጅማሮ ዓቢይ ጾም | Fasika -62 |
| 2026-04-05 | Sun | Hosanna | ሆሳእና | Fasika -7 |
| 2026-04-07 | Tue | Annunciation | በስራት | Megabit 29 |
| 2026-04-10 | Fri | Siklet | ስቅለት | Fasika -2 |
| 2026-04-12 | Sun | Fasika | ብርሃነ ትንሳኤ | Fasika +0 |
| 2026-05-21 | Thu | Beale Urget | በዓለ ዕርገት | Fasika +39 |
| 2026-05-31 | Sun | Paracletos | ጰራቅሊጦስ | Fasika +49 |
| 2026-06-01 | Mon | Apostles' Fast start | ጅማሮ ጾመ ሓዋርያት | Fasika +50 |
| 2026-07-12 | Sun | End of Apostles' Fast | ፍጻሜ ጾመ ሓዋርያት | Hamle 5 |
| 2026-08-07 | Fri | Filseta start | ጅማሮ ጾመ ፍልሰታ | Nehasse 1 |
| 2026-08-19 | Wed | Debre Tabor | ደብረ ታቦር | Nehasse 13 |
| 2026-08-22 | Sat | Filseta | በዓለ ፍልሰታ | Nehasse 16 |
| 2026-09-11 | Fri | New Year (Enkutatash) | ርእሰ ዓውደ ዓመት | Meskerem 1 |
| 2026-09-27 | Sun | Meskel | በዓለ መስቀል | Meskerem 17 |
| 2026-10-24 | Sat | Abune Aregawi (Tikemt) | በዓል ኣቡነ ኣረጋዊ | Tikemt 14 |
| 2026-11-24 | Tue | Tsome Nebiyat start | ጅማሮ ጾመ ነቢያት | Hidar 15 |
| 2026-12-28 | Mon | Kulubi Gabriel | ቁልቢ ገብርኤል | Tahsas 19 |

## 2027    (Fasika: 2027-05-02)

| Gregorian | Day | Feast / Fast | Tigrigna | Rule |
|---|---|---|---|---|
| 2027-01-06 | Wed | Gahad of Gena | ጋድ ብርሃነ ልደት | Tahsas 28 |
| 2027-01-07 | Thu | Gena | ብርሃነ ልደት | Tahsas 29 |
| 2027-01-18 | Mon | Gahad of Timket | ጋድ ብርሃነ ጥምቀት | Tir 10 |
| 2027-01-19 | Tue | Timket | ብርሃነ ጥምቀት | Tir 11 |
| 2027-01-20 | Wed | Kana Ze Galilee | ቃና ዘገሊላ | Tir 12 |
| 2027-01-22 | Fri | Abune Aregawi (Tir) | በዓል ኣቡነ ኣረጋዊ | Tir 14 |
| 2027-02-22 | Mon | Nineveh Day 1 | ጾመ ነነዌ | Fasika -69 |
| 2027-02-23 | Tue | Nineveh Day 2 | ጾመ ነነዌ | Fasika -68 |
| 2027-02-24 | Wed | Nineveh Day 3 | ጾመ ነነዌ | Fasika -67 |
| 2027-03-01 | Mon | Abiy Tsom start | ጅማሮ ዓቢይ ጾም | Fasika -62 |
| 2027-04-07 | Wed | Annunciation | በስራት | Megabit 29 |
| 2027-04-25 | Sun | Hosanna | ሆሳእና | Fasika -7 |
| 2027-04-30 | Fri | Siklet | ስቅለት | Fasika -2 |
| 2027-05-02 | Sun | Fasika | ብርሃነ ትንሳኤ | Fasika +0 |
| 2027-06-10 | Thu | Beale Urget | በዓለ ዕርገት | Fasika +39 |
| 2027-06-20 | Sun | Paracletos | ጰራቅሊጦስ | Fasika +49 |
| 2027-06-21 | Mon | Apostles' Fast start | ጅማሮ ጾመ ሓዋርያት | Fasika +50 |
| 2027-07-12 | Mon | End of Apostles' Fast | ፍጻሜ ጾመ ሓዋርያት | Hamle 5 |
| 2027-08-07 | Sat | Filseta start | ጅማሮ ጾመ ፍልሰታ | Nehasse 1 |
| 2027-08-19 | Thu | Debre Tabor | ደብረ ታቦር | Nehasse 13 |
| 2027-08-22 | Sun | Filseta | በዓለ ፍልሰታ | Nehasse 16 |
| 2027-09-12 | Sun | New Year (Enkutatash) | ርእሰ ዓውደ ዓመት | Meskerem 1 |
| 2027-09-28 | Tue | Meskel | በዓለ መስቀል | Meskerem 17 |
| 2027-10-25 | Mon | Abune Aregawi (Tikemt) | በዓል ኣቡነ ኣረጋዊ | Tikemt 14 |
| 2027-11-25 | Thu | Tsome Nebiyat start | ጅማሮ ጾመ ነቢያት | Hidar 15 |
| 2027-12-29 | Wed | Kulubi Gabriel | ቁልቢ ገብርኤል | Tahsas 19 |

## 2028    (Fasika: 2028-04-16)

| Gregorian | Day | Feast / Fast | Tigrigna | Rule |
|---|---|---|---|---|
| 2028-01-07 | Fri | Gahad of Gena | ጋድ ብርሃነ ልደት | Tahsas 28 |
| 2028-01-08 | Sat | Gena | ብርሃነ ልደት | Tahsas 29 |
| 2028-01-19 | Wed | Gahad of Timket | ጋድ ብርሃነ ጥምቀት | Tir 10 |
| 2028-01-20 | Thu | Timket | ብርሃነ ጥምቀት | Tir 11 |
| 2028-01-21 | Fri | Kana Ze Galilee | ቃና ዘገሊላ | Tir 12 |
| 2028-01-23 | Sun | Abune Aregawi (Tir) | በዓል ኣቡነ ኣረጋዊ | Tir 14 |
| 2028-02-07 | Mon | Nineveh Day 1 | ጾመ ነነዌ | Fasika -69 |
| 2028-02-08 | Tue | Nineveh Day 2 | ጾመ ነነዌ | Fasika -68 |
| 2028-02-09 | Wed | Nineveh Day 3 | ጾመ ነነዌ | Fasika -67 |
| 2028-02-14 | Mon | Abiy Tsom start | ጅማሮ ዓቢይ ጾም | Fasika -62 |
| 2028-04-07 | Fri | Annunciation | በስራት | Megabit 29 |
| 2028-04-09 | Sun | Hosanna | ሆሳእና | Fasika -7 |
| 2028-04-14 | Fri | Siklet | ስቅለት | Fasika -2 |
| 2028-04-16 | Sun | Fasika | ብርሃነ ትንሳኤ | Fasika +0 |
| 2028-05-25 | Thu | Beale Urget | በዓለ ዕርገት | Fasika +39 |
| 2028-06-04 | Sun | Paracletos | ጰራቅሊጦስ | Fasika +49 |
| 2028-06-05 | Mon | Apostles' Fast start | ጅማሮ ጾመ ሓዋርያት | Fasika +50 |
| 2028-07-12 | Wed | End of Apostles' Fast | ፍጻሜ ጾመ ሓዋርያት | Hamle 5 |
| 2028-08-07 | Mon | Filseta start | ጅማሮ ጾመ ፍልሰታ | Nehasse 1 |
| 2028-08-19 | Sat | Debre Tabor | ደብረ ታቦር | Nehasse 13 |
| 2028-08-22 | Tue | Filseta | በዓለ ፍልሰታ | Nehasse 16 |
| 2028-09-11 | Mon | New Year (Enkutatash) | ርእሰ ዓውደ ዓመት | Meskerem 1 |
| 2028-09-27 | Wed | Meskel | በዓለ መስቀል | Meskerem 17 |
| 2028-10-24 | Tue | Abune Aregawi (Tikemt) | በዓል ኣቡነ ኣረጋዊ | Tikemt 14 |
| 2028-11-24 | Fri | Tsome Nebiyat start | ጅማሮ ጾመ ነቢያት | Hidar 15 |
| 2028-12-28 | Thu | Kulubi Gabriel | ቁልቢ ገብርኤል | Tahsas 19 |

## Known limitation

When a fixed feast falls on a movable one, the calendar grid currently shows
only one of the two. This happens once in the next fifteen years: **7 April
2034**, when the Annunciation falls on Good Friday. Worth fixing before then,
not urgent now.

## After review

Once the remaining Abiy Tsom question is settled, update the status line at the
top of this file. To change any rule, edit `orthodoxEventRules.ts` and re-run
`npm test -- --testPathPattern=orthodoxEvents.golden` from `frontend/` — the
test reports immediately if a change breaks agreement with the 2025 calendar,
and any intended deviation belongs in `REVIEWED_CORRECTIONS_2025` with a reason
and a date.
