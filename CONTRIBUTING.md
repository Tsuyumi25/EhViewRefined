# Contributing

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Native listing compatibility

`pnpm test` includes offline DOM compatibility tests using five anonymized native listing fixtures in `tests/fixtures/native-listing/`, captured from [this Non-H listing](https://e-hentai.org/?f_cats=767&prev=45313). The tests render Extended data into each simulated view and compare the entire listing's element hierarchy, child order and class tokens with the corresponding native fixture. Native advertisement rows are excluded. Each view draws its tags by the site's own rule here, with the two settings that show every tag turned off.

Fixture text, links, resource URLs and event-handler contents are anonymized while element structure, classes and layout styles are retained. Text, other attributes, visual layout and highlight-specific behavior are outside this structural contract. Tests require no network access.

The `Test` GitHub Actions workflow runs `pnpm test` on pushes to `main`, pull requests targeting `main`, and manual dispatches.

## Live check

`pnpm test:live` fetches the current five native layouts from the same listing URL and runs the same DOM contract tests against those responses. It validates the selected modes and matching gallery identities and order before comparison. It never replaces the committed fixtures.

Each run prints a capture directory under `.scratch/live-native-listing/`, containing the response HTML, `capture.json`, and, after comparison, `tests.json` and `result.json`. Fetch errors (`fetch-failed`), invalid samples (`validation-failed`), structural differences (`incompatible`) and test execution errors (`test-runner-failed`) are reported separately. To replay a capture offline, set `EVR_NATIVE_FIXTURE_DIR` to that directory and run `pnpm test src/services/rendering/nativeListing.test.ts`.

The `Live native listing` workflow runs daily at 03:17 UTC and supports manual dispatch. It retains captured pages and available reports as artifacts for 14 days, including failed runs. It requires no login cookies or repository write permission. GitHub schedules run on the default branch, can be delayed, and are disabled after 60 days of inactivity in public repositories; see [GitHub's schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
