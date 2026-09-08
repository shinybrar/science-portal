'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, FormLabel, InputAdornment, TextField, Typography } from '@mui/material';
import { CanfarRange } from '@/app/components/CanfarRange/CanfarRange';
import { nearestOption, resourceSliderMarkIndices } from '@/lib/utils/resource-options';
import { ResourceFieldProps } from '@/app/types/ResourceFieldProps';

const VALUE_FIELD_WIDTH = 72;

function formatAxisLabel(value: number, unit?: string): string {
  return unit ? `${value} ${unit}` : String(value);
}

const ResourceFieldComponent = React.forwardRef<HTMLDivElement, ResourceFieldProps>(
  ({ label, value, options, unit, onChange, disabled = false }, ref) => {
    const inputId = `${label.replace(/\s+/g, '-').toLowerCase()}-value`;

    const [draft, setDraft] = useState(value);
    const [text, setText] = useState(String(value));
    const isInteracting = useRef(false);

    const validOptions = useMemo(() => {
      const sorted = [...options].filter((n) => n >= 1).sort((a, b) => a - b);
      return sorted.length > 0 ? sorted : [1];
    }, [options]);
    const floor = validOptions[0];
    const hi = validOptions[validOptions.length - 1] ?? 0;
    const axis = useMemo(
      () => (floor > 0 ? [0, ...validOptions] : validOptions),
      [floor, validOptions],
    );

    const sliderMarks = useMemo(() => {
      const indices = new Set(resourceSliderMarkIndices(axis));
      if (floor > 0) {
        const floorIndex = axis.indexOf(floor);
        if (floorIndex >= 0) indices.add(floorIndex);
      }
      return [...indices].sort((left, right) => left - right).map((index) => ({ value: index }));
    }, [axis, floor]);

    const sliderIndex = useMemo(() => {
      const index = axis.indexOf(draft);
      return index >= 0 ? index : axis.indexOf(floor);
    }, [axis, draft, floor]);

    const resolveIndex = useCallback(
      (index: number) => {
        const raw = axis[index];
        if (raw === undefined || raw < floor) return floor;
        return nearestOption(raw, validOptions);
      },
      [axis, floor, validOptions],
    );

    useEffect(() => {
      if (isInteracting.current) return;
      const next = value < floor ? floor : value;
      setDraft(next);
      setText(String(next));
      if (next !== value) {
        onChange(next);
      }
    }, [floor, onChange, value]);

    const commit = useCallback(
      (next: number) => {
        const snapped = nearestOption(Math.max(next, floor), validOptions);
        setDraft(snapped);
        setText(String(snapped));
        if (snapped !== value) {
          onChange(snapped);
        }
      },
      [floor, onChange, validOptions, value],
    );

    const handleSliderChange = useCallback(
      (next: number) => {
        isInteracting.current = true;
        const resolved = resolveIndex(next);
        setDraft(resolved);
        setText(String(resolved));
      },
      [resolveIndex],
    );

    const handleSliderCommitted = useCallback(
      (next: number) => {
        isInteracting.current = false;
        commit(resolveIndex(next));
      },
      [commit, resolveIndex],
    );

    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      isInteracting.current = true;
      setText(event.target.value);
    }, []);

    const commitFromText = useCallback(() => {
      isInteracting.current = false;
      const parsed = Number(text);
      if (Number.isInteger(parsed)) {
        commit(parsed);
      } else {
        setText(String(draft));
      }
    }, [text, draft, commit]);

    const handleInputKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commitFromText();
        event.currentTarget.blur();
      },
      [commitFromText],
    );

    return (
      <Box
        ref={ref}
        sx={{
          display: 'grid',
          gridTemplateColumns: '4.5rem minmax(0, 1fr) 4.5rem',
          columnGap: 1.5,
          alignItems: 'center',
        }}
      >
        <FormLabel htmlFor={inputId} sx={{ fontSize: '0.75rem', fontWeight: 400, mb: 0 }}>
          {label}
        </FormLabel>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1.15rem minmax(0, 1fr) 3.5rem',
            columnGap: 0.75,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.65rem', lineHeight: 1, textAlign: 'right' }}
          >
            0
          </Typography>
          <Box sx={{ minWidth: 0 }}>
            <CanfarRange
              value={sliderIndex}
              min={0}
              max={Math.max(axis.length - 1, 0)}
              marks={sliderMarks}
              onChange={handleSliderChange}
              onChangeCommitted={handleSliderCommitted}
              disabled={disabled}
              label={label}
              valueMin={floor}
              valueMax={hi}
              valueNow={draft}
              valueText={unit ? `${draft} ${unit}` : String(draft)}
            />
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.65rem', lineHeight: 1, textAlign: 'left', whiteSpace: 'nowrap' }}
          >
            {formatAxisLabel(hi, unit)}
          </Typography>
        </Box>
        <TextField
          id={inputId}
          type="number"
          value={text}
          onChange={handleInputChange}
          onBlur={commitFromText}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          size="small"
          inputProps={{
            'aria-label': label,
            inputMode: 'numeric',
            min: floor,
            max: hi,
            step: 1,
          }}
          InputProps={{
            endAdornment: unit ? (
              <InputAdornment
                position="end"
                disableTypography
                sx={{
                  m: 0,
                  ml: 0.5,
                  height: 28,
                  maxHeight: 28,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Box
                  component="span"
                  sx={{
                    fontSize: '0.8125rem',
                    lineHeight: 1.25,
                    fontWeight: 400,
                    color: 'text.secondary',
                  }}
                >
                  {unit}
                </Box>
              </InputAdornment>
            ) : undefined,
          }}
          sx={{
            width: VALUE_FIELD_WIDTH,
            justifySelf: 'stretch',
            '& .MuiOutlinedInput-root': {
              height: 28,
              alignItems: 'center',
              pl: 1,
              pr: 1,
            },
            '& input[type=number]': { MozAppearance: 'textfield' },
            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
              {
                WebkitAppearance: 'none',
                margin: 0,
              },
            '& .MuiOutlinedInput-input': {
              height: 28,
              boxSizing: 'border-box',
              py: 0,
              px: 0,
              fontSize: '0.8125rem',
              lineHeight: 1.25,
              textAlign: 'left',
            },
          }}
        />
      </Box>
    );
  },
);

ResourceFieldComponent.displayName = 'ResourceFieldImpl';

export const ResourceFieldImpl = React.memo(ResourceFieldComponent);
