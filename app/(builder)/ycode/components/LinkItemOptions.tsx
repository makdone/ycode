'use client';

import { SelectItem, SelectSeparator } from '@/components/ui/select';
import type { CollectionItemWithValues, CollectionField } from '@/types';
import type { ReferenceItemOption } from '@/lib/collection-field-utils';

interface CollectionItemSelectOptionsProps {
  canUseCurrentPageItem: boolean;
  canUseCurrentCollectionItem: boolean;
  referenceItemOptions: ReferenceItemOption[];
  collectionItems: CollectionItemWithValues[];
  /** Fields for the linked page's collection, used to derive display names */
  collectionFields: CollectionField[];
  /** Optional search string to filter visible options by their display label */
  searchValue?: string;
}

/** Derives a human-readable label for a collection item. */
function getDisplayName(item: CollectionItemWithValues, collectionFields: CollectionField[]): string {
  const nameField = collectionFields.find(f => f.key === 'name');
  if (nameField && item.values[nameField.id]) return item.values[nameField.id];
  const values = Object.values(item.values);
  return values[0] || item.id;
}

/**
 * Shared SelectContent items for CMS item pickers used in link settings.
 * Renders "Current page item", "Current collection item", reference field options,
 * a separator, and the concrete item list.
 *
 * When `searchValue` is provided, options are filtered case-insensitively by
 * their visible label.
 */
export default function LinkItemOptions({
  canUseCurrentPageItem,
  canUseCurrentCollectionItem,
  referenceItemOptions,
  collectionItems,
  collectionFields,
  searchValue,
}: CollectionItemSelectOptionsProps) {
  const query = searchValue?.trim().toLowerCase() ?? '';
  const matches = (label: string) => !query || label.toLowerCase().includes(query);

  const showCurrentPageItem = canUseCurrentPageItem && matches('Current page item');
  const showCurrentCollectionItem = canUseCurrentCollectionItem && matches('Current collection item');
  const filteredReferenceOptions = referenceItemOptions.filter(opt => matches(opt.label));
  const filteredItems = collectionItems.filter(item => matches(getDisplayName(item, collectionFields)));

  const hasSpecialOptions = showCurrentPageItem || showCurrentCollectionItem || filteredReferenceOptions.length > 0;
  const hasAnyResults = hasSpecialOptions || filteredItems.length > 0;

  if (!hasAnyResults && query) {
    return (
      <div className="px-2 py-4 text-center text-xs text-muted-foreground">
        No items found
      </div>
    );
  }

  return (
    <>
      {showCurrentPageItem && (
        <SelectItem value="current-page">
          <div className="flex items-center gap-2">
            Current page item
          </div>
        </SelectItem>
      )}
      {showCurrentCollectionItem && (
        <SelectItem value="current-collection">
          <div className="flex items-center gap-2">
            Current collection item
          </div>
        </SelectItem>
      )}
      {filteredReferenceOptions.map((opt) => (
        <SelectItem key={opt.value} value={opt.value}>
          <div className="flex items-center gap-2">
            {opt.label}
          </div>
        </SelectItem>
      ))}
      {hasSpecialOptions && filteredItems.length > 0 && <SelectSeparator />}
      {filteredItems.map((item) => (
        <SelectItem key={item.id} value={item.id}>
          {getDisplayName(item, collectionFields)}
        </SelectItem>
      ))}
    </>
  );
}
