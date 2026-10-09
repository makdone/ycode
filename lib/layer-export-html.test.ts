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

const linkedSection: Layer = {
  id: 'cta',
  name: 'section',
  classes: '',
  settings: { id: 'contact' },
  children: [
    {
      id: 'to-features',
      name: 'button',
      classes: 'px-4',
      variables: { link: { type: 'url', anchor_layer_id: 'features' } },
      children: [],
    },
    {
      id: 'to-about',
      name: 'div',
      classes: '',
      variables: { link: { type: 'page', page: { id: 'page-about' } } },
      children: [],
    },
    {
      id: 'mail',
      name: 'text',
      classes: 'underline',
      settings: { tag: 'p' },
      variables: {
        text: { type: 'dynamic_text', data: { content: 'Write to us' } },
        link: { type: 'email', email: { type: 'dynamic_text', data: { content: 'hi@example.com' } } },
      },
    },
  ],
};

test('export renders every link type with the published href', () => {
  const html = layerToExportHtml(linkedSection, {}, {
    pages: [{ id: 'page-about', slug: 'about', page_folder_id: null, is_index: false, is_dynamic: false } as never],
    folders: [],
  });

  assert.match(html, /<section id="contact">/);
  assert.match(html, /<a class="px-4" href="#features">/);
  assert.match(html, /<a href="\/about">/);
  assert.match(html, /<a href="mailto:hi@example\.com"><p class="underline">Write to us<\/p><\/a>/);
});

test('export leaves out page links it cannot resolve', () => {
  const html = layerToExportHtml(linkedSection);

  assert.doesNotMatch(html, /\/about/);
  assert.match(html, /href="#features"/);
});
