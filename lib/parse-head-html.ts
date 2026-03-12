import React from 'react';
import { resolveCustomCodePlaceholders } from '@/lib/resolve-cms-variables';
import type { Page, CollectionItemWithValues, CollectionField } from '@/types';

const VOID_TAGS = new Set(['meta', 'link', 'base']);

const HTML_TO_REACT_ATTRS: Record<string, string> = {
  'class': 'className',
  'for': 'htmlFor',
  'crossorigin': 'crossOrigin',
  'charset': 'charSet',
  'http-equiv': 'httpEquiv',
  'tabindex': 'tabIndex',
  'nomodule': 'noModule',
  'referrerpolicy': 'referrerPolicy',
  'fetchpriority': 'fetchPriority',
};

const BOOLEAN_ATTRS = new Set([
  'async', 'defer', 'disabled', 'hidden', 'nomodule',
  'readonly', 'required', 'reversed', 'scoped',
]);

function parseAttributes(attrString: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  const regex = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    const rawName = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    const reactName = HTML_TO_REACT_ATTRS[rawName.toLowerCase()] || rawName;

    if (BOOLEAN_ATTRS.has(rawName.toLowerCase())) {
      attrs[reactName] = true;
    } else {
      attrs[reactName] = value ?? '';
    }
  }
  return attrs;
}

/** Parse an HTML string of head elements into individual React elements. */
export function parseHeadHtml(html: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  // Matches void tags (meta/link/base) and paired tags (style/script/title/noscript).
  // Void tag attrs use (?:[^>"']|"[^"]*"|'[^']*')* to handle `>` inside quoted values.
  const regex =
    /<(meta|link|base)(\s(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>|<(style|script|title|noscript)(\s[^>]*)?>[\s\S]*?<\/\3\s*>/gi;

  let match;
  let key = 0;

  while ((match = regex.exec(html)) !== null) {
    const voidTag = match[1]?.toLowerCase();
    const voidAttrStr = match[2] || '';
    const pairedTag = match[3]?.toLowerCase();
    const pairedAttrStr = match[4] || '';

    if (voidTag) {
      const attrs = parseAttributes(voidAttrStr.trim());
      elements.push(React.createElement(voidTag, { key: key++, ...attrs }));
    } else if (pairedTag) {
      const attrs = parseAttributes(pairedAttrStr.trim());
      const full = match[0];
      const innerMatch = full.match(
        new RegExp(`<${pairedTag}[^>]*>([\\s\\S]*)<\\/${pairedTag}\\s*>`, 'i'),
      );
      const inner = innerMatch ? innerMatch[1] : '';

      if (pairedTag === 'title') {
        elements.push(React.createElement('title', { key: key++ }, inner));
      } else {
        elements.push(
          React.createElement(pairedTag, {
            key: key++,
            ...attrs,
            dangerouslySetInnerHTML: { __html: inner },
          }),
        );
      }
    }
  }

  return elements;
}

/** Resolve page-specific custom head code with CMS variable substitution. */
export function getPageHeadElements(
  page: Page,
  collectionItem?: CollectionItemWithValues,
  collectionFields?: CollectionField[],
): React.ReactNode[] | null {
  const raw = page.settings?.custom_code?.head || '';
  if (!raw) return null;

  const resolved = page.is_dynamic && collectionItem
    ? resolveCustomCodePlaceholders(raw, collectionItem, collectionFields || [])
    : raw;

  if (!resolved) return null;
  return parseHeadHtml(resolved);
}
