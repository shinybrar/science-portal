'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  LinearProgress,
  Alert,
  Button,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import { Close as CloseIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import type { PortalModalProps } from '@/app/types/PortalModalProps';
import { tokens } from '@/app/design-system/tokens';

/**
 * Unified modal shell for portal dialogs.
 *
 * Mirrors {@link DashboardWidget} loading semantics:
 * - `isLoading` → spinner in the body + indeterminate progress bar
 * - `isFetching` → stale `children` stay visible + indeterminate progress bar
 * - idle → determinate success bar (same as dashboard widgets at rest)
 */
export const PortalModalImpl = React.forwardRef<HTMLDivElement, PortalModalProps>(
  (
    {
      open,
      onClose,
      title,
      icon,
      isLoading = false,
      isFetching = false,
      error,
      alert,
      disableClose = false,
      onRefresh,
      refreshAriaLabel = 'refresh',
      refreshTooltip = 'Refresh',
      headerActions,
      actions,
      closeLabel = 'Close',
      showProgressBar = true,
      progressValue = 100,
      maxWidth = 'sm',
      fullScreenMobile = true,
      showInitialSpinner = true,
      showCloseButton = true,
      titleId = 'portal-modal-title',
      children,
    },
    ref,
  ) => {
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));
    const isBusy = isLoading || isFetching;

    const handleClose = () => {
      if (disableClose) return;
      onClose();
    };

    const refreshButton = onRefresh && (
      <Tooltip title={refreshTooltip}>
        <span>
          <IconButton
            aria-label={refreshAriaLabel}
            onClick={onRefresh}
            disabled={isBusy}
            size="small"
          >
            <RefreshIcon />
          </IconButton>
        </span>
      </Tooltip>
    );

    return (
      <Dialog
        ref={ref}
        open={open}
        onClose={handleClose}
        maxWidth={maxWidth}
        fullWidth
        fullScreen={fullScreenMobile && isMobile}
        aria-labelledby={titleId}
        disableEscapeKeyDown={disableClose}
      >
        <DialogTitle id={titleId} sx={{ m: 0, p: 2, pr: showCloseButton ? 1 : 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
            <Box display="flex" alignItems="center" gap={1} minWidth={0}>
              {icon}
              <Typography variant="h6" component="span" noWrap>
                {title}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
              {headerActions}
              {refreshButton}
              {showCloseButton && (
                <IconButton
                  onClick={handleClose}
                  size="small"
                  aria-label="close modal"
                  disabled={disableClose}
                >
                  <CloseIcon />
                </IconButton>
              )}
            </Box>
          </Box>
        </DialogTitle>

        {/* Status bar — always visible like DashboardWidget; busy = primary indeterminate. */}
        {showProgressBar &&
          (isBusy ? (
            <Box sx={{ flexShrink: 0, px: 3, mb: 1.5 }}>
              <LinearProgress
                color="primary"
                variant="indeterminate"
                sx={{
                  width: '100%',
                  height: 3,
                  borderRadius: 2,
                  '& .MuiLinearProgress-bar': { borderRadius: 2 },
                }}
              />
            </Box>
          ) : (
            <Box
              aria-hidden
              sx={{
                flexShrink: 0,
                mx: 3,
                mb: 1.5,
                height: '1px',
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? tokens.colors.surface.hairline.dark
                    : tokens.colors.surface.hairline.light,
              }}
            />
          ))}

        <DialogContent sx={{ pt: 2 }}>
          {alert}
          {error && !isLoading && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {showInitialSpinner && isLoading && (
            <Box display="flex" justifyContent="center" alignItems="center" py={4}>
              <CircularProgress />
            </Box>
          )}

          {!isLoading && children}
        </DialogContent>

        {actions !== false && (
          <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
            {actions ?? (
              <Button onClick={handleClose} variant="outlined" disabled={disableClose}>
                {closeLabel}
              </Button>
            )}
          </DialogActions>
        )}
      </Dialog>
    );
  },
);

PortalModalImpl.displayName = 'PortalModalImpl';
