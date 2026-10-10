import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveLinkAnchor } from './utils';
import { generateLinkHref, isValidLinkSettings } from '../link-utils';
import type { Layer } from '../../types';

const layers: Layer[] = [{
  id: 'body',
  name: 'body',
  classes: '',
  children: [
    { id: 'lyr-features', name: 'section', classes: '', settings: { id: 'features' }, children: [] },
    { id: 'lyr-plain', name: 'section', classes: '', children: [] },
  ],
}];

test('anchor-only url links are valid and render as #anchor', () => {
  const link = { type: 'url' as const, anchor_layer_id: 'features' };
  assert.equal(isValidLinkSettings(link), true);
  assert.equal(generateLinkHref(link, {}), '#features');
  assert.equal(isValidLinkSettings({ type: 'url' }), false);
});

test('a stored layer id resolves through the settings.id anchor map', () => {
  const link = { type: 'url' as const, anchor_layer_id: 'lyr-features' };
  assert.equal(generateLinkHref(link, { anchorMap: { 'lyr-features': 'features' } }), '#features');
});

test('resolveLinkAnchor stores the target HTML id', () => {
  const byLayerId = resolveLinkAnchor({ link_type: 'url', anchor_layer_id: 'lyr-features' }, layers);
  assert.deepEqual(byLayerId, { input: { link_type: 'url', anchor_layer_id: 'features' } });

  const byHtmlId = resolveLinkAnchor({ link_type: 'url', anchor_layer_id: '#features' }, layers);
  assert.deepEqual(byHtmlId, { input: { link_type: 'url', anchor_layer_id: 'features' } });
});

test('resolveLinkAnchor rejects targets that cannot render', () => {
  const noHtmlId = resolveLinkAnchor({ link_type: 'url', anchor_layer_id: 'lyr-plain' }, layers);
  assert.ok('error' in noHtmlId && /no HTML id/.test(noHtmlId.error));

  const unknown = resolveLinkAnchor({ link_type: 'url', anchor_layer_id: 'pricing' }, layers);
  assert.ok('error' in unknown && /No layer/.test(unknown.error));

  const noAnchor = { link_type: 'url' as const, url: 'https://example.com' };
  assert.deepEqual(resolveLinkAnchor(noAnchor, layers), { input: noAnchor });
});
