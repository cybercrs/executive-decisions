# Executive Decisions

A seven-part browser activity in which students join the executive management team and guide Riverbend Recreation through corporate formation, stock issuance, earnings and investment, treasury stock, cash dividend dates, and equity reporting. The final part compares debt and common equity financing under strong and weak earnings.

## Open locally

Open `index.html` in Safari, Chrome, Edge, or Firefox. All app files are local. There is no installation, Python, Streamlit, package download, or internet connection required to use the activity.

The included **Launch Executive Decisions.command** (Mac) and **Launch Executive Decisions.bat** (Windows) launchers open the same file. Keep the folder together when copying it to another computer. If a downloaded launcher is blocked by the operating system, open `index.html` directly.

## Teaching flow

1. **Establish:** authorize common and preferred shares, select par or stated value, and distinguish authorization from an accounting transaction.
2. **Issue shares:** choose common and preferred funding, allocate cash proceeds to stock and additional paid-in capital, and distinguish contributed capital from earnings.
3. **Earn and invest:** compare $24,000 of first-half income with $15,000 of operating cash, then decide whether to buy equipment.
4. **Repurchase:** buy back common shares using the cost method; trace issued, treasury, and outstanding shares and the consequences for EPS.
5. **Dividends:** allocate a cash distribution to preferred and common holders, then pause at declaration, record, and payment dates.
6. **Retained earnings:** calculate ending retained earnings from opening retained earnings, annual net income, and declared dividends.
7. **The final statements:** review the balance sheet, equity section, EPS, ROE, and payout. Compare debt and equity financing, then select all supported statements.

Students choose a proposal, answer the questions, and record the decision once every answer is correct. Incorrect answers receive hints and can be edited and checked again on the same page. Each meeting includes the figures students need. Business choices are not graded as universally right or wrong. Cash and retained earnings checks prevent unfunded repurchases or excessive dividends.

All recorded meetings can be revisited. **Revise this decision** returns to that point and clears later decisions' recorded effects and answers. Meeting tools includes saving and opening meeting files, printing a brief, and starting a new meeting. The final statements also offer a downloadable meeting brief. Account changes show each balance increasing or decreasing.

## Save and resume

The app opens on the welcome screen. Use the same browser and address and choose **Resume your meeting** to continue saved progress. **Start a new meeting** in Meeting tools clears the current meeting after confirmation and returns to the welcome screen. Private browsing, browser storage restrictions, moving the folder, or clearing browser data may remove that save. **Save meeting file** downloads a JSON backup; **Open meeting file** validates and restores one. No student identity is collected.

## Install as a browser app

Installation and service-worker caching require HTTPS or localhost. They are optional: direct file use already works offline.

With Node.js 18 or later installed, run `npm start`, visit `http://127.0.0.1:4173` (set `EXECUTIVE_PORT` to choose a different port), and use the browser's install option. On compatible Safari versions use File → Add to Dock. When hosted on GitHub Pages, the same install option is available. After one complete online load, the service worker caches the hosted app for offline use.

## GitHub Pages

- Live activity: https://cybercrs.github.io/executive-decisions/
- Repository: https://github.com/cybercrs/executive-decisions

This repository serves the app from its root on the `main` branch. The included launchers open `index.html` directly. The local server, package file, and test scripts are also included at the root. There is no build step.

Pages is configured to deploy from `main` / `(root)`. Updating the browser files on `main` triggers redeployment automatically. Keep the browser scripts and service worker together when updating the app.

All paths in the app are relative. It works under a repository subpath and needs no secrets, runtime dependencies, external fonts, analytics, APIs, or remote assets.

## Name and saved progress

The app, package, launchers, browser API, server messages, environment variables, and current offline cache use Executive Decisions. Older browser saves and offline caches remain recognized during an upgrade. The original save is retained, and subsequent work is saved under the Executive Decisions key. Existing JSON meeting backups remain importable.

Browser storage follows the app's address. Moving a directly opened local HTML file can change its storage location in some browsers; use a saved meeting file to transfer that progress. The GitHub Pages address remains the same.


## Accounting assumptions

- Common and preferred shares are issued January 1. Repurchases occur July 1, so annual weighted-average common shares use two equal six-month periods.
- Preferred shares have $20 par value, a $25 issue price, a noncumulative annual dividend preference of 5% of par ($1 per share), liquidation priority, and no voting rights. Declared distributions first meet the current preferred preference; the remainder is common dividends. No unpaid cumulative preference exists.
- Half-year net income is $24,000, operating cash generation is $15,000, and net receivables increase $9,000 in each half. These summarize operating activity. The optional $100,000 equipment purchase is an asset exchange; no case-year depreciation is assumed.
- Treasury stock is held at $15 repurchase cost and deducted from equity. No reissuance or retirement is included.
- Dividends are declared December 1, recorded for ownership December 15, and paid December 20. The dashboard displays retained earnings net of declared dividends, even before the temporary Dividends account is closed. Payment does not reduce equity again.
- Annual EPS subtracts declared preferred dividends from net income and uses weighted-average outstanding common shares. ROE uses average common book equity, excluding preferred contributed capital, measured after January 1 funding and at year-end. The payout ratio is common cash dividends declared divided by total net income.
- AOCI is zero. Dollar and ratio displays are rounded; calculations use full precision.
- The financing comparison is a separate next-year forecast with a $120,000 expansion, 8% debt interest, a $12 common issue price, 25% tax, and either $80,000 or $4,000 of operating income before interest and tax. Interest is deductible; dividends are not. Losses receive no current tax benefit. Both plans declare the annual preferred dividend. No common dividends or additional buybacks are assumed in that forecast. ROE uses average beginning and ending common equity after new-year funding.

## Developer checks

Run `npm test` with Node 18+ (no npm install required). `engine.js` contains the accounting model and state validation. `app.js` contains the interface and learning flow. Optional local serving uses only Node's standard library.

`browser-smoke.cjs` provides end-to-end browser checks when Playwright and Chromium are available. Run it with `NODE_PATH` pointing to a Playwright installation. It exercises the direct-file app and a localhost server, including refresh, dividend timing, revisions, imports/exports, responsive layout, offline caching, and migration of earlier saved progress. Set `EXECUTIVE_TEST_URL` to the running local server address; `EXECUTIVE_BROWSER` selects an installed Chromium channel. Temporary screenshots and test saves go to a uniquely named system temporary folder, or to `EXECUTIVE_TEST_RESULTS` when set.

The source summary informed the topic coverage. Its teaching tips are reference material, not instructions to fetch live companies or stock prices. All case amounts are fictional.
