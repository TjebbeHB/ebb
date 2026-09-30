# Personal insights in Ebb 1.1

## Diary additions

Pain is an optional 0–10 self-rating; zero is explicitly recorded, not inferred. Daily impact can be no impact, slowed down, or missed activities. These controls are included for new users and available through Settings → Trackers for existing users. A “No symptoms” entry is distinct from an unlogged category. The appointment summary covers the last 90 calendar days, including today, and contains bleeding counts, cycle history, symptom counts, pain and impact. Private notes and sexual activity are omitted. The user previews it before opening a share sheet or downloading a text file.

## Algorithms

The existing period estimate remains the median of the last six eligible cycle lengths, falling back to the user’s typical length until two are available. The displayed range is a heuristic, not a calibrated confidence interval. The new retrospective review predicts each completed cycle using only earlier cycles, shows mean absolute error and the count within two days, and requires at least three checks before presenting an accuracy summary. It evaluates the cycle-length rule; it is not an audit of notifications delivered in the past and does not account for within-cycle temperature updates. Excluded/outlier cycles are omitted.

Sleep, energy, pain and resting-heart-rate phase comparisons use the last 180 days, completed eligible cycles only, and require at least five observations inside and outside a phase, each spanning at least two cycles. Each cycle receives equal weight within each comparison group to limit logging-density bias. A difference is displayed at 0.5 energy points, 0.5 sleep hours, 1 pain point, or 3 bpm. These are display thresholds, not statistical significance tests or clinical thresholds. Results describe observations; they do not establish causation, diagnose PMS or another condition, or prescribe behaviors. Estimated phase boundaries and selective logging can bias comparisons. Hormonal contraception disables these comparisons.

Symptom recurrence counts only cycles with observations in the relevant category/window. Phase frequencies similarly use category-specific denominators; a day with only flow or energy is no longer interpreted as symptom-free. Excluded/outlier cycles are omitted, duplicate symptom IDs are counted once, and custom IDs containing colons remain intact.

## Ovulation estimates

LH tests and mucus peaks are indirect evidence, not confirmation. They can inform the displayed ovulation estimate but do not shift the next period date or teach luteal length. Temperature-supported estimates can update period timing and personalise luteal length after two qualifying cycles. A thermal shift requires nine consecutive daily measurements: three above the previous six, with the third at least 0.2 °C above their maximum. Missing, duplicate, disturbed or out-of-range measurements do not form a qualifying nine-day sequence. This deliberately conservative heuristic is not a validated fertility-awareness method. No wearable skin temperature is imported or treated as basal body temperature. Ebb remains unsuitable for contraception.

## Sources informing the scope

- [ASRM: fertility evaluation (LH gives indirect evidence; BBT has reliability limits)](https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/)
- [ACOG: heavy menstrual bleeding and keeping a cycle record](https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding)
- [ACOG: painful periods](https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods)
- [ACOG: PMS and repeated symptom records](https://www.acog.org/womens-health/faqs/Premenstrual-Syndrome)
