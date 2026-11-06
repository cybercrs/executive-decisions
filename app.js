(function () {
  'use strict';
  const E = window.Boardroom;
  const KEY = 'boardroom-decisions-v1';
  const $ = s => document.querySelector(s);
  const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const num = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
  const pct = n => n === null ? '—' : `${(n * 100).toFixed(1)}%`;
  const dollars = n => n === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  let storageOK = true;
  let recovered = false;
  let state = E.initialState();
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) { const checked = E.validateState(JSON.parse(saved)); if (checked) state = checked; else recovered = true; }
  } catch (_) { storageOK = false; }
  let home = true;
  let toastTimer;
  const dates = ['January 1', 'January 1', 'June 30', 'July 1', 'December', 'December 31', 'December 31'];
  const headings = ['Give the company room to grow.', 'Bring in new shareholders.', 'Profit earned. Cash available.', 'Buy back a piece of the company.', 'Decide what shareholders receive.', 'Retained earnings', 'The final statements'];
  const descriptions = [
    'Riverbend Recreation is opening a community recreation center. Establish its share structure before investors contribute any money.',
    'Investors are ready to fund Riverbend. Choose a combination of common and preferred stock, then trace the proceeds into the accounts.',
    'The first half-year produced $24,000 of net income and $15,000 of operating cash. The remaining $9,000 is in net receivables. Decide whether to buy $100,000 of equipment for a second activity space.',
    'Management can repurchase common shares for $15 each. The shares will be held in treasury for possible future use.',
    'Recommend a cash distribution, including any preferred dividend. If management recommends a dividend, assume the board approves and declares it on December 1. Follow the dividend through payment.',
    'The second half-year adds another $24,000 of net income, $15,000 of cash, and $9,000 of net receivables. Use the full-year income and declared dividends to calculate ending retained earnings.',
    'Review Riverbend’s year-end statements. Then compare borrowing and issuing common stock to fund the next expansion.'
  ];
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageOK = true; }
    catch (_) { storageOK = false; }
    $('#save-status').textContent = storageOK ? 'Saved on this device' : 'Session only · save a meeting file';
    $('#storage-warning').hidden = storageOK;
  }
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
  }
  function modal(title, body, confirmLabel, onConfirm) {
    $('#dialog-content').innerHTML = `<h2>${title}</h2>${body}<div class="actions">${confirmLabel ? `<button class="button" id="dialog-confirm">${confirmLabel}</button>` : ''}<button class="button secondary" id="dialog-close">${confirmLabel ? 'Cancel' : 'Close'}</button></div>`;
    $('#dialog-close').onclick = () => $('#dialog').close();
    if (confirmLabel) $('#dialog-confirm').onclick = () => { $('#dialog').close(); onConfirm(); };
    $('#dialog').showModal();
  }
  function restart() {
    const reset = () => { state = E.initialState(); home = true; render(true); };
    if (state.started) modal('Start a new meeting?', '<p>This replaces the current meeting on this device. Use “Save meeting file” first if you want to keep it.</p>', 'Start new meeting', reset);
    else reset();
  }
  function field(key, label, options, help, disabled) {
    return `<div class="field"><label for="${key}">${label}</label><select id="${key}" data-decision="${key}" ${disabled ? 'disabled' : ''}>${options.map(([value, text]) => `<option value="${value}" ${String(state.decisions[key]) === String(value) ? 'selected' : ''}>${text}</option>`).join('')}</select>${help ? `<p class="help">${help}</p>` : ''}</div>`;
  }
  function metrics(items) { return `<div class="metrics-strip">${items.map(([label, value], i) => `<div class="metric ${i === 0 ? 'accent' : ''}"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>`; }
  function stageBase(i) { return { ...state, completed: i, stage: i, dividendPhase: i >= 5 ? 3 : 0 }; }
  function isRecorded(i) { return state.completed > i || (i === 4 && state.dividendPhase > 0); }
  function answerMatches(q, answer) {
    return q.multiple ? Array.isArray(answer) && answer.length === q.correct.length && q.correct.every(option => answer.includes(option)) : answer === q.correct;
  }
  function readAnswer(q, j) {
    const selected = [...document.querySelectorAll(`input[name="q${j}"]:checked`)].map(input => Number(input.value));
    return q.multiple ? selected : (selected[0] ?? -1);
  }
  function questionsPassed(i, qs = questions(i)) {
    const attempt = state.checks[i];
    return Boolean(attempt && qs.every((q, j) => attempt.results[j] === true && answerMatches(q, attempt.answers[j])));
  }
  const hints = [
    ['Distinguish permission to issue stock from the transaction that brings in investors’ money. Which one has happened?', 'Think about where par value comes from and what makes the price investors pay change.'],
    ['Work out the cash from each class separately. Which price will investors actually pay for each share?', 'Look at the common stock terms Riverbend chose when it was formed. Which amount per share belongs in Common Stock, and which belongs elsewhere?'],
    ['Which figure measures profit for the period? Compare it with the amount of cash the business collected.', 'List what Riverbend gives up and what it gets in return. Is either part of the purchase an expense at that point?'],
    ['Start with the shares issued in January. After the repurchase, who holds the shares Riverbend bought back?', 'Ask whether the company can report an ownership interest in itself as an asset. Where are its own shares reported?', 'Think about which part of earnings per share changes when a repurchase reduces the share count.'],
    ['Work out the preferred shareholders’ claim using their share count and terms. How much of the proposed distribution is left for common shareholders?', 'Separate the date the company commits to pay from the date cash leaves the company.', 'What obligation is already on the books immediately before the payment? Think about what the payment settles.'],
    ['Start with opening retained earnings. Which events change earnings kept in the business, and which just change cash or contributed capital?'],
    ['Check each statement against the year-end equity figures, the EPS calculation, or the financing comparison. What does each figure tell you about ownership, profit, or risk?']
  ];
  function numericQuestion(id, text, correct, alternatives, reason) {
    const values = [...new Set([...alternatives, correct])];
    let offset = 1;
    while (values.length < 3) { const extra = correct + 1000 * offset++; if (!values.includes(extra)) values.push(extra); }
    const pos = id.length % values.length;
    values.splice(values.indexOf(correct), 1); values.splice(pos, 0, correct);
    return { text, options: values.map(num), correct: values.indexOf(correct), reason };
  }
  function questions(i) {
    const d = state.decisions, b = stageBase(i), p = E.preview(b, i), now = E.snapshot(b);
    switch (i) {
      case 0: return [
        { text: 'What happens to assets and equity when 100,000 common shares are authorized?', options: ['Assets increase; equity increases.', 'Neither assets nor equity changes.', 'Equity increases; assets stay the same.'], correct: 1, reason: 'Authorization gives the company permission to issue shares. No investor has contributed an asset, so there is no account balances change.' },
        { text: 'Which statement about par value is correct?', options: ['It is the amount investors must pay in the market.', 'It changes whenever the market price changes.', 'It is an assigned amount, separate from the market price.'], correct: 2, reason: 'Par value is assigned in the charter. It does not determine the stock’s market price. No-par shares may be given a stated value.' }
      ];
      case 1: return [
        numericQuestion('proceeds', 'How much cash will the company receive in total (in dollars)?', p.commonProceeds + p.preferredProceeds, [d.commonShares + d.preferredShares * 20, p.commonProceeds], `${num(d.commonShares)} common shares × $12, plus ${num(d.preferredShares)} preferred shares × $25, brings in ${money(p.commonProceeds + p.preferredProceeds)}. All of it is contributed capital.`),
        numericQuestion('common-capital', 'By how much does the Common Stock account increase?', p.commonCapital, [d.capitalType === 'none' ? d.commonShares : p.commonProceeds, p.commonCapital + 24000], d.capitalType === 'none' ? `Without par or stated value, the full ${money(p.commonProceeds)} common proceeds go to Common Stock.` : `${num(d.commonShares)} common shares × $1 ${d.capitalType === 'par' ? 'par' : 'stated'} value = ${money(p.commonCapital)} in Common Stock. The remaining ${money(p.commonAPIC)} goes to additional paid-in capital.`)
      ];
      case 2: return [
        numericQuestion('earned-capital', 'Before any dividends, how much does first-half net income add to retained earnings?', 24000, [15000, d.investment], 'Net income increases retained earnings by $24,000. The $15,000 operating cash increase is different because $9,000 remains in net receivables.'),
        { text: 'What is the immediate effect of buying equipment with cash?', options: ['Cash and retained earnings both decrease.', 'Cash decreases and equipment increases; total equity is unchanged.', 'Equipment and contributed capital both increase.'], correct: 1, reason: 'The company exchanges cash for equipment. The purchase is an asset exchange, not an immediate expense. No depreciation is assumed during this case year.' }
      ];
      case 3: return [
        numericQuestion('outstanding', 'How many common shares will be outstanding after this decision?', p.outstanding, [now.commonIssued, E.CASE.authorized - d.buybackShares], `${num(p.commonIssued)} issued shares − ${num(p.treasuryShares)} treasury shares = ${num(p.outstanding)} outstanding shares. Issued shares remain ${num(p.commonIssued)}.`),
        { text: 'Where does the cost of repurchased shares belong?', options: ['An investment asset.', 'An expense that reduces net income.', 'Treasury Stock, deducted within stockholders’ equity.'], correct: 2, reason: `Under the cost method, ${money(p.treasuryCost)} is held in Treasury Stock as a reduction of equity. Common Stock and retained earnings are not reduced by the purchase.` },
        { text: 'If a repurchase reduces weighted-average common shares while profit stays unchanged, what happens to EPS?', options: ['EPS can increase without an improvement in operating profit.', 'EPS must decrease because cash decreased.', 'The repurchase creates additional net income.'], correct: 0, reason: 'EPS divides income available to common shareholders by weighted-average outstanding common shares. A smaller denominator can raise EPS even when the company has earned no additional profit.' }
      ];
      case 4: return [
        numericQuestion('common-dividend', 'How much of this total distribution goes to common shareholders?', p.commonDividends, [d.dividend, d.preferredShares * 20 * .05], `Preferred shareholders receive the first ${money(p.preferredDividends)} of the distribution. Common shareholders receive ${money(p.commonDividends)}, allocated across ${num(p.outstanding)} outstanding common shares. Treasury shares receive none.`),
        { text: 'When a cash dividend is declared, which effect is recorded?', options: ['Cash decreases immediately; equity stays the same.', 'A liability increases and equity decreases; cash stays the same.', 'A liability increases on the record date only.'], correct: 1, reason: 'Declaring a dividend increases Dividends Payable and reduces retained earnings. Cash is unchanged until payment. With a zero distribution, no dividend is declared and no balances change.' },
        { text: 'What happens when the declared cash dividend is paid?', options: ['Retained earnings decreases a second time.', 'Cash decreases and Dividends Payable increases.', 'Cash and Dividends Payable decrease; equity does not change again.'], correct: 2, reason: 'Payment settles the existing obligation. The reduction of equity was recognized at declaration, so it is not recorded again. No account balances change on the record date.' }
      ];
      case 5: return [
        numericQuestion('ending-retained', 'What is ending retained earnings?', now.retained, [now.income, now.cash], `$0 opening retained earnings + ${money(now.income)} net income − ${money(now.dividends)} declared dividends = ${money(now.retained)} ending retained earnings.`)
      ];
      default: return [{
        text: 'Which statements are supported by the final statements and financing comparison? Select all that apply.',
        multiple: true,
        options: [
          'Earnings per common share accounts for how long each common share count was outstanding.',
          'Borrowing reduces the existing common shareholders’ voting stake.',
          'Treasury stock reduces reported stockholders’ equity by the cost of the repurchased shares.',
          'Cash dividends are an expense that reduces annual net income.',
          'If management’s priority is to avoid required interest in a weak year, issuing common stock fits that priority.',
          'Higher earnings per share alone show that borrowing is the safer financing choice.'
        ],
        correct: [0, 2, 4],
        reason: 'EPS uses weighted-average shares, and treasury stock is deducted at cost. Issuing shares avoids required interest but dilutes existing ownership. Cash dividends are distributions, and EPS alone does not measure financing risk.'
      }];
    }
  }
  function quiz(i) {
    const attempt = state.checks[i], recorded = isRecorded(i), qs = questions(i), passed = questionsPassed(i, qs);
    if (recorded && !attempt) return '';
    const feedback = (q, j) => {
      if (attempt?.results[j] === false) return `<div class="feedback wrong"><strong>Try again</strong><p>${i === 1 && j === 1 && state.decisions.capitalType === 'none' ? 'Riverbend chose common shares with neither par nor stated value. Is there an assigned amount to separate from the issue price?' : hints[i][j]}</p></div>`;
      if (attempt?.results[j] === true) return `<div class="feedback"><strong>Correct</strong>${passed ? `<p>${q.reason}</p>` : ''}</div>`;
      return '';
    };
    return `<section class="questions" aria-labelledby="questions-title"><h3 id="questions-title">${i === 6 ? 'Interpret the results' : 'Questions'}</h3><form id="questions-form">${qs.map((q, j) => `<fieldset class="question"><legend>${j + 1}. ${q.text}</legend><div class="choices">${q.options.map((o, k) => `<label class="choice"><input type="${q.multiple ? 'checkbox' : 'radio'}" id="q${j}-${k}" name="q${j}" value="${k}" ${(q.multiple ? attempt?.answers[j]?.includes?.(k) : attempt?.answers[j] === k) ? 'checked' : ''} ${recorded ? 'disabled' : ''}><span>${o}</span></label>`).join('')}</div>${feedback(q, j)}</fieldset>`).join('')}<div id="quiz-error" role="alert"></div>${!recorded && !passed ? '<button type="submit" class="button secondary">Check answers</button>' : ''}</form></section>`;
  }
  function changeList(title, changes, note = '') {
    return `<section class="change-list"><h4>${title}</h4>${changes.length ? `<ul>${changes.map(([account, amount]) => `<li><span>${account}</span><strong>${amount > 0 ? 'Increases' : 'Decreases'} by ${money(Math.abs(amount))}</strong></li>`).join('')}</ul>` : '<p>No account balances change.</p>'}${note ? `<p>${note}</p>` : ''}</section>`;
  }
  function accountEffects(i) {
    const d = state.decisions, p = E.preview(stageBase(i), i);
    let html = '';
    if (i === 0) html = changeList('Share authorization', [], 'Authorizing shares gives Riverbend permission to issue them.');
    if (i === 1) {
      const common = [['Cash', p.commonProceeds], ['Common Stock', p.commonCapital]];
      if (p.commonAPIC) common.push(['Additional Paid-in Capital—Common', p.commonAPIC]);
      html = changeList('Common shares issued', common);
      if (p.preferredIssued) html += changeList('Preferred shares issued', [['Cash', p.preferredProceeds], ['Preferred Stock', p.preferredCapital], ['Additional Paid-in Capital—Preferred', p.preferredAPIC]]);
    }
    if (i === 2) {
      html = changeList('First-half operating results', [['Cash', E.CASE.halfCash], ['Net Receivables', E.CASE.halfIncome - E.CASE.halfCash], ['Retained Earnings', E.CASE.halfIncome]]);
      if (d.investment) html += changeList('Equipment purchase', [['Equipment', d.investment], ['Cash', -d.investment]]);
    }
    if (i === 3) html = d.buybackShares ? changeList('Share repurchase', [['Treasury Stock', p.treasuryCost], ['Cash', -p.treasuryCost]], 'Treasury Stock is deducted from stockholders’ equity. Common Stock does not change.') : changeList('No share repurchase', []);
    if (i === 4) {
      if (!d.dividend) html = changeList('No dividend declared', []);
      else {
        html = changeList('December 1 · Declaration', [['Dividends Payable', d.dividend], ['Retained Earnings', -d.dividend]], 'Cash does not change until payment.');
        if (state.dividendPhase >= 2) html += changeList('December 15 · Record date', []);
        if (state.dividendPhase >= 3) html += changeList('December 20 · Payment', [['Dividends Payable', -d.dividend], ['Cash', -d.dividend]], 'Retained Earnings does not decrease again.');
      }
    }
    if (i === 5) html = changeList('Second-half operating results', [['Cash', E.CASE.halfCash], ['Net Receivables', E.CASE.halfIncome - E.CASE.halfCash], ['Retained Earnings', E.CASE.halfIncome]]);
    return `<details class="account-effects"><summary>View account changes</summary>${html}</details>`;
  }
  function sidebar() {
    const s = E.snapshot(state, state.stage === 4 ? { yearEnd: false } : {});
    const showRetained = !s.yearEnd || state.completed !== 5 || questionsPassed(5);
    const shareWidth = (n) => s.authorized ? n / s.authorized * 100 : 0;
    const snapshotDate = s.yearEnd ? 'December 31' : state.dividendPhase ? ['', 'December 1', 'December 15', 'December 20'][state.dividendPhase] : ['Before formation', 'January 1', 'January 1', 'June 30', 'July 1'][Math.min(state.completed, 4)];
    const row = (label, amount) => `<div><dt>${label}</dt><dd>${amount}</dd></div>`;
    const group = (label, rows) => `<h3>${label}</h3><dl class="dashboard-list">${rows.join('')}</dl>`;
    return `<aside class="sidebar" aria-label="Current company position" tabindex="0">
      <div class="sidebar-top"><p class="eyebrow">Company now · ${snapshotDate}</p><strong>${money(s.equity)}</strong><span>Total stockholders’ equity</span></div>
      <div class="sidebar-body">
        <section class="sidebar-balance-sheet" aria-label="Balance sheet">
          ${group('Assets', [row('Cash', money(s.cash)), row('Net receivables', money(s.receivables)), row('Equipment', money(s.equipment))])}
          ${group('Liabilities', [row('Dividends payable', money(s.payable))])}
          ${group('Stockholders’ equity', [
            row('Common stock', money(s.commonCapital)),
            row('Additional paid-in capital—common', money(s.commonAPIC)),
            row('Preferred stock', money(s.preferredCapital)),
            row('Additional paid-in capital—preferred', money(s.preferredAPIC)),
            ...(showRetained ? [row(`Retained earnings${s.dividends ? '¹' : ''}`, money(s.retained))] : []),
            row('Less: Treasury Stock', s.treasuryCost ? `(${money(s.treasuryCost)})` : '$0')
          ])}
          <div class="equation">Assets <strong>${money(s.assets)}</strong> = liabilities <strong>${money(s.payable)}</strong> + stockholders’ equity <strong>${money(s.equity)}</strong></div>
        </section>
        <hr class="sidebar-divider income-divider">
        <dl class="dashboard-list sidebar-income">${row('Net income to date', money(s.income))}</dl>
        <hr class="sidebar-divider">
        <p class="eyebrow" style="color:var(--muted);margin-bottom:8px">Common share map</p>
        <div class="share-bar" aria-hidden="true"><span class="held" style="width:${shareWidth(s.outstanding)}%"></span><span class="treasury" style="width:${shareWidth(s.treasuryShares)}%"></span></div>
        <div class="share-key"><span>Outstanding</span><span class="treasury">Treasury</span><span class="unissued">Unissued</span></div>
        <dl class="dashboard-list">${row('Authorized', num(s.authorized))}${row('Issued', num(s.commonIssued))}${row('Treasury', num(s.treasuryShares))}${row('Outstanding', num(s.outstanding))}${row('Unissued', num(s.unissued))}</dl>
        <details><summary>Trace the balances</summary><p>Issued − treasury = outstanding. Authorized − issued = unissued.</p>${showRetained && s.dividends ? '<p>¹ Net of dividends declared.</p>' : ''}${s.preferredIssued ? `<p>${num(s.preferredIssued)} preferred shares are tracked separately from common shares.</p>` : ''}</details>
      </div>
    </aside>`;
  }
  function welcome() {
    return `<main class="welcome" id="main" tabindex="-1"><div class="welcome-grid"><section><p class="eyebrow">Riverbend Recreation</p><h1>Every decision<br>changes <span>the story.</span></h1><p class="intro">You’re part of the executive management team at Riverbend Recreation. Decide how to raise capital, invest earnings, and repurchase shares, then recommend a dividend.</p><p class="intro">Follow one company through a year. Answer questions about your decisions, then explain what the numbers mean.</p><div class="actions"><button class="button red" data-action="${state.started ? 'resume' : 'start'}">${state.started ? 'Resume your meeting' : 'Start the meeting'} <span aria-hidden="true">→</span></button></div></section><div class="welcome-art" aria-label="Year-end report topics"><div class="report-cover"><p class="eyebrow">Riverbend Recreation</p><h2>Your first year<br>in management.</h2><p>Year-end equity review</p><hr class="report-rule"><div class="cover-numbers"><div><strong>Capital</strong><span>Raise funds</span></div><div><strong>Cash</strong><span>Manage distributions</span></div><div><strong>Equity</strong><span>Report results</span></div></div></div><div class="cover-tag"><strong>Higher EPS. A stronger company?</strong>Find the decisions behind the result.</div></div></div><div class="journey-preview"><div><span class="number">01 / OWNERSHIP</span><h3>Build the capital base.</h3><p>Separate share authorization, investor contributions, and earnings.</p></div><div><span class="number">02 / CONSEQUENCES</span><h3>Follow the changes.</h3><p>Track cash, shares, liabilities, and equity through each decision.</p></div><div><span class="number">03 / JUDGMENT</span><h3>Make the case.</h3><p>Interpret the ratios and weigh the next financing decision.</p></div></div></main>`;
  }
  function decisionPanel(i) {
    const d = state.decisions;
    const locked = isRecorded(i);
    let fields = '', extra = '';
    if (i === 0) {
      fields = field('capitalType', 'Common stock structure', [['par', '$1 par value'], ['stated', 'No par · $1 stated value'], ['none', 'No par · no stated value']], 'Choose the share structure management will propose before issuing stock.', locked);
      extra = metrics([['Common shares authorized', '100,000'], ['Preferred authorized', '10,000'], ['Assets contributed', '$0']]);
    } else if (i === 1) {
      fields = field('commonShares', 'Common shares to issue', E.CHOICES.commonShares.map(v => [v, `${num(v)} shares at $12`]), 'Issued January 1. Common shares carry voting rights.', locked) + field('preferredShares', 'Preferred shares to issue', E.CHOICES.preferredShares.map(v => [v, `${num(v)} shares at $25`]), '$20 par value. The amount above par is additional paid-in capital.', locked);
      const commonTerms = { par: '$1 par value per share', stated: '$1 stated value per share', none: 'No par or stated value' };
      extra = `<p class="terms"><strong>Common stock terms chosen at formation:</strong> ${commonTerms[d.capitalType]}.</p><p>Preferred terms: 5% of $20 par value, or $1 per share annually, with priority over common dividends and assets on liquidation. These shares are noncumulative and have no voting rights.</p>`;
    } else if (i === 2) {
      fields = field('investment', 'Equipment investment', [[0, 'Keep the cash · no equipment purchase'], [100000, 'Buy equipment · $100,000']], 'The equipment is ready at midyear. No depreciation is assumed during this case year.', locked);
      extra = metrics([['First-half net income', '$24,000'], ['Operating cash generated', '$15,000'], ['Net receivables added', '$9,000']]);
    } else if (i === 3) {
      const before = E.snapshot(stageBase(3));
      fields = field('buybackShares', 'Common shares to repurchase', E.CHOICES.buybackShares.map(v => [v, v ? `${num(v)} shares · ${money(v * 15)}` : 'No repurchase']), '$15 per share, paid July 1. The shares stay issued and are held in treasury.', locked);
      extra = metrics([['Cash before repurchase', money(before.cash)], ['Common shares issued', num(before.commonIssued)], ['Cost per share', '$15']]);
    } else if (i === 4) {
      const before = E.snapshot(stageBase(4));
      fields = field('dividend', 'Total cash dividend', E.CHOICES.dividend.map(v => [v, v ? money(v) : 'Retain all earnings · $0']), 'This is the total distribution to preferred and common shareholders together.', locked);
      extra = metrics([['Cash available', money(before.cash)], ['Retained earnings', money(before.retained)], ['Outstanding common shares', num(before.outstanding)]]) + `<p class="terms"><strong>Preferred stock from January:</strong> ${num(before.preferredIssued)} shares outstanding with an annual preference of $1 per share. If a dividend is declared, preferred shareholders receive their annual preference first; the remainder goes to common shareholders in proportion to their outstanding shares.</p>`;
      extra += dividendAllocation();
    }
    return `<section class="decision"><div class="section-title"><h3>Your management decision</h3><span class="label">${locked ? 'Recorded proposal' : 'Choose a proposal'}</span></div><div class="field-grid">${fields}</div>${extra}<div id="decision-error" role="alert"></div></section>`;
  }
  function dividendAllocation() {
    const s = state.dividendPhase > 0 ? E.snapshot(state) : questionsPassed(4) ? E.preview(stageBase(4)) : null;
    return `<section aria-labelledby="dividend-breakdown"><h4 class="terms" id="dividend-breakdown">Dividend breakdown</h4>${metrics([['Preferred shareholders', s ? money(s.preferredDividends) : '?'], ['Common shareholders', s ? money(s.commonDividends) : '?'], ['Per outstanding common share', s ? `$${s.commonDividendPerShare.toFixed(4)}` : '?']])}${s?.dividends ? `<p class="muted" style="font-size:.8rem">An investor holding ${num(s.outstanding / 100)} common shares owns 1% of the outstanding common stock and receives 1% of the common dividend: ${money(s.commonDividends / 100)}.</p>` : ''}</section>`;
  }
  function timeline() {
    const phase = state.dividendPhase;
    const d = state.decisions.dividend;
    let event = '';
    if (phase === 1) event = d ? `<h3>The dividend is declared.</h3><p>Dividends Payable increases by ${money(d)}. Equity decreases by ${money(d)}. Cash is unchanged.</p>` : '<h3>Management chooses to retain all earnings.</h3><p>No dividend is declared, so no liability or equity change is recorded.</p>';
    if (phase === 2) event = d ? '<h3>The record date identifies recipients.</h3><p>Dividends Payable, cash, and equity remain unchanged.</p>' : '<h3>No distribution is pending.</h3><p>No account balances change.</p>';
    if (phase === 3) event = d ? `<h3>The dividend has been paid.</h3><p>Cash and Dividends Payable both decrease by ${money(d)}. Equity does not decrease again.</p>` : '<h3>No dividend payment is made.</h3><p>Cash and equity remain unchanged.</p>';
    return `<div class="timeline" aria-label="Dividend timeline">${[['December 1', 'Declaration'], ['December 15', 'Record date'], ['December 20', 'Payment']].map(([date, label], j) => `<div class="timeline-step ${phase === j + 1 ? 'current' : phase > j + 1 ? 'complete' : ''}">${date}<strong>${label}</strong>${phase > j + 1 ? 'Completed' : phase === j + 1 ? 'Current date' : 'Upcoming'}</div>`).join('')}</div>${phase ? `<div class="event-reveal" role="status">${event}</div>` : ''}`;
  }
  function balanceSheet() {
    const s = E.snapshot(stageBase(6));
    const rows = [
      ['Cash', s.cash], ['Net receivables', s.receivables], ['Equipment', s.equipment], ['Total assets', s.assets, true],
      ['Total liabilities', s.payable], ['Total stockholders’ equity', s.equity], ['Total liabilities and stockholders’ equity', s.payable + s.equity, true]
    ];
    return `<section class="statement" aria-label="Year-end balance sheet"><div class="statement-caption"><h3>Riverbend Recreation</h3><p>Balance sheet · December 31</p></div><table><tbody>${rows.map(([label, amount, total]) => `<tr class="${total ? 'total' : ''}"><td>${label}</td><td>${money(amount)}</td></tr>`).join('')}</tbody></table></section>`;
  }
  function equityReport() {
    const s = E.snapshot({ ...state, completed: E.STAGES.length, dividendPhase: 3 });
    const d = state.decisions;
    const commonDescription = d.capitalType === 'par' ? '$1 par value' : d.capitalType === 'stated' ? 'No par; $1 stated value' : 'No par or stated value';
    const row = (label, value, cls = '', sub = '') => `<tr class="${cls}"><td>${label}${sub ? `<span class="subtext">${sub}</span>` : ''}</td><td>${value}</td></tr>`;
    return `<section class="statement" aria-label="Year-end stockholders’ equity"><div class="statement-caption"><h3>Riverbend Recreation</h3><p>Stockholders’ equity · December 31</p></div><table><tbody><tr class="group"><td colspan="2">Contributed capital</td></tr>${s.preferredIssued ? row('Preferred Stock', money(s.preferredCapital), '', `$20 par; ${num(s.preferredIssued)} issued and outstanding`) + row('Additional paid-in capital—preferred', money(s.preferredAPIC)) : ''}${row('Common Stock', money(s.commonCapital), '', `${commonDescription}; ${num(s.authorized)} authorized, ${num(s.commonIssued)} issued, ${num(s.outstanding)} outstanding`)}${s.commonAPIC ? row(`Additional paid-in capital—common`, money(s.commonAPIC)) : ''}${row('Total contributed capital', money(s.paidIn), 'group')}${row('Retained earnings', money(s.retained))}${row('Accumulated other comprehensive income', '$0')}${row('Less: Treasury Stock', s.treasuryCost ? `(${money(s.treasuryCost)})` : '$0', '', `${num(s.treasuryShares)} common shares held at cost`)}${row('Total stockholders’ equity', money(s.equity), 'total')}</tbody></table></section><div class="ratio-grid"><article class="ratio"><h4>Earnings per common share</h4><strong>${dollars(s.eps)}</strong><p>Annual income available to each weighted-average common share.</p><details><summary>See the calculation</summary><p>(${money(s.income)} net income − ${money(s.preferredDividends)} preferred dividends) ÷ ${num(s.averageShares)} weighted-average shares.</p><p>${num(s.commonIssued)} × 6/12 + ${num(s.outstanding)} × 6/12 = ${num(s.averageShares)}.</p></details></article><article class="ratio"><h4>Return on common equity</h4><strong>${pct(s.roe)}</strong><p>Income available to common shareholders relative to their average book equity.</p><details><summary>See the calculation</summary><p>${money(s.commonIncome)} ÷ ${money(s.averageCommonEquity)} average common equity.</p><p>Beginning common equity after January 1 funding: ${money(s.beginningCommonEquity)}. Ending: ${money(s.commonEquity)}. Preferred contributed capital is excluded.</p></details></article><article class="ratio"><h4>Common dividend payout</h4><strong>${pct(s.payout)}</strong><p>The share of net income declared as common cash dividends.</p><details><summary>See the calculation</summary><p>${money(s.commonDividends)} common dividends ÷ ${money(s.income)} net income.</p><p>A lower payout may support growth or reflect a need to preserve cash. The surrounding evidence matters.</p></details></article></div>`;
  }
  function forecastPanel() {
    const plans = E.financing(state), [debt, equity] = plans;
    const compare = (label, key, format, emphasis = false) => `<tr class="${emphasis ? 'emphasis' : ''}"><td>${label}</td><td>${format(debt[key])}</td><td>${format(equity[key])}</td></tr>`;
    return `<section class="forecast" aria-labelledby="forecast-title"><p class="eyebrow">Next year · an alternative future</p><h3 id="forecast-title">How should the next expansion be financed?</h3><p class="intro">Riverbend needs $120,000. Compare borrowing at 8% with issuing 10,000 new common shares at $12. Both plans fund the same expansion on January 1.</p><div class="segmented" role="group" aria-label="Operating forecast"><button data-forecast="strong" class="${state.forecast === 'strong' ? 'active' : ''}" aria-pressed="${state.forecast === 'strong'}">Strong earnings</button><button data-forecast="weak" class="${state.forecast === 'weak' ? 'active' : ''}" aria-pressed="${state.forecast === 'weak'}">Weak earnings</button></div><div class="comparison-wrap"><table class="comparison"><thead><tr><th scope="col">Next-year forecast</th><th scope="col">Borrow $120,000</th><th scope="col">Issue common stock</th></tr></thead><tbody>${compare('Operating income before interest & tax', 'ebit', money)}${compare('Required annual interest', 'interest', money)}${compare('Income tax expense', 'tax', money)}${compare('Net income', 'netIncome', money)}${compare('Preferred dividends declared', 'preferredDividend', money)}${compare('New common shares', 'newShares', num)}${compare('Common shares outstanding all year', 'shares', num)}${compare('Existing common holders’ voting stake', 'existingOwnership', pct)}${compare('Earnings per common share', 'eps', dollars, true)}${compare('Return on common equity', 'roe', pct, true)}</tbody></table></div><div class="event-reveal"><h3>${state.forecast === 'strong' ? 'Compare the return with the commitment.' : 'The interest commitment stays.'}</h3><p>${state.forecast === 'strong' ? 'Debt can increase common returns when operating results support the interest cost. Existing common holders keep their voting percentage, while the company takes on required interest and principal repayment.' : 'Operating income is only $4,000, while annual interest remains $9,600 under the debt plan. Review the loss, cash demands, and solvency risk before recommending a financing choice.'}</p></div><details><summary>Forecast assumptions and ROE calculations</summary><p>For next year, the tax rate is 25%; interest is deductible and dividends are not. Losses receive no current tax benefit. Both plans declare the $1 annual preferred dividend per share. No common dividends or further repurchases are assumed. All new common shares are outstanding for the full year.</p><p>ROE uses income available to common shareholders divided by average common equity, after January 1 funding. Borrowing: ${money(debt.commonIncome)} ÷ ${money(debt.averageEquity)}. Stock issuance: ${money(equity.commonIncome)} ÷ ${money(equity.averageEquity)}.</p></details></section>`;
  }
  function reviewSummary() {
    return `<section class="finished-banner"><p class="eyebrow">Meeting complete</p><h3>Your decisions have a paper trail.</h3><p>Revisit a decision to trace its effects or explore another path.</p><button class="button secondary" data-action="export">Save this meeting</button> <button class="button quiet" data-action="brief">Download meeting brief</button></section>`;
  }
  function yearEndFacts() {
    const s = E.snapshot(stageBase(5));
    return `<section class="decision" aria-labelledby="year-end-facts"><div class="section-title"><h3 id="year-end-facts">Year-end figures</h3></div>${metrics([['Opening retained earnings', '$0'], ['Full-year net income', money(s.income)], ['Total cash dividends declared', money(s.dividends)]])}</section>`;
  }
  function workspace() {
    const i = state.stage, passed = questionsPassed(i), recorded = isRecorded(i);
    let content = '';
    if (recorded) content += `<div class="recorded"><span class="checkmark" aria-hidden="true">✓</span><p>${i === 4 && state.completed === 4 ? 'The dividend decision is recorded. Continue through the dates below.' : 'This meeting is recorded. You can review it or revise this decision.'}</p><button class="button quiet small" data-action="revise">Revise this decision</button></div>`;
    if (i < 5) content += decisionPanel(i);
    else if (i === 5) content += yearEndFacts();
    else content += balanceSheet() + equityReport() + forecastPanel();
    if (i === 4) content += timeline();
    if (!(i === 4 && state.dividendPhase > 0)) content += recorded && state.checks[i] ? `<details class="questions-history"><summary>Review your answers</summary>${quiz(i)}</details>` : quiz(i);
    if (i < 6 && (passed || recorded)) content += accountEffects(i);
    if (i === 6 && state.completed === E.STAGES.length) content += reviewSummary();
    let action = '';
    if (i === 4 && state.completed === 4) {
      const labels = ['Record declaration date', 'Advance to record date', 'Advance to payment date'];
      action = `<button class="button" data-action="dividend" ${!passed && state.dividendPhase === 0 ? 'disabled' : ''}>${labels[state.dividendPhase]} <span aria-hidden="true">→</span></button>${state.dividendPhase === 0 && !passed ? '<span class="hint">Answer all questions correctly to continue.</span>' : ''}`;
    } else if (!recorded) {
      action = `<button class="button" data-action="commit" ${!passed ? 'disabled' : ''}>${i === 6 ? 'Finish the meeting' : 'Record & continue'} <span aria-hidden="true">→</span></button>${!passed ? '<span class="hint">Answer all questions correctly to continue.</span>' : ''}`;
    } else if (i < E.STAGES.length - 1) action = `<button class="button secondary" data-action="next">Continue to ${E.STAGES[i + 1].toLowerCase()} <span aria-hidden="true">→</span></button>`;
    content += `<div class="round-actions">${action}</div>`;
    return `<div class="workspace"><div class="company-bar"><div class="company-title">Riverbend Recreation <span>Community recreation, shared ownership.</span></div><span class="meeting-label">Part ${String(i + 1).padStart(2, '0')} of ${String(E.STAGES.length).padStart(2, '0')}</span></div><nav class="stage-nav" aria-label="Management meetings">${E.STAGES.map((name, j) => `<button data-stage="${j}" class="${i === j ? 'active' : state.completed > j ? 'done' : ''}" ${j > state.completed ? 'disabled' : ''} ${i === j ? 'aria-current="step"' : ''}><span class="step-no">${state.completed > j && i !== j ? '✓' : `0${j + 1}`}</span>${name}</button>`).join('')}</nav><div class="meeting-grid"><main class="meeting-main" id="main" tabindex="-1"><header class="meeting-heading"><p class="eyebrow">${E.STAGES[i]}<span class="date-chip">${dates[i]}</span></p><h2>${headings[i]}</h2><p>${descriptions[i]}</p></header>${content}</main>${sidebar()}</div></div>`;
  }
  function fitSidebar() {
    const sidebar = $('.sidebar');
    if (!sidebar || !window.matchMedia('(min-width: 801px)').matches) return;
    const top = Math.max(20, sidebar.parentElement.getBoundingClientRect().top);
    const height = `${Math.max(0, Math.floor(window.innerHeight - top - 20))}px`;
    if (sidebar.style.getPropertyValue('--sidebar-height') !== height) sidebar.style.setProperty('--sidebar-height', height);
  }
  function render(moveFocus = false, focusId = '') {
    const sidebarScroll = $('.sidebar')?.scrollTop ?? 0;
    $('#app').innerHTML = home ? welcome() : workspace();
    $('#app-menu').hidden = true; $('#menu-button').setAttribute('aria-expanded', 'false');
    bindContent(); save();
    const nav = document.querySelector('.stage-nav'), active = nav?.querySelector('.active');
    if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
    if (moveFocus) { $('#main')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
    fitSidebar();
    if (!moveFocus && $('.sidebar')) $('.sidebar').scrollTop = sidebarScroll;
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  }
  function showDecisionError(message) {
    let target = $('#decision-error') || $('#quiz-error');
    if (target) {
      const notice = document.createElement('p');
      notice.className = 'form-error';
      notice.textContent = message;
      target.replaceChildren(notice);
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    else toast(message);
  }
  function bindContent() {
    document.querySelectorAll('[data-action]').forEach(el => el.onclick = () => action(el.dataset.action));
    document.querySelectorAll('[data-stage]').forEach(el => el.onclick = () => { state.stage = Number(el.dataset.stage); render(true); });
    document.querySelectorAll('[data-decision]').forEach(el => el.onchange = () => {
      const key = el.dataset.decision;
      state.decisions[key] = key === 'capitalType' ? el.value : Number(el.value);
      delete state.checks[state.stage]; render(false, key);
    });
    document.querySelectorAll('[data-forecast]').forEach(el => el.onclick = () => {
      state.forecast = el.dataset.forecast;
      const draft = [...document.querySelectorAll('#questions-form input[type="checkbox"]:checked')].map(input => input.id);
      const top = window.scrollY; render(); window.scrollTo(0, top);
      for (const id of draft) document.getElementById(id).checked = true;
      document.querySelector(`[data-forecast="${state.forecast}"]`)?.focus({ preventScroll: true });
    });
    $('#questions-form')?.addEventListener('change', e => {
      const input = e.target;
      if (!input.matches('input[type="radio"], input[type="checkbox"]') || isRecorded(state.stage)) return;
      const attempt = state.checks[state.stage];
      if (!attempt) return;
      const j = Number(input.name.slice(1)), passed = questionsPassed(state.stage);
      attempt.answers[j] = readAnswer(questions(state.stage)[j], j);
      attempt.results[j] = null;
      if (passed) render(false, input.id);
      else { input.closest('fieldset')?.querySelector('.feedback')?.remove(); save(); }
    });
    $('#questions-form')?.addEventListener('submit', e => {
      e.preventDefault();
      if (isRecorded(state.stage)) return;
      const error = E.decisionError(state);
      if (error) return showDecisionError(error);
      const qs = questions(state.stage), answers = qs.map(readAnswer);
      const missing = answers.findIndex(answer => answer === -1 || (Array.isArray(answer) && !answer.length));
      if (missing >= 0) { $('#quiz-error').innerHTML = '<p class="form-error">Choose an answer for each question.</p>'; document.querySelector(`input[name="q${missing}"]`)?.focus(); return; }
      state.checks[state.stage] = { answers, results: qs.map((q, j) => answerMatches(q, answers[j])) };
      const top = window.scrollY; render(); window.scrollTo(0, top);
      const review = document.querySelector('.feedback.wrong') || document.querySelector('.feedback');
      if (review) { review.setAttribute('tabindex', '-1'); review.focus({ preventScroll: true }); review.scrollIntoView({ block: 'center', behavior: 'instant' }); }
    });
  }
  function action(name) {
    $('#app-menu').hidden = true; $('#menu-button').setAttribute('aria-expanded', 'false');
    if (name === 'start') { state.started = true; home = false; return render(true); }
    if (name === 'resume') { home = false; return render(true); }
    if (name === 'restart') return restart();
    if (name === 'next') { state.stage = Math.min(state.stage + 1, state.completed, E.STAGES.length - 1); return render(true); }
    if (name === 'revise') return modal('Revise this decision?', '<p>You’ll need to complete this and later parts again.</p>', 'Revise decision', () => { state = E.rewind(state, state.stage); render(true); });
    if (name === 'commit') {
      if (!questionsPassed(state.stage)) return;
      try { state = E.commit(state); render(true); } catch (e) { showDecisionError(e.message); }
      return;
    }
    if (name === 'dividend') {
      if (!questionsPassed(4) && state.dividendPhase === 0) return;
      try {
        const phase = state.dividendPhase;
        state = E.advanceDividend(state);
        state.stage = 4;
        render();
        (phase === 0 ? $('.event-reveal') : $('#dividend-breakdown') || $('.timeline'))?.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      catch (e) { showDecisionError(e.message); }
      return;
    }
    if (name === 'export') { download('Riverbend meeting.json', JSON.stringify(state, null, 2), 'application/json'); return; }
    if (name === 'import') return $('#import-file').click();
    if (name === 'brief') return download('Riverbend meeting brief.txt', meetingBrief(), 'text/plain');
    if (name === 'print') {
      if (state.completed < 6) return modal('The final statements are not ready yet.', '<p>Complete Part 06 to view and print the final statements.</p>');
      state.stage = 6; home = false; render(); window.print(); return;
    }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Meeting file prepared for download.');
  }
  function meetingBrief() {
    const s = E.snapshot(state), d = state.decisions, plans = state.completed >= 6 ? E.financing(state) : [];
    return ['RIVERBEND RECREATION — EXECUTIVE DECISIONS', `Completed parts: ${state.completed} of ${E.STAGES.length}`, '',
      `Common stock structure: ${d.capitalType === 'par' ? '$1 par' : d.capitalType === 'stated' ? '$1 stated value' : 'No par or stated value'}`,
      `Cash: ${money(s.cash)}`, `Dividends payable: ${money(s.payable)}`, `Contributed capital: ${money(s.paidIn)}`,
      `Retained earnings after declared dividends: ${money(s.retained)}`, `Treasury stock at cost: ${money(s.treasuryCost)}`,
      `Total equity: ${money(s.equity)}`, `Common shares issued: ${num(s.commonIssued)}`, `Common shares outstanding: ${num(s.outstanding)}`,
      `Net income to date: ${money(s.income)}`, ...(s.yearEnd ? [`Annual EPS: ${dollars(s.eps)}`, `Annual ROE: ${pct(s.roe)}`, `Common dividend payout: ${pct(s.payout)}`] : []), '',
      ...(plans.length ? [`NEXT-YEAR FORECAST: ${state.forecast.toUpperCase()} EARNINGS`, ...plans.map(p => `${p.plan === 'debt' ? 'Borrowing' : 'Common stock'}: net income ${money(p.netIncome)}, EPS ${dollars(p.eps)}, ROE ${pct(p.roe)}, required interest ${money(p.interest)}, existing holders’ voting stake ${pct(p.existingOwnership)}`), ''] : []),
      'Fictional case.'].join('\n');
  }
  $('#brand-home').onclick = e => { e.preventDefault(); home = true; render(true); };
  window.addEventListener('scroll', fitSidebar, { passive: true });
  window.addEventListener('resize', fitSidebar);
  $('#backup-now').onclick = () => action('export');
  $('#menu-button').onclick = () => { const open = $('#app-menu').hidden; $('#app-menu').hidden = !open; $('#menu-button').setAttribute('aria-expanded', String(open)); };
  document.addEventListener('click', e => { if (!e.target.closest('.header-right') && !e.target.closest('.app-menu')) { $('#app-menu').hidden = true; $('#menu-button').setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#app-menu').hidden = true; $('#menu-button').setAttribute('aria-expanded', 'false'); } });
  $('#dialog').addEventListener('click', e => { if (e.target === $('#dialog')) $('#dialog').close(); });
  $('#import-file').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    if (file.size > 100000) return toast('This file is too large to be a meeting file.');
    let loaded;
    try { loaded = E.validateState(JSON.parse(await file.text())); } catch (_) { loaded = null; }
    if (!loaded) return modal('This meeting file could not be opened.', '<p>Choose a meeting file saved from Executive Decisions. Your current meeting has been kept.</p>');
    modal('Open this saved meeting?', '<p>This replaces the meeting currently saved in this browser.</p>', 'Open meeting', () => { state = loaded; home = !state.started; render(true); toast('Saved meeting opened.'); });
  };
  if (/^https?:$/.test(location.protocol)) {
    const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = 'manifest.webmanifest'; document.head.append(manifest);
    if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('service-worker.js').catch(() => {}); });
  }
  render();
  if (recovered) toast('Your saved meeting could not be opened. You can start over or open a meeting file.');
})();
