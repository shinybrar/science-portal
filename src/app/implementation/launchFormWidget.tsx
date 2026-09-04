'use client';

import React, { useCallback } from 'react';
import { Box, Alert } from '@mui/material';
import { LaunchFormWidgetProps } from '@/app/types/LaunchFormWidgetProps';
import { DashboardWidget } from '@/app/components/DashboardWidget/DashboardWidget';
import { SessionLaunchForm } from '@/app/components/SessionLaunchForm/SessionLaunchForm';
import { SessionRequestModal } from '@/app/components/SessionRequestModal/SessionRequestModal';
import { SessionFormData } from '@/app/types/SessionLaunchFormProps';
import { useLaunchRequest, useSessionUiActions } from '@/lib/stores';
import { useSessionLaunchQuota } from '@/lib/hooks/useSessionLaunchQuota';
import { SESSION_QUOTA_REACHED_MESSAGE } from '@/lib/sessions/sessionQuota';

export function LaunchFormWidgetImpl({
  isLoading = false,
  isFetching = false,
  errorMessage,
  onRefresh,
  title = 'Launch New Session',
  showProgressIndicator = false,
  progressPercentage = 0,
  helpUrl,
  signInAlertMessage,
  imagesByType = {},
  repositoryHosts = [],
  activeSessions = [],
  launchSessionFn,
  onLaunch,
  ...sessionLaunchFormProps
}: LaunchFormWidgetProps) {
  const launchRequest = useLaunchRequest();
  const { setLaunchRequest } = useSessionUiActions();
  const quota = useSessionLaunchQuota(activeSessions, launchRequest?.status);

  const handleLaunch = useCallback(
    async (formData: SessionFormData) => {
      if (!quota.canLaunch) {
        return;
      }

      setLaunchRequest({ status: 'requesting', sessionData: formData });

      try {
        // Prefer explicit sourceTab from the form; fall back to inferring from
        // Advanced-only fields for older callers / retries.
        const isAdvancedLaunch =
          formData.sourceTab === 'advanced' ||
          (formData.sourceTab !== 'standard' && Boolean(formData.image?.trim()));

        const imageToUse = isAdvancedLaunch
          ? `${formData.repositoryHost}/${formData.image}`
          : formData.containerImage;

        const launchParams = {
          sessionType: formData.type,
          sessionName: formData.sessionName,
          containerImage: imageToUse,
          ...(formData.resourceType === 'fixed' && {
            cores: formData.cores,
            ram: formData.memory,
            ...(formData.gpus && formData.gpus > 0 && { gpus: formData.gpus }),
          }),
          ...(isAdvancedLaunch &&
            formData.repositoryAuthUsername &&
            formData.repositoryAuthSecret && {
              registryUsername: formData.repositoryAuthUsername,
              registrySecret: formData.repositoryAuthSecret,
            }),
        };

        if (launchSessionFn) {
          await launchSessionFn(launchParams);
        } else {
          const { launchSession } = await import('@/lib/api/skaha');
          await launchSession(launchParams);
        }

        if (onLaunch) {
          await onLaunch(formData);
        }

        setLaunchRequest(null);
      } catch (error) {
        setLaunchRequest({
          status: 'error',
          sessionData: formData,
          error: error instanceof Error ? error.message : 'An unknown error occurred',
        });
      }
    },
    [launchSessionFn, onLaunch, quota.canLaunch, setLaunchRequest],
  );

  const handleModalClose = useCallback(() => {
    setLaunchRequest(null);
  }, [setLaunchRequest]);

  const handleRetry = useCallback(() => {
    if (launchRequest?.sessionData && quota.canLaunch) {
      void handleLaunch(launchRequest.sessionData);
    }
  }, [launchRequest?.sessionData, quota.canLaunch, handleLaunch]);

  return (
    <DashboardWidget
      title={title}
      isLoading={isLoading}
      isFetching={isFetching}
      error={errorMessage}
      onRefresh={onRefresh}
      help={helpUrl ? { url: helpUrl } : undefined}
      statusValue={showProgressIndicator ? progressPercentage : 100}
      alert={
        signInAlertMessage ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {signInAlertMessage}
          </Alert>
        ) : undefined
      }
    >
      <Box sx={{ marginBottom: 2 }}>
        <SessionLaunchForm
          {...sessionLaunchFormProps}
          imagesByType={imagesByType}
          onLaunch={handleLaunch}
          isLoading={isLoading}
          repositoryHosts={repositoryHosts}
          activeSessions={activeSessions}
          canLaunch={quota.canLaunch}
          launchDisabledReason={SESSION_QUOTA_REACHED_MESSAGE}
        />
      </Box>

      <SessionRequestModal
        open={launchRequest !== null}
        sessionName={launchRequest?.sessionData.sessionName || ''}
        sessionType={launchRequest?.sessionData.type || ''}
        status={launchRequest?.status ?? 'requesting'}
        errorMessage={launchRequest?.error}
        onClose={handleModalClose}
        onRetry={handleRetry}
      />
    </DashboardWidget>
  );
}
