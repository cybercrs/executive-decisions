const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function at(stage, decisions = {}) {
  let s = { ...E.initialState(), started: true, decisions: { ...E.DEFAULTS, ...decisions } };
  while (s.completed < Math.min(stage, 4)) s = E.commit(s);
  if (stage >= 5) { for (let j = 0; j < 3; j++) s = E.advanceDividend(s); }
  while (s.completed < stage) s = E.commit(s);
  return s;
}
test('Authorization creates no assets, income, or equity; it creates unissued capacity', () => {
  const s = E.snapshot(at(1));
  assert.equal(s.authorized, 100000); assert.equal(s.unissued, 100000);
  for (const key of ['commonIssued', 'cash', 'income', 'paidIn', 'equity']) assert.equal(s[key], 0);
});
test('Par, stated, and no-stated-value stock allocate the same proceeds correctly', () => {
  for (const capitalType of ['par', 'stated', 'none']) {
    const s = E.snapshot(at(2, { capitalType }));
    assert.equal(s.cash, 290000); assert.equal(s.retained, 0);
    assert.equal(s.commonCapital, capitalType === 'none' ? 240000 : 20000);
    assert.equal(s.commonAPIC, capitalType === 'none' ? 0 : 220000);
    assert.equal(s.preferredCapital, 40000); assert.equal(s.preferredAPIC, 10000);
    assert.equal(s.commonCapital + s.commonAPIC + s.preferredCapital + s.preferredAPIC, s.paidIn);
  }
});
test('Profit and operating cash differ; equipment exchanges assets without reducing equity', () => {
  const kept = E.snapshot(at(3, { investment: 0 })), invested = E.snapshot(at(3));
  assert.equal(invested.income, 24000); assert.equal(invested.operatingCash, 15000);
  assert.equal(invested.receivables, 9000); assert.equal(invested.retained, 24000);
  assert.equal(kept.equity, invested.equity); assert.equal(kept.assets, invested.assets);
  assert.equal(kept.cash - invested.cash, 100000); assert.equal(invested.equipment, 100000);
});
test('Treasury stock reduces cash and equity at cost; issued shares and Common Stock remain unchanged', () => {
  const before = E.snapshot(at(3)), after = E.snapshot(at(4));
  assert.equal(after.commonIssued, 20000); assert.equal(after.outstanding, 18000);
  assert.equal(after.treasuryShares, 2000); assert.equal(after.treasuryCost, 30000);
  assert.equal(after.commonCapital, before.commonCapital); assert.equal(after.retained, before.retained);
  assert.equal(before.cash - after.cash, 30000); assert.equal(before.equity - after.equity, 30000);
});
test('Each dividend date has a distinct accounting effect, with no second equity reduction at payment', () => {
  let state = at(4); const before = E.snapshot(state);
  state = E.advanceDividend(state); const declaration = E.snapshot(state);
  assert.equal(declaration.payable, 16000); assert.equal(declaration.cash, before.cash);
  assert.equal(declaration.equity, before.equity - 16000);
  assert.equal(declaration.preferredDividends, 2000); assert.equal(declaration.commonDividends, 14000);
  close(declaration.commonDividendPerShare, 14000 / 18000);
  state = E.advanceDividend(state); const record = E.snapshot(state);
  assert.deepEqual(record, declaration);
  state = E.advanceDividend(state);
  const payment = E.snapshot(state, { yearEnd: false });
  assert.equal(payment.payable, 0); assert.equal(payment.cash, before.cash - 16000);
  assert.equal(payment.equity, declaration.equity); assert.equal(payment.retained, declaration.retained);
  assert.equal(state.completed, 5);
});
test('A zero distribution creates no dividend obligation or preferred dividend accrual', () => {
  const s = E.snapshot(at(6, { dividend: 0 }));
  assert.equal(s.dividends, 0); assert.equal(s.preferredDividends, 0); assert.equal(s.payable, 0);
  assert.equal(s.retained, 48000);
});
test('Annual report uses six-month EPS weights, preferred deductions, and common equity averages', () => {
  const s = E.snapshot(at(6));
  assert.equal(s.income, 48000); assert.equal(s.cash, 174000); assert.equal(s.equity, 292000);
  assert.equal(s.retained, 32000); assert.equal(s.averageShares, 19000);
  assert.equal(s.commonIncome, 46000); assert.equal(s.averageCommonEquity, 241000);
  close(s.eps, 46000 / 19000); close(s.roe, 46000 / 241000); close(s.payout, 14000 / 48000);
  assert.equal(s.assets, s.payable + s.equity);
});
test('Cash and earnings constraints prevent impossible management decisions', () => {
  const lowCash = { commonShares: 10000, preferredShares: 0, investment: 100000, buybackShares: 4000 };
  assert.match(E.decisionError(at(3, lowCash)), /exceeds available cash/);
  assert.throws(() => E.commit(at(3, lowCash)), /exceeds available cash/);
  const small = at(4, { commonShares: 10000, preferredShares: 0, investment: 100000, buybackShares: 2000, dividend: 24000 });
  assert.match(E.decisionError(small), /enough cash/);
});
test('Revising a meeting clears its later effects and checks, including dividend liability', () => {
  const s = at(6); s.checks = { 0: { answers: [1], results: [true] }, 3: { answers: [0], results: [false] }, 5: { answers: [0], results: [true] } };
  const n = E.rewind(s, 3), report = E.snapshot(n);
  assert.equal(n.completed, 3); assert.equal(n.dividendPhase, 0); assert.equal(report.treasuryShares, 0);
  assert.equal(report.dividends, 0); assert.equal(report.income, 24000);
  assert.deepEqual(Object.keys(n.checks), ['0']);
});
test('Financing compares the same expansion; weak earnings preserve mandatory debt interest', () => {
  const s = at(6), [strongDebt, strongEquity] = E.financing(s, 'strong');
  assert.equal(strongDebt.interest, 9600); assert.equal(strongDebt.newShares, 0);
  assert.equal(strongEquity.newShares, 10000); assert.equal(strongEquity.interest, 0);
  assert.equal(strongDebt.existingOwnership, 1); close(strongEquity.existingOwnership, 18000 / 28000);
  assert.ok(strongDebt.eps > strongEquity.eps); assert.ok(strongDebt.roe > strongEquity.roe);
  const [weakDebt, weakEquity] = E.financing(s, 'weak');
  assert.equal(weakDebt.interest, strongDebt.interest); assert.equal(weakDebt.netIncome, -5600);
  assert.equal(weakDebt.tax, 0); assert.equal(weakEquity.netIncome, 3000);
  assert.ok(weakDebt.eps < weakEquity.eps); assert.equal(E.snapshot(s).income, 48000);
});
test('Every feasible combination keeps the accounting equation and share reconciliation intact', () => {
  let feasible = 0, constrained = 0;
  for (const capitalType of E.CHOICES.capitalType) for (const commonShares of E.CHOICES.commonShares)
    for (const preferredShares of E.CHOICES.preferredShares) for (const investment of E.CHOICES.investment)
      for (const buybackShares of E.CHOICES.buybackShares) for (const dividend of E.CHOICES.dividend) {
        const d = { capitalType, commonShares, preferredShares, investment, buybackShares, dividend };
        let s = { ...E.initialState(), started: true, decisions: d };
        try {
          for (let i = 0; i < 4; i++) { s = E.commit(s); invariant(s); }
          for (let i = 0; i < 3; i++) { s = E.advanceDividend(s); invariant(s); }
          s = E.commit(s); invariant(s); assert.ok(E.validateState(s)); feasible++;
        } catch (err) {
          if (!/cash|retained earnings/.test(err.message)) throw err;
          constrained++;
        }
      }
  assert.equal(feasible + constrained, 648); assert.ok(feasible > 500); assert.ok(constrained > 0);
  function invariant(s) {
    const r = E.snapshot(s);
    close(r.assets, r.equity + r.payable); assert.ok(r.cash >= 0);
    assert.equal(r.commonIssued - r.treasuryShares, r.outstanding);
    assert.equal(r.authorized - r.commonIssued, r.unissued);
    close(r.commonDividends + r.preferredDividends, r.dividends);
  }
});
test('Saved meeting validation rejects malformed, inconsistent, and impossible states', () => {
  const good = at(6); assert.deepEqual(E.validateState(good), good);
  assert.equal(E.validateState({ ...good, version: 99 }), null);
  assert.equal(E.validateState({ ...good, completed: 2, stage: 5 }), null);
  assert.equal(E.validateState({ ...good, dividendPhase: 0 }), null);
  assert.equal(E.validateState({ ...good, decisions: { ...good.decisions, commonShares: -1 } }), null);
  assert.equal(E.validateState({ ...good, decisions: { ...good.decisions, commonShares: 10000, preferredShares: 0, buybackShares: 4000 } }), null);
  assert.equal(E.validateState(null), null);
});

test('Earlier saved meetings keep completed work and open the new final statements part', () => {
  const old = {...at(6), version: 1, stage: 5, checks: {5: {answers: [2, 1, 0], results: [true, true, true]}}};
  const migrated = E.validateState(old);
  assert.equal(migrated.completed, 6);
  assert.equal(migrated.stage, 6);
  assert.deepEqual(migrated.checks[5], {answers: [2], results: [true]});
  assert.equal(migrated.checks[6], undefined);
  const finished = E.commit(migrated);
  assert.equal(finished.completed, 7);
  assert.deepEqual(E.validateState(finished), finished);
});
