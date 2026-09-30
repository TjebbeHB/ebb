# Research: what the best paid cycle trackers offer, and what Ebb takes from them

Compiled September 2026 from app store listings, vendor pages, support articles and independent reviews. Sources at the end.

## The market in one paragraph

Four apps set the bar. **Flo** has the widest feature set (70+ trackable symptoms, cycle and ovulation predictions, symptom pattern reports, a health assistant, pregnancy and perimenopause modes) but most of the insight features sit behind a ~$60/year subscription, and it has a history of sharing data with third parties. **Clue** is the science-led option with 30+ tracking categories, honest uncertainty in its predictions, and modes for conception, pregnancy and perimenopause; its best analysis is in Clue Plus (~$80/year) and it requires an email account. **Natural Cycles** is the only app cleared as contraception; it is built entirely around daily basal body temperature and costs ~$90/year. **Apple Health Cycle Tracking** is free and on-device but iPhone-only, shallow on symptoms, and offers no ovulation estimate without a Watch. Privacy-first alternatives (**drip**, **Euki**, **Periodical**) keep data local and have no accounts, but they are thin on insights, and drip is Android-only.

## What users complain about

- Features they used to have suddenly moving behind a paywall (Flo, Clue, Stardust history limit).
- Distrust after data-sharing scandals (Flo FTC settlement, Stardust and Premom sending data to third parties, Glow security failures).
- Predictions that break for irregular cycles, and no way to say "ignore that odd cycle".
- No way to tune the fertile window: people avoiding pregnancy want a wider, cautious window; people trying to conceive want a narrow one.
- Pink, flowery, "cutesy" design that is embarrassing on a shared screen and reveals what the app is.
- Notifications that leak private information on the lock screen.
- Account-based apps losing history when a login fails; local-only apps losing history when the phone is lost (no backup).
- Long onboarding.

## Feature set that Ebb implements (all free, all offline)

| Area | What the paid apps do | Ebb |
|---|---|---|
| Period logging | Flow intensity, spotting, start/end | Spotting / light / medium / heavy per day; tap-to-mark period days on the calendar; "Period started/ended" buttons |
| Predictions | Next period, fertile window, ovulation, PMS | Median of last six valid cycles, outlier and manual exclusion, expected date range, "days late" state, 13 cycles ahead |
| Fertility awareness | Natural Cycles temperature algorithm, Clue/Flo LH tests, drip sympto-thermal | Basal temperature with three-over-six shift rule, LH tests, cervical mucus peak; confirmed ovulation adjusts the current cycle and learns your luteal length |
| Symptoms | Flo 70+, Clue 30+ categories | 31 symptoms, 17 moods, energy, sleep hours and quality, discharge, cervix, sex and libido, tests, pill, medication and supplements, water, exercise, weight, custom symptoms, custom tags, notes |
| Insights | Cycle reports, symptom patterns, phase correlations (paid) | Average and median lengths, variability and regularity rating, cycle-length chart, cycle history with exclude toggle, recurring premenstrual and period symptoms, symptom frequency by phase, temperature curve with ovulation marker |
| Modes | Track / conceive / avoid / birth control / pregnancy / perimenopause | Track, trying to conceive, avoid pregnancy (cautious window), hormonal birth control (ovulation hidden, pill tracking). Pregnancy and perimenopause modes are not in this version |
| Reminders | Period, fertile, ovulation, log, pill | Period soon, period expected, period late, fertile window, ovulation, daily check-in, pill, temperature; wording is deliberately vague on the lock screen |
| Privacy | Anonymous mode (Flo), local storage (drip, Euki) | No account, no server, no analytics, no network use at all; PIN and biometric app lock; JSON backup and import, CSV export, delete everything |
| Design | Often pink and flower-heavy | Neutral plum and sand palette, dark mode, no flowers, no emoji, discreet name and icon |

## Data points tracked per day

Bleeding (flow), symptoms (multi), moods (multi), energy (1-5), sleep hours and quality, cervical mucus (dry, sticky, creamy, watery, egg white, unusual), cervix position, firmness and opening, basal body temperature with a "disturbed" flag, ovulation test result, pregnancy test result, sex (protected, unprotected, withdrawal, solo), libido, pill taken or missed, medications and supplements, water, exercise type, weight, custom tags, free-text notes.

## Prediction method

- A period starts on the first day of light, medium or heavy bleeding. Bleeding days at most three days apart belong to the same period. Spotting never starts a period. Bleeding that starts less than twelve days after the previous period start is treated as breakthrough bleeding.
- Cycle length is the number of days between period starts. Predictions use the median of the last six cycles, ignoring cycles shorter than 15 or longer than 60 days and cycles the user excluded. Until two cycles exist, the onboarding "typical cycle length" is used.
- Regularity: standard deviation of those lengths, up to 2.5 days regular, up to 5 somewhat irregular, above that irregular. The expected-date range uses that deviation.
- Ovulation is estimated as cycle length minus luteal length (14 by default, learned from confirmed ovulations after two or more cycles). Fertile window is five days before ovulation through one day after; the cautious setting adds two days on each side.
- Temperature shift (Sensiplan style): three readings above the maximum of the previous six, the third at least 0.2 °C higher. Ovulation is the day before the first high reading. A positive LH test places ovulation the next day. A mucus peak followed by three drier days places ovulation on the peak day.

## Not in this version

Pregnancy mode, perimenopause mode, Apple Health / Health Connect sync, wearable temperature import, partner sharing, cloud backup, and translations. All are compatible with the current data model.

## Sources

- https://unstar.app/blog/flo-clue-stardust-apple-health-period-tracking-apps-ranked-2026
- https://bearable.app/the-best-period-tracker-apps-of-2026/
- https://flo.health/flo-premium
- https://apps.apple.com/us/app/flo-period-pregnancy-tracker/id1038369065
- https://support.helloclue.com/hc/en-us/articles/15007279508637-What-s-included-in-Clue-Plus
- https://helloclue.com/articles/how-to-use-clue/clue-period-tracking-relaunched-and-newly-designed
- https://www.naturalcycles.com/cyclematters/period-calculator
- https://dripapp.org/faq.html
- https://www.mozillafoundation.org/en/nothing-personal/euki-privacy-review/
- https://www.consumerreports.org/health/health-privacy/period-tracker-apps-privacy-a2278134145/
- https://support.apple.com/en-us/120356
- https://washington.edu/news/2017/05/02/period-tracking-apps-failing-users-in-basic-ways-study-finds
- https://rrmacademy.org/sympto-thermal-method/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9171018/
- https://developer.android.com/health-and-fitness/health-connect/data-types
- https://support.google.com/googleplay/android-developer/answer/14738291
