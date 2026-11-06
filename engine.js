(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Boardroom = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 2;
  const CASE = Object.freeze({ authorized: 100000, preferredAuthorized: 10000,
    issuePrice: 12, preferredPar: 20, preferredPrice: 25, preferredRate: .05,
    repurchasePrice: 15, halfIncome: 24000, halfCash: 15000,
    expansion: 120000, interestRate: .08, taxRate: .25, strongEBIT: 80000, weakEBIT: 4000 });
  const STAGES = ['Establish', 'Issue shares', 'Earn & invest', 'Repurchase', 'Dividends', 'Retained earnings', 'The final statements'];
  const DEFAULTS = Object.freeze({ capitalType: 'par', commonShares: 20000, preferredShares: 2000,
    investment: 100000, buybackShares: 2000, dividend: 16000 });
  const CHOICES = Object.freeze({ capitalType: ['par', 'stated', 'none'],
    commonShares: [10000, 20000, 30000], preferredShares: [0, 2000, 4000],
    investment: [0, 100000], buybackShares: [0, 2000, 4000], dividend: [0, 8000, 16000, 24000] });
  function initialState() {
    return { version: VERSION, started: false, completed: 0, stage: 0,
      dividendPhase: 0, decisions: { ...DEFAULTS }, checks: {}, notes: '', forecast: 'strong' };
  }
  function snapshot(state, options = {}) {
    const d = state.decisions;
    const funded = state.completed >= 2;
    const operating = state.completed >= 3;
    const repurchased = state.completed >= 4;
    const yearEnd = options.yearEnd === undefined ? state.completed >= 5 : options.yearEnd;
    const declared = state.dividendPhase >= 1 && repurchased;
    const paid = state.dividendPhase >= 3 && repurchased;
    const commonIssued = funded ? d.commonShares : 0;
    const preferredIssued = funded ? d.preferredShares : 0;
    const commonProceeds = commonIssued * CASE.issuePrice;
    const preferredProceeds = preferredIssued * CASE.preferredPrice;
    const commonCapital = d.capitalType === 'none' ? commonProceeds : commonIssued;
    const commonAPIC = commonProceeds - commonCapital;
    const preferredCapital = preferredIssued * CASE.preferredPar;
    const preferredAPIC = preferredProceeds - preferredCapital;
    const halfYears = operating ? (yearEnd ? 2 : 1) : 0;
    const income = halfYears * CASE.halfIncome;
    const operatingCash = halfYears * CASE.halfCash;
    const equipment = operating ? d.investment : 0;
    const treasuryShares = repurchased ? d.buybackShares : 0;
    const treasuryCost = treasuryShares * CASE.repurchasePrice;
    const outstanding = commonIssued - treasuryShares;
    const dividends = declared ? d.dividend : 0;
    const preferredDividends = Math.min(dividends, preferredIssued * CASE.preferredPar * CASE.preferredRate);
    const commonDividends = dividends - preferredDividends;
    const payable = declared && !paid ? dividends : 0;
    const cash = commonProceeds + preferredProceeds + operatingCash - equipment - treasuryCost - (paid ? dividends : 0);
    const receivables = income - operatingCash;
    const retained = income - dividends;
    const paidIn = commonProceeds + preferredProceeds;
    const equity = paidIn + retained - treasuryCost;
    const assets = cash + receivables + equipment;
    const averageShares = commonIssued ? (yearEnd ? (commonIssued + outstanding) / 2 : commonIssued) : 0;
    const commonEquity = equity - preferredProceeds;
    const beginningCommonEquity = commonProceeds;
    const averageCommonEquity = funded ? (beginningCommonEquity + commonEquity) / 2 : 0;
    const commonIncome = income - preferredDividends;
    return { authorized: state.completed >= 1 ? CASE.authorized : 0, commonIssued,
      unissued: state.completed >= 1 ? CASE.authorized - commonIssued : 0, preferredIssued,
      commonProceeds, preferredProceeds, commonCapital, commonAPIC, preferredCapital, preferredAPIC,
      treasuryShares, treasuryCost, outstanding, income, operatingCash, equipment, cash, receivables,
      dividends, preferredDividends, commonDividends, payable, retained, paidIn, equity, assets,
      averageShares, commonEquity, beginningCommonEquity, averageCommonEquity, commonIncome,
      eps: averageShares ? commonIncome / averageShares : null,
      roe: averageCommonEquity > 0 ? commonIncome / averageCommonEquity : null,
      payout: income > 0 ? commonDividends / income : null,
      commonDividendPerShare: outstanding ? commonDividends / outstanding : 0,
      yearEnd: Boolean(yearEnd && operating) };
  }
  function preview(state, stage = state.stage) {
    const next = JSON.parse(JSON.stringify(state));
    next.completed = Math.max(next.completed, stage + 1);
    if (stage === 4) next.dividendPhase = 1;
    return snapshot(next, stage === 4 ? { yearEnd: false } : {});
  }
  function decisionError(state, stage = state.stage) {
    const d = state.decisions;
    if (stage === 2) {
      const before = snapshot({ ...state, completed: 2 });
      if (d.investment > before.cash + CASE.halfCash) return 'Choose an investment the company can pay for with its available cash.';
    }
    if (stage === 3) {
      const before = snapshot({ ...state, completed: 3, dividendPhase: 0 });
      if (d.buybackShares > before.commonIssued || d.buybackShares * CASE.repurchasePrice > before.cash)
        return 'This repurchase exceeds available cash. Choose fewer shares or revise the earlier investment decision.';
    }
    if (stage === 4) {
      const before = snapshot({ ...state, completed: 4, dividendPhase: 0 });
      if (d.dividend > before.retained) return 'The proposed dividend exceeds retained earnings at the declaration date.';
      if (d.dividend > before.cash) return 'The company does not have enough cash to pay this dividend. Choose a smaller distribution.';
    }
    return '';
  }
  function commit(state) {
    const error = decisionError(state);
    if (error) throw new Error(error);
    if (state.stage !== state.completed || state.completed >= STAGES.length) throw new Error('This meeting has already been recorded.');
    if (state.stage === 4) throw new Error('Advance through the dividend dates to finish this meeting.');
    const n = JSON.parse(JSON.stringify(state));
    n.completed += 1;
    n.stage = Math.min(n.completed, STAGES.length - 1);
    return n;
  }
  function advanceDividend(state) {
    if (state.completed !== 4 || state.dividendPhase >= 3) throw new Error('The dividend timeline is complete.');
    const error = decisionError(state, 4);
    if (error) throw new Error(error);
    const n = JSON.parse(JSON.stringify(state));
    n.dividendPhase += 1;
    if (n.dividendPhase === 3) { n.completed = 5; n.stage = 5; }
    return n;
  }
  function rewind(state, stage) {
    const n = JSON.parse(JSON.stringify(state));
    n.completed = stage;
    n.stage = stage;
    if (stage <= 4) n.dividendPhase = 0;
    Object.keys(n.checks).forEach(k => { if (Number(k) >= stage) delete n.checks[k]; });
    return n;
  }
  function financing(state, climate = state.forecast) {
    const base = snapshot({ ...state, completed: 6, dividendPhase: 3 });
    const ebit = climate === 'weak' ? CASE.weakEBIT : CASE.strongEBIT;
    const preferredDividend = state.decisions.preferredShares * CASE.preferredPar * CASE.preferredRate;
    return ['debt', 'equity'].map(plan => {
      const interest = plan === 'debt' ? CASE.expansion * CASE.interestRate : 0;
      const tax = Math.max(0, (ebit - interest) * CASE.taxRate);
      const netIncome = ebit - interest - tax;
      const commonIncome = netIncome - preferredDividend;
      const newShares = plan === 'equity' ? CASE.expansion / CASE.issuePrice : 0;
      const shares = base.outstanding + newShares;
      const beginningEquity = base.commonEquity + (plan === 'equity' ? CASE.expansion : 0);
      const endingEquity = beginningEquity + commonIncome;
      const averageEquity = (beginningEquity + endingEquity) / 2;
      return { plan, ebit, interest, tax, netIncome, preferredDividend, commonIncome, newShares, shares,
        beginningEquity, endingEquity, averageEquity,
        eps: commonIncome / shares, roe: averageEquity > 0 ? commonIncome / averageEquity : null,
        existingOwnership: base.outstanding / shares, debt: plan === 'debt' ? CASE.expansion : 0 };
    });
  }
  function validateState(input) {
    if (!input || typeof input !== 'object' || ![1, VERSION].includes(input.version)) return null;
    const previous = input.version === 1;
    const s = initialState();
    if (!Number.isInteger(input.completed) || input.completed < 0 || input.completed > (previous ? 6 : STAGES.length)) return null;
    if (!Number.isInteger(input.stage) || input.stage < 0 || input.stage > Math.min(input.completed, previous ? 5 : STAGES.length - 1)) return null;
    if (!Number.isInteger(input.dividendPhase) || input.dividendPhase < 0 || input.dividendPhase > 3) return null;
    if (input.completed < 4 && input.dividendPhase !== 0) return null;
    if (input.completed === 4 && input.dividendPhase > 2) return null;
    if (input.completed >= 5 && input.dividendPhase !== 3) return null;
    if (!input.decisions || !input.checks || typeof input.checks !== 'object' || Array.isArray(input.checks)) return null;
    for (const [key, choices] of Object.entries(CHOICES)) {
      if (!choices.includes(input.decisions[key])) return null;
      s.decisions[key] = input.decisions[key];
    }
    s.completed = input.completed;
    s.stage = previous && input.completed === 6 && input.stage === 5 ? 6 : input.stage;
    s.dividendPhase = input.dividendPhase;
    s.started = input.started === true;
    s.forecast = input.forecast === 'weak' ? 'weak' : 'strong';
    s.notes = typeof input.notes === 'string' ? input.notes.slice(0, 8000) : '';
    for (const [k, v] of Object.entries(input.checks)) {
      if (!/^[0-6]$/.test(k) || (previous && k === '6') || !v || !Array.isArray(v.results) || v.results.length > 5) continue;
      const limit = previous && k === '5' ? 1 : 5;
      const validOption = a => Number.isInteger(a) && a >= 0 && a <= 5;
      s.checks[k] = { results: v.results.slice(0, limit).map(r => typeof r === 'boolean' ? r : null),
        answers: Array.isArray(v.answers) ? v.answers.slice(0, limit).map(a =>
          k === '6' && Array.isArray(a) ? [...new Set(a.filter(validOption))].sort((x, y) => x - y) : validOption(a) ? a : -1) : [] };
    }
    for (let stage = 2; stage <= Math.min(4, s.completed - 1); stage++) {
      if (decisionError(s, stage)) return null;
    }
    if (s.completed === 4 && s.dividendPhase > 0 && decisionError(s, 4)) return null;
    return s;
  }
  return { VERSION, CASE, STAGES, DEFAULTS, CHOICES, initialState, snapshot, preview,
    decisionError, commit, advanceDividend, rewind, financing, validateState };
});
