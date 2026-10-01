# ProTrain v8

Ships as ONE file (`index.html`, with `sw.js`, `manifest.json`, icons) so it works from any host or file manager.
The file is generated from `src/`:

| file | contents |
|---|---|
| `head.html`, `body.html`, `tail.html` | page shell, markup, service-worker registration |
| `styles.css` | all CSS |
| `10-data.js` | schedules, exercises (`EX`), alternatives (`SUBS`), cycle plan |
| `20-tracking.js` ... `95-data-io.js` | storage and tracking, progression/PRs, helpers, timers, screens, log modal, export/import |

Edit `src/`, then run `python3 build.py --check` (needs Python 3 and Node). It rebuilds `index.html`, syntax-checks the JS and validates the program data (duplicate ids, missing swap targets).

## Exercise ids
Ids such as `d1_pul` are **permanent keys**. The training day comes from which `EX` array holds the exercise, never from the id, so moving an exercise to another day does not orphan its history. If you must rename an id, add `oldId:'newId'` to `ID_ALIASES` in `10-data.js` and existing logs follow it. Alternate exercises use `<id>_altN`.

When you change `sw.js` assets or ship a new version, bump `CACHE` in `sw.js`.
