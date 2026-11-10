import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashCode, checkCode, validate, fingerprint
} from '../lib/core.js';

const payload = () => ({
  content: {
    brand: 'Portfolio',
    headline: 'Test',
    accentLine: 'Test',
    intro: '',
    about: '',
    email: 'a@b.co',
    accent: '#d5fee0',
    layout: 'mosaic',
    gap: 20,
    radius: 24,
    projects: [{
      id: 'one',
      title: 'One',
      description: '',
      category: 'Web',
      year: '2026',
      status: 'เสร็จแล้ว',
      url: '/projects/one.html',
      cover: '',
      art: 'rings',
      visible: true,
      featured: true
    }]
  },
  shortcut: 'Ctrl+Shift+K',
  code: 'secret123'
});

test('secret hashes are salted and reject incorrect or malformed inputs', () => {
  const hash = hashCode('secret123');
  assert.ok(checkCode('secret123', hash));
  assert.equal(checkCode('wrong', hash), false);
  assert.notEqual(hash, hashCode('secret123'));
  assert.equal(checkCode('secret123', 'broken'), false);
});

test('valid settings accepted; unsafe URLs, duplicate IDs, weak code rejected', () => {
  assert.ok(validate(payload()));

  for (const url of [
    'javascript:alert(1)',
    '//evil.com',
    'data:text/html,hi'
  ]) {
    const value = payload();
    value.content.projects[0].url = url;
    assert.throws(() => validate(value));
  }

  const duplicate = payload();
  duplicate.content.projects.push(duplicate.content.projects[0]);
  assert.throws(() => validate(duplicate));

  const weak = payload();
  weak.code = '123';
  assert.throws(() => validate(weak));
});

test('anonymous fingerprints are deterministic without exposing visitor ID', () => {
  assert.equal(
    fingerprint('visitor', 'key'),
    fingerprint('visitor', 'key')
  );
  assert.notEqual(
    fingerprint('visitor', 'key'),
    fingerprint('visitor', 'other')
  );
  assert.equal(fingerprint('visitor', 'key').length, 64);
});
