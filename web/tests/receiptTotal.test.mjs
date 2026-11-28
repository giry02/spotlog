import assert from 'node:assert/strict';
import test from 'node:test';
import { receiptTotalFromText } from '../src/receiptTotal.ts';

test('reads a Korean grand total first and leaves subtotal, tax and item values alone', () => {
  const text = '과세물품 27,273\n부가세 2,727\n합 계 30,000원\n할인 3,000\n총 결 제 금 액： ￦２７，０００원';
  assert.equal(receiptTotalFromText(text), 27_000);
});

test('reads Korean and English totals split by a line or OCR spacing', () => {
  assert.equal(receiptTotalFromText('합 계 금 액:\n12 450 원\n카드결제'), 12_450);
  assert.equal(receiptTotalFromText('Subtotal 23,000\nGRAND TOTAL 25,000 KRW'), 25_000);
  assert.equal(receiptTotalFromText('합계 27.000'), 27_000);
});

test('abstains when likely totals conflict or are not identified', () => {
  assert.equal(receiptTotalFromText('총 결제 금액 20,000\n총결제금액 50,000'), undefined);
  assert.equal(receiptTotalFromText('소계 10,000\n세액 1,000\n11,000'), undefined);
  assert.equal(receiptTotalFromText('TOTAL $40.25'), undefined);
  assert.equal(receiptTotalFromText('합계 2026-11-25 14:21 14,000'), undefined);
  assert.equal(receiptTotalFromText('총액 -5,000원'), undefined);
  assert.equal(receiptTotalFromText('총액 0원'), undefined);
});
