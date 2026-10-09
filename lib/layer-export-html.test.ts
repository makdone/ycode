import assert from 'node:assert/strict';
import { test } from 'node:test';

import { layerToExportHtml } from './html-layer-converter';
import type { Layer } from '../types';

const IMAGE_ASSET = '0b3c1f0e-8f1a-4c7e-9a52-1d2e3f4a5b6c';
const BG_ASSET = '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a';

const section: Layer = {
  id: 'hero',
  name: 'section',
  classes: 'bg-[image:var(--bg-img)] bg-cover',
  variables: {
    backgroundImage: { src: { type: 'asset', data: { asset_id: BG_ASSET } } },
  },
  children: [
    {
      id: 'photo',
      name: 'image',
      classes: 'w-full',
      variables: {
        image: {
          src: { type: 'asset', data: { asset_id: IMAGE_ASSET } },
          alt: { type: 'dynamic_text', data: { content: 'Team at work' } },
        },
      },
    },
  ],
};

test('export resolves asset-backed image and background srcs from the URL map', () => {
  const html = layerToExportHtml(section, {
    [IMAGE_ASSET]: 'https://cdn.example.com/photo.jpg',
    [BG_ASSET]: 'https://cdn.example.com/bg.jpg',
  });

  assert.match(html, /src="https:\/\/cdn\.example\.com\/photo\.jpg"/);
  assert.match(html, /alt="Team at work"/);
  assert.match(html, /style="--bg-img:url\(&#039;https:\/\/cdn\.example\.com\/bg\.jpg&#039;\)"/);
});

test('export omits src for assets missing from the URL map', () => {
  const html = layerToExportHtml(section);

  assert.doesNotMatch(html, /src=/);
  assert.doesNotMatch(html, /style=/);
});
