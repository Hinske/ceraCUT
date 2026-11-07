'use strict';
const test = require('node:test');
const assert = require('node:assert');
const W = require('../js/wildcard');

test('Wildcard: ohne Platzhalter = Teilstring, Groß/Klein egal', () => {
    assert.ok(W.test('heide', 'HEIDE6000101587.CNC'));
    assert.ok(!W.test('xyz', 'HEIDE6000101587.CNC'));
    assert.ok(W.test('', 'irgendwas'));
});
test('Wildcard: * und ? ', () => {
    assert.ok(W.test('hei*587', 'HEIDE6000101587.CNC'));
    assert.ok(W.test('*.cnc', 'a.CNC'));
    assert.ok(!W.test('*.dxf', 'a.CNC'));
    assert.ok(W.test('h?ide', 'Heide'));
    assert.ok(!W.test('h?ide', 'Hide'));
});
test('Wildcard: Regex-Sonderzeichen sind wörtlich, mehrere Begriffe = UND, mehrere Felder', () => {
    assert.ok(W.test('a.b', 'xa.by'));
    assert.ok(!W.test('a.b', 'axb'));
    assert.ok(W.test('(1)', 'Teil (1)'));
    assert.ok(W.test('heide 6000', 'Heide', 'Auftrag 6000'));
    assert.ok(!W.test('heide 7000', 'Heide', 'Auftrag 6000'));
});
