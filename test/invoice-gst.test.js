'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

const items = [
  { id: 1, sku: 'RICE-001', name: 'Rice', hsn: '1006', price: 600, qty: 1 },
  { id: 2, sku: 'TEA-001', name: 'Tea', hsn: '0902', price: 400, qty: 1 }
];

const ledgerFigures = pricing.computeTotals(items, 'SAVE10');
const order = {
  id: 1001,
  date: '22/11/2026',
  customer: 'In-memory customer',
  paymentMode: 'cash',
  status: 'completed',
  items: items,
  coupon: 'SAVE10',
  subtotal: ledgerFigures.subtotal,
  discount: ledgerFigures.discount,
  tax: ledgerFigures.tax,
  total: ledgerFigures.total
};

test('CURRENT BEHAVIOUR: order ledger applies HSN rates after line discount', function () {
  assert.equal(ledgerFigures.subtotal, 1000);
  assert.equal(ledgerFigures.discount, 100);
  assert.equal(ledgerFigures.taxable, 900);
  assert.equal(ledgerFigures.tax, 91.8);
  assert.equal(ledgerFigures.cgst, 45.9);
  assert.equal(ledgerFigures.sgst, 45.9);
  assert.equal(ledgerFigures.total, 991.8);
  assert.deepEqual(ledgerFigures.lines.map(function (line) {
    return { gstPercent: line.gstPercent, discount: line.discount, tax: line.tax };
  }), [
    { gstPercent: 5, discount: 60, tax: 27 },
    { gstPercent: 18, discount: 40, tax: 64.8 }
  ]);
});

test('CURRENT BEHAVIOUR: invoice figures use the order ledger GST and discount calculation', function () {
  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(invoiceFigures.subtotal, ledgerFigures.subtotal);
  assert.equal(invoiceFigures.discount, ledgerFigures.discount);
  assert.equal(invoiceFigures.tax, ledgerFigures.tax);
  assert.equal(invoiceFigures.cgst, ledgerFigures.cgst);
  assert.equal(invoiceFigures.sgst, ledgerFigures.sgst);
  assert.equal(invoiceFigures.total, ledgerFigures.total);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
  assert.deepEqual(invoiceFigures.rows.map(function (row) { return row.lineTax; }), [27, 64.8]);
});

test('CURRENT BEHAVIOUR: GST reconciliation reports matching invoice and ledger figures', function () {
  const result = reports.getGstReconciliation({ orders: [order] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].invoiceTax, order.tax);
  assert.equal(result.rows[0].invoiceTotal, order.total);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('CURRENT BEHAVIOUR: rendered invoice omits the mismatch notice for matching figures', function () {
  const html = invoice.render(order);

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹991\.80<\/td>/);
});
