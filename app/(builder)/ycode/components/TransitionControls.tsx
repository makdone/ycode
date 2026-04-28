'use client';

import { memo, useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import Icon from '@/components/ui/icon';
import SettingsPanel from './SettingsPanel';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useEditorStore } from '@/stores/useEditorStore';
import { extractMeasurementValue } from '@/lib/measurement-utils';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';

interface TransitionControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

const TransitionControls = memo(function TransitionControls({ layer, onLayerUpdate }: TransitionControlsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, debouncedUpdateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  const transitionProperty = getDesignProperty('transitions', 'transitionProperty') || '';
  const duration = getDesignProperty('transitions', 'duration') || '';
  const easing = getDesignProperty('transitions', 'easing') || '';
  const delay = getDesignProperty('transitions', 'delay') || '';

  const hasEasing = !!easing;
  const hasDelay = !!delay;

  const inputs = useControlledInputs({ duration, delay }, extractMeasurementValue);

  const createTimingHandler = useCallback(
    (property: string, setter: (v: string) => void) => (value: string) => {
      let sanitized = removeSpaces(value);
      if (sanitized.endsWith('s') && !sanitized.endsWith('ms')) {
        sanitized = String(parseFloat(sanitized) * 1000);
      }
      setter(sanitized);
      debouncedUpdateDesignProperty('transitions', property, sanitized || null);
    },
    [debouncedUpdateDesignProperty]
  );

  const handleDurationChange = createTimingHandler('duration', inputs.duration[1]);
  const handleDelayChange = createTimingHandler('delay', inputs.delay[1]);

  const handlePropertyChange = useCallback((value: string) => {
    updateDesignProperty('transitions', 'transitionProperty', value || null);
  }, [updateDesignProperty]);

  const handleEasingChange = useCallback((value: string) => {
    updateDesignProperty('transitions', 'easing', value || null);
  }, [updateDesignProperty]);

  const handleAddEasing = useCallback(() => {
    updateDesignProperty('transitions', 'easing', 'linear');
  }, [updateDesignProperty]);

  const handleAddDelay = useCallback(() => {
    inputs.delay[1]('0');
    updateDesignProperty('transitions', 'delay', '0');
  }, [inputs.delay, updateDesignProperty]);

  return (
    <SettingsPanel
      title="Transition"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs">
              <Icon name="plus" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleAddEasing} disabled={hasEasing}>
              Easing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddDelay} disabled={hasDelay}>
              Delay
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* Transition Property */}
      <div className="grid grid-cols-3">
        <Label variant="muted">Property</Label>
        <div className="col-span-2 *:w-full">
          <Select
            value={transitionProperty}
            onValueChange={handlePropertyChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="colors">Colors</SelectItem>
                <SelectItem value="opacity">Opacity</SelectItem>
                <SelectItem value="shadow">Shadow</SelectItem>
                <SelectItem value="transform">Transform</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Duration */}
      <div className="grid grid-cols-3">
        <Label variant="muted">Duration</Label>
        <div className="col-span-2">
          <InputGroup>
            <InputGroupInput
              value={inputs.duration[0]}
              onChange={(e) => handleDurationChange(e.target.value)}
              placeholder="150"
            />
            <InputGroupAddon align="inline-end">ms</InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      {/* Easing */}
      {hasEasing && (
        <div className="grid grid-cols-3">
          <Label variant="muted">Easing</Label>
          <div className="col-span-2 *:w-full">
            <Select
              value={easing}
              onValueChange={handleEasingChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="linear">Linear</SelectItem>
                  <SelectItem value="in">Ease In</SelectItem>
                  <SelectItem value="out">Ease Out</SelectItem>
                  <SelectItem value="in-out">Ease In Out</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Delay */}
      {hasDelay && (
        <div className="grid grid-cols-3">
          <Label variant="muted">Delay</Label>
          <div className="col-span-2">
            <InputGroup>
              <InputGroupInput
                value={inputs.delay[0]}
                onChange={(e) => handleDelayChange(e.target.value)}
                placeholder="0"
              />
              <InputGroupAddon align="inline-end">ms</InputGroupAddon>
            </InputGroup>
          </div>
        </div>
      )}
    </SettingsPanel>
  );
});

export default TransitionControls;
