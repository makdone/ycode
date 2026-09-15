'use client';

import { useState, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import GridSpanRow from './GridSpanRow';
import SettingsPanel from './SettingsPanel';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useParentLayout } from '@/hooks/use-parent-layout';
import { useEditorStore } from '@/stores/useEditorStore';
import { extractMeasurementValue, formatMeasurementValue } from '@/lib/measurement-utils';
import type { Layer } from '@/types';

interface SizingControlsProps {
  layer: Layer | null;
  /** Needed to show the grid Span row, which only applies inside a grid parent */
  parentLayer?: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

// Round only the outer corner of each grid corner cell so the 3x3 grid reads as one rounded block
const OBJECT_POSITION_CORNERS: Record<string, string> = {
  'left-top': 'rounded-tl-lg',
  'right-top': 'rounded-tr-lg',
  'left-bottom': 'rounded-bl-lg',
  'right-bottom': 'rounded-br-lg',
};

// 3x3 focal point grid: cell position maps to the image alignment value
const OBJECT_POSITIONS: { value: string; label: string; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
  { value: 'left-top', label: 'Top left', icon: 'arrow-left-up' },
  { value: 'top', label: 'Top center', icon: 'arrow-up' },
  { value: 'right-top', label: 'Top right', icon: 'arrow-right-up' },
  { value: 'left', label: 'Center left', icon: 'arrow-left' },
  { value: 'center', label: 'Center', icon: 'circle' },
  { value: 'right', label: 'Center right', icon: 'arrow-right' },
  { value: 'left-bottom', label: 'Bottom left', icon: 'arrow-left-down' },
  { value: 'bottom', label: 'Bottom center', icon: 'arrow-down' },
  { value: 'right-bottom', label: 'Bottom right', icon: 'arrow-right-down' },
];

const SizingControls = memo(function SizingControls({ layer, parentLayer = null, onLayerUpdate }: SizingControlsProps) {
  const activeBreakpoint = useEditorStore((s) => s.activeBreakpoint);
  const activeUIState = useEditorStore((s) => s.activeUIState);
  const { updateDesignProperty, debouncedUpdateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });
  const { isGrid: parentIsGrid } = useParentLayout(parentLayer);

  const [isOpen, setIsOpen] = useState(true);

  // Get current values from layer (with inheritance)
  const width = getDesignProperty('sizing', 'width') || '';
  const height = getDesignProperty('sizing', 'height') || '';
  const minWidth = getDesignProperty('sizing', 'minWidth') || '';
  const minHeight = getDesignProperty('sizing', 'minHeight') || '';
  const maxWidth = getDesignProperty('sizing', 'maxWidth') || '';
  const maxHeight = getDesignProperty('sizing', 'maxHeight') || '';
  const overflow = getDesignProperty('sizing', 'overflow') || 'visible';
  const aspectRatio = getDesignProperty('sizing', 'aspectRatio') || '';
  const objectFit = getDesignProperty('sizing', 'objectFit') || '';
  const objectPosition = getDesignProperty('sizing', 'objectPosition') || '';
  const gridColumnSpan = getDesignProperty('sizing', 'gridColumnSpan') || '';
  const gridRowSpan = getDesignProperty('sizing', 'gridRowSpan') || '';

  // Extract aspect ratio value for display (remove brackets)
  const extractAspectRatioValue = (value: string): string => {
    if (!value) return '';
    // Remove brackets: [16/9] → 16/9
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1);
    }
    return value;
  };

  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  }, extractMeasurementValue);

  const [widthInput, setWidthInput] = inputs.width;
  const [heightInput, setHeightInput] = inputs.height;
  const [minWidthInput, setMinWidthInput] = inputs.minWidth;
  const [minHeightInput, setMinHeightInput] = inputs.minHeight;
  const [maxWidthInput, setMaxWidthInput] = inputs.maxWidth;
  const [maxHeightInput, setMaxHeightInput] = inputs.maxHeight;

  // Aspect ratio uses custom extraction to remove brackets
  const [aspectRatioInput, setAspectRatioInput] = useState(extractAspectRatioValue(aspectRatio));

  // Sync aspect ratio input when prop changes
  useEffect(() => {
    setAspectRatioInput(extractAspectRatioValue(aspectRatio));
  }, [aspectRatio]);

  // Handle width changes (debounced for text input)
  const handleWidthChange = (value: string) => {
    setWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'width', formatMeasurementValue(value));
  };

  // Get current width preset value (for Select display)
  const getWidthPresetValue = () => {
    if (widthInput === '100%') return 'w-[100%]';
    if (widthInput === 'fit') return 'w-fit-content';
    if (widthInput === '100vw') return 'w-[100vw]';
    return '';
  };

  // Preset changes are immediate (button clicks)
  const handleWidthPresetChange = (value: string) => {
    if (value === 'w-[100%]') {
      setWidthInput('100%');
      updateDesignProperty('sizing', 'width', '[100%]');
    } else if (value === 'w-fit-content') {
      setWidthInput('fit');
      updateDesignProperty('sizing', 'width', 'fit');
    } else if (value === 'w-[100vw]') {
      setWidthInput('100vw');
      updateDesignProperty('sizing', 'width', '[100vw]');
    }
  };

  // Handle height changes (debounced for text input)
  const handleHeightChange = (value: string) => {
    setHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'height', formatMeasurementValue(value));
  };

  // Get current height preset value (for Select display)
  const getHeightPresetValue = () => {
    if (heightInput === '100%') return 'h-[100%]';
    if (heightInput === '100svh') return 'h-[100svh]';
    return '';
  };

  // Preset changes are immediate (button clicks)
  const handleHeightPresetChange = (value: string) => {
    if (value === 'h-[100%]') {
      setHeightInput('100%');
      updateDesignProperty('sizing', 'height', '[100%]');
    } else if (value === 'h-[100svh]') {
      setHeightInput('100svh');
      updateDesignProperty('sizing', 'height', '[100svh]');
    }
  };

  // Get current min/max width preset values
  const getMinWidthPresetValue = () => {
    if (minWidthInput === '100%') return 'w-[100%]';
    if (minWidthInput === 'fit') return 'w-fit-content';
    if (minWidthInput === '100vw') return 'w-[100vw]';
    return '';
  };

  const getMaxWidthPresetValue = () => {
    if (maxWidthInput === '100%') return 'w-[100%]';
    if (maxWidthInput === 'fit') return 'w-fit-content';
    if (maxWidthInput === '100vw') return 'w-[100vw]';
    return '';
  };

  // Handle min/max width changes (debounced for text input)
  const handleMinWidthChange = (value: string) => {
    setMinWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'minWidth', formatMeasurementValue(value));
  };

  const handleMinWidthPresetChange = (value: string) => {
    if (value === 'w-[100%]') {
      setMinWidthInput('100%');
      updateDesignProperty('sizing', 'minWidth', '[100%]');
    } else if (value === 'w-fit-content') {
      setMinWidthInput('fit');
      updateDesignProperty('sizing', 'minWidth', 'fit');
    } else if (value === 'w-[100vw]') {
      setMinWidthInput('100vw');
      updateDesignProperty('sizing', 'minWidth', '[100vw]');
    }
  };

  const handleMaxWidthChange = (value: string) => {
    setMaxWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'maxWidth', formatMeasurementValue(value));
  };

  const handleMaxWidthPresetChange = (value: string) => {
    if (value === 'w-[100%]') {
      setMaxWidthInput('100%');
      updateDesignProperty('sizing', 'maxWidth', '[100%]');
    } else if (value === 'w-fit-content') {
      setMaxWidthInput('fit');
      updateDesignProperty('sizing', 'maxWidth', 'fit');
    } else if (value === 'w-[100vw]') {
      setMaxWidthInput('100vw');
      updateDesignProperty('sizing', 'maxWidth', '[100vw]');
    }
  };

  // Get current min/max height preset values
  const getMinHeightPresetValue = () => {
    if (minHeightInput === '100%') return 'h-[100%]';
    if (minHeightInput === '100svh') return 'h-[100svh]';
    return '';
  };

  const getMaxHeightPresetValue = () => {
    if (maxHeightInput === '100%') return 'h-[100%]';
    if (maxHeightInput === '100svh') return 'h-[100svh]';
    return '';
  };

  // Handle min/max height changes (debounced for text input)
  const handleMinHeightChange = (value: string) => {
    setMinHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'minHeight', formatMeasurementValue(value));
  };

  const handleMinHeightPresetChange = (value: string) => {
    if (value === 'h-[100%]') {
      setMinHeightInput('100%');
      updateDesignProperty('sizing', 'minHeight', '[100%]');
    } else if (value === 'h-[100svh]') {
      setMinHeightInput('100svh');
      updateDesignProperty('sizing', 'minHeight', '[100svh]');
    }
  };

  const handleMaxHeightChange = (value: string) => {
    setMaxHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'maxHeight', formatMeasurementValue(value));
  };

  const handleMaxHeightPresetChange = (value: string) => {
    if (value === 'h-[100%]') {
      setMaxHeightInput('100%');
      updateDesignProperty('sizing', 'maxHeight', '[100%]');
    } else if (value === 'h-[100svh]') {
      setMaxHeightInput('100svh');
      updateDesignProperty('sizing', 'maxHeight', '[100svh]');
    }
  };

  // Handle overflow change
  const handleOverflowChange = (value: string) => {
    updateDesignProperty('sizing', 'overflow', value);
  };

  // Handle aspect ratio changes (debounced for text input)
  const handleAspectRatioChange = (value: string) => {
    setAspectRatioInput(value);
    // Format as [16/9] for arbitrary values
    const formattedValue = value ? `[${value}]` : null;
    debouncedUpdateDesignProperty('sizing', 'aspectRatio', formattedValue);
  };

  // Get current aspect ratio preset value (for Select display)
  const getAspectRatioPresetValue = () => {
    if (aspectRatioInput === '16/9') return 'aspect-video';
    if (aspectRatioInput === '1/1') return 'aspect-square';
    if (aspectRatioInput === '4/3') return 'aspect-4/3';
    if (aspectRatioInput === '3/4') return 'aspect-3/4';
    return '';
  };

  // Preset changes are immediate (dropdown selection)
  const handleAspectRatioPresetChange = (value: string) => {
    if (value === 'aspect-video') {
      setAspectRatioInput('16/9');
      updateDesignProperty('sizing', 'aspectRatio', '[16/9]');
    } else if (value === 'aspect-square') {
      setAspectRatioInput('1/1');
      updateDesignProperty('sizing', 'aspectRatio', '[1/1]');
    } else if (value === 'aspect-4/3') {
      setAspectRatioInput('4/3');
      updateDesignProperty('sizing', 'aspectRatio', '[4/3]');
    } else if (value === 'aspect-3/4') {
      setAspectRatioInput('3/4');
      updateDesignProperty('sizing', 'aspectRatio', '[3/4]');
    } else if (value === 'aspect-auto') {
      setAspectRatioInput('');
      updateDesignProperty('sizing', 'aspectRatio', null);
    }
  };

  const handleAddAspectRatio = () => {
    setAspectRatioInput('1/1');
    updateDesignProperty('sizing', 'aspectRatio', '[1/1]');
  };

  const handleRemoveAspectRatio = () => {
    setAspectRatioInput('');
    updateDesignProperty('sizing', 'aspectRatio', null);
  };

  // Handle object-fit change
  const handleObjectFitChange = (value: string) => {
    updateDesignProperty('sizing', 'objectFit', value || null);
  };

  // Handle object-position change (center is the browser default, so clear it)
  const handleObjectPositionChange = (value: string) => {
    updateDesignProperty('sizing', 'objectPosition', value === 'center' ? null : value);
  };

  return (
    <SettingsPanel
      title="Sizing" isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs">
              <Icon name="plus" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleAddAspectRatio}
              disabled={!!aspectRatio}
            >
              Aspect ratio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {parentIsGrid && layer && (
        <>
          <GridSpanRow
            label="Columns"
            layer={layer}
            property="gridColumnSpan"
            value={gridColumnSpan}
            onChange={(property, value) => updateDesignProperty('sizing', property, value)}
          />
          <GridSpanRow
            label="Rows"
            layer={layer}
            property="gridRowSpan"
            value={gridRowSpan}
            onChange={(property, value) => updateDesignProperty('sizing', property, value)}
          />
        </>
      )}

      {aspectRatio && (
        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Aspect ratio</Label>
          <div className="col-span-2 flex items-center gap-2">
            <ButtonGroup className="flex-1">
              <Input
                value={aspectRatioInput}
                onChange={(e) => handleAspectRatioChange(e.target.value)}
              />
              <ButtonGroupSeparator />
              <Select value={getAspectRatioPresetValue()} onValueChange={handleAspectRatioPresetChange}>
                <SelectTrigger />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="aspect-square">Square</SelectItem>
                    <SelectItem value="aspect-video">Video</SelectItem>
                    <SelectItem value="aspect-4/3">4:3</SelectItem>
                    <SelectItem value="aspect-3/4">3:4</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ButtonGroup>
            <button
              type="button"
              className="p-0.5 rounded-sm opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handleRemoveAspectRatio}
            >
              <Icon name="x" className="size-2.5" />
            </button>
          </div>
        </div>
      )}

    </SettingsPanel>
  );
});
export default SizingControls;
