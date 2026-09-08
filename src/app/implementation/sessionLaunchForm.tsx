'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  MenuItem,
  Button,
  Alert,
  Divider,
  Grid,
  Tooltip,
  SelectChangeEvent,
  useTheme,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Skeleton,
  Stack,
  Checkbox,
} from '@mui/material';
import { HelpOutline as HelpOutlineIcon } from '@mui/icons-material';
import { useQueryStates, parseAsString, parseAsInteger, createParser } from 'nuqs';
import { Select } from '@/app/components/Select/Select';
import { TextField } from '@/app/components/TextField/TextField';
import { Card, CardContent } from '@/app/components/Card';
import { ResourceField } from '@/app/components/ResourceField/ResourceField';
import {
  SessionLaunchFormProps,
  SessionFormData,
  SessionType,
  type LaunchFormTab,
} from '@/app/types/SessionLaunchFormProps';
import {
  getProjectNames,
  filterImagesByProjectForRegistry,
  type ImagesByProject,
} from '@/lib/utils/image-parser';
import {
  DEFAULT_CORES_NUMBER,
  DEFAULT_RAM_NUMBER,
  DEFAULT_MEMORY_OPTIONS,
  DEFAULT_CORE_OPTIONS,
  DEFAULT_IMAGE_NAMES,
  supportsCustomResources,
  DESKTOP_TYPE,
  FIREFLY_TYPE,
  NOTEBOOK_TYPE,
  SKAHA_PROJECT,
} from '@/lib/config/constants';

/** MUI Tabs indices — Standard / Advanced keep independent form drafts. */
const LAUNCH_TAB = {
  STANDARD: 0,
  ADVANCED: 1,
} as const;

type LaunchTabIndex = (typeof LAUNCH_TAB)[keyof typeof LAUNCH_TAB];

type FormsByTab = Record<LaunchTabIndex, SessionFormData>;
type ResourceTypeByTab = Record<LaunchTabIndex, 'flexible' | 'fixed'>;
type DirtyByTab = Record<LaunchTabIndex, boolean>;

/**
 * Shareable launch-form tab: `?tab=standard` | `?tab=advanced`.
 * Also accepts legacy `0` / `1` from older links.
 * Auth username/secret are intentionally never URL state.
 */
const parseAsLaunchTab = createParser<LaunchFormTab>({
  parse(query) {
    if (query === 'standard' || query === '0') return 'standard';
    if (query === 'advanced' || query === '1') return 'advanced';
    return null;
  },
  serialize(value) {
    return value;
  },
})
  .withDefault('standard')
  // Keep `?tab=standard` visible so users can bookmark/share the active tab.
  .withOptions({ clearOnDefault: false });

function isLaunchTabIndex(value: number): value is LaunchTabIndex {
  return value === LAUNCH_TAB.STANDARD || value === LAUNCH_TAB.ADVANCED;
}

function sourceTabForIndex(tab: LaunchTabIndex): LaunchFormTab {
  return tab === LAUNCH_TAB.ADVANCED ? 'advanced' : 'standard';
}

function tabIndexFromSource(tab: LaunchFormTab): LaunchTabIndex {
  return tab === 'advanced' ? LAUNCH_TAB.ADVANCED : LAUNCH_TAB.STANDARD;
}

function defaultRepositoryHost(repositoryHosts: string[]): string {
  const rh = repositoryHosts.filter((host) => host && typeof host === 'string');
  return rh[0] || '';
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  const theme = useTheme();

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`session-tabpanel-${index}`}
      aria-labelledby={`session-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: theme.spacing(3) }}>{children}</Box>}
    </div>
  );
}

function ResourceModeFields({
  type,
  isLoading,
  options,
  values,
  onChange,
}: {
  type: 'flexible' | 'fixed';
  isLoading: boolean;
  options: {
    memory: readonly number[];
    cores: readonly number[];
    gpus: readonly number[];
  };
  values: {
    memory: number;
    cores: number;
    gpus: number;
  };
  onChange: {
    type: (event: React.ChangeEvent<HTMLInputElement>) => void;
    memory: (value: number) => void;
    cores: (value: number) => void;
    gpus: (value: number) => void;
  };
}) {
  const theme = useTheme();
  const gpuChoices = options.gpus.filter((n) => n > 0);
  const gpuEnabled = values.gpus > 0;

  return (
    <Grid container alignItems="flex-start" spacing={1}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <FormLabel>resources</FormLabel>
      </Grid>
      <Grid size={{ xs: 12, sm: 8 }}>
        <FormControl component="fieldset" sx={{ m: 0 }}>
          <RadioGroup
            row
            value={type}
            onChange={onChange.type}
            sx={{ minHeight: 32, alignItems: 'center' }}
          >
            <FormControlLabel
              value="flexible"
              control={
                <Radio
                  size="small"
                  sx={{
                    p: 0.5,
                    color: theme.palette.accent.main,
                    '&.Mui-checked': { color: theme.palette.accent.main },
                  }}
                />
              }
              label="Flexible"
              disabled={isLoading}
              sx={{ mr: 1.5, ml: 0 }}
            />
            <FormControlLabel
              value="fixed"
              control={
                <Radio
                  size="small"
                  sx={{
                    p: 0.5,
                    color: theme.palette.primary.dark,
                    '&.Mui-checked': { color: theme.palette.primary.dark },
                  }}
                />
              }
              label="Fixed"
              disabled={isLoading}
              sx={{ mr: 0, ml: 0 }}
            />
          </RadioGroup>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0 }}>
          {type === 'fixed'
            ? 'This session keeps the CPU and memory you set.'
            : 'Flexible resources allow dynamic allocation based on availability'}
        </Typography>
        {type === 'fixed' && (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <ResourceField
              label="Memory"
              unit="GB"
              value={values.memory}
              options={options.memory}
              onChange={onChange.memory}
              disabled={isLoading}
            />
            <ResourceField
              label="CPUs"
              value={values.cores}
              options={options.cores}
              onChange={onChange.cores}
              disabled={isLoading}
            />
            {gpuChoices.length > 0 && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={gpuEnabled}
                      onChange={(event) => {
                        onChange.gpus(event.target.checked ? (gpuChoices[0] ?? 1) : 0);
                      }}
                      disabled={isLoading}
                      sx={{ p: 0.5 }}
                    />
                  }
                  label="Request a GPU"
                  sx={{ alignSelf: 'flex-start', mx: 0, my: 0 }}
                />
                {gpuEnabled && gpuChoices.length > 1 && (
                  <ResourceField
                    label="GPU"
                    value={values.gpus}
                    options={gpuChoices}
                    onChange={onChange.gpus}
                    disabled={isLoading}
                  />
                )}
              </>
            )}
          </Stack>
        )}
      </Grid>
    </Grid>
  );
}

export const SessionLaunchFormImpl = React.forwardRef<HTMLDivElement, SessionLaunchFormProps>(
  (
    {
      onLaunch,
      onReset,
      onSessionTypeChange,
      imagesByType = {},
      repositoryHosts = [],
      memoryOptions,
      coreOptions,
      gpuOptions,
      defaultValues = {
        type: NOTEBOOK_TYPE,
        project: SKAHA_PROJECT,
        containerImage: '', // Will be auto-selected from imagesByType when data loads
        sessionName: 'notebook1',
        memory: DEFAULT_RAM_NUMBER,
        cores: DEFAULT_CORES_NUMBER,
        gpus: 0,
      },
      isLoading = false,
      errorMessage,
      activeSessions = [],
      canLaunch = true,
      launchDisabledReason,
    },
    ref,
  ) => {
    const theme = useTheme();

    const renderLaunchButton = (formIncomplete: boolean) => {
      const disabled = isLoading || !canLaunch || formIncomplete;
      const button = (
        <Button type="submit" variant="contained" size="small" disabled={disabled}>
          Launch
        </Button>
      );

      if (!canLaunch && launchDisabledReason) {
        return (
          <Tooltip title={launchDisabledReason}>
            <span>{button}</span>
          </Tooltip>
        );
      }

      return button;
    };

    // URL query parameters for deep linking / sharing.
    //
    // `tab` is always written (`standard` | `advanced`) so links open the
    // intended panel. Catalog fields (`project`, `image`) are Standard-only.
    // Advanced registry username/secret are never synced to the URL.
    const [urlParams, setUrlParams] = useQueryStates(
      {
        tab: parseAsLaunchTab,
        type: parseAsString.withDefault(defaultValues.type || NOTEBOOK_TYPE),
        project: parseAsString.withDefault(defaultValues.project || SKAHA_PROJECT),
        image: parseAsString.withDefault(defaultValues.containerImage || ''), // Standard catalog image id
        name: parseAsString.withDefault(defaultValues.sessionName || ''),
        memory: parseAsInteger, // Nullable - only present for Fixed resources
        cores: parseAsInteger, // Nullable - only present for Fixed resources
        gpus: parseAsInteger, // Nullable - only present for Fixed resources
      },
      {
        history: 'replace', // Use replace to avoid cluttering browser history
      },
    );

    // Initialize tab from URL parameter (`?tab=standard` | `?tab=advanced`)
    const [tabValue, setTabValue] = useState(() => tabIndexFromSource(urlParams.tab));
    const activeTab: LaunchTabIndex = isLaunchTabIndex(tabValue)
      ? tabValue
      : LAUNCH_TAB.STANDARD;
    const isAdvancedTab = activeTab === LAUNCH_TAB.ADVANCED;

    // Initialize resource type based on presence of cores/memory/gpus in URL
    const initialResourceType =
      urlParams.cores !== null || urlParams.memory !== null || urlParams.gpus !== null
        ? 'fixed'
        : 'flexible';

    // Independent drafts per tab — switching tabs must not leak Advanced
    // image/auth into a Standard launch (or vice versa).
    const [formsByTab, setFormsByTab] = useState<FormsByTab>(() => {
      const initial: SessionFormData = {
        type: urlParams.type as SessionType,
        project: urlParams.project,
        containerImage: urlParams.image,
        sessionName: urlParams.name || defaultValues.sessionName || 'notebook1',
        memory: urlParams.memory ?? defaultValues.memory ?? DEFAULT_RAM_NUMBER,
        cores: urlParams.cores ?? defaultValues.cores ?? DEFAULT_CORES_NUMBER,
        gpus: urlParams.gpus ?? defaultValues.gpus ?? 0,
        resourceType: initialResourceType,
        repositoryHost: defaultRepositoryHost(repositoryHosts),
        // Advanced-only fields start empty on both tabs so Standard never
        // inherits a leftover custom image/auth from a previous Advanced visit.
        image: '',
        repositoryAuthUsername: '',
        repositoryAuthSecret: '',
      };
      return {
        [LAUNCH_TAB.STANDARD]: { ...initial },
        [LAUNCH_TAB.ADVANCED]: { ...initial },
      };
    });

    const [resourceTypeByTab, setResourceTypeByTab] = useState<ResourceTypeByTab>(() => ({
      [LAUNCH_TAB.STANDARD]: initialResourceType,
      [LAUNCH_TAB.ADVANCED]: initialResourceType,
    }));

    // Dirty = the user explicitly edited some field (project, image, name,
    // registry, resources…). Changing the session *type* alone doesn't count:
    // on a clean form a type change is free to re-derive the default project,
    // while on a dirty form it must respect the user's project choice when
    // that project also exists for the new type. Cleared on Reset. A deep link
    // with a non-default project is treated as dirty — it's an explicit choice.
    const [dirtyByTab, setDirtyByTab] = useState<DirtyByTab>(() => {
      const fromUrl = urlParams.project !== (defaultValues.project || SKAHA_PROJECT);
      return {
        [LAUNCH_TAB.STANDARD]: fromUrl,
        [LAUNCH_TAB.ADVANCED]: false,
      };
    });

    const formData = formsByTab[activeTab];
    const standardForm = formsByTab[LAUNCH_TAB.STANDARD];
    const resourceType = resourceTypeByTab[activeTab];
    const isFormDirty = dirtyByTab[activeTab];

    // Ensure `?tab=` is present for bookmarking/sharing (including default `standard`).
    useEffect(() => {
      void setUrlParams({ tab: sourceTabForIndex(activeTab) });
    }, [activeTab, setUrlParams]);

    /** Patch only the active tab's draft (event handlers + active-tab effects). */
    const setFormData = useCallback(
      (updater: SessionFormData | ((prev: SessionFormData) => SessionFormData)) => {
        setFormsByTab((prev) => {
          const current = prev[activeTab];
          const next = typeof updater === 'function' ? updater(current) : updater;
          if (next === current) return prev;
          return { ...prev, [activeTab]: next };
        });
      },
      [activeTab],
    );

    const setIsFormDirty = useCallback(
      (dirty: boolean) => {
        setDirtyByTab((prev) =>
          prev[activeTab] === dirty ? prev : { ...prev, [activeTab]: dirty },
        );
      },
      [activeTab],
    );

    const setResourceType = useCallback(
      (next: 'flexible' | 'fixed') => {
        setResourceTypeByTab((prev) =>
          prev[activeTab] === next ? prev : { ...prev, [activeTab]: next },
        );
      },
      [activeTab],
    );

    const syncUrlFromForm = useCallback(
      (tab: LaunchTabIndex, data: SessionFormData, resources: 'flexible' | 'fixed') => {
        const isAdvanced = tab === LAUNCH_TAB.ADVANCED;
        setUrlParams({
          tab: sourceTabForIndex(tab),
          type: data.type,
          name: data.sessionName,
          // Catalog project/image are Standard-only; omit them on Advanced so
          // shared Advanced links open the tab without implying a catalog pick.
          project: isAdvanced ? null : data.project,
          image: isAdvanced ? null : data.containerImage,
          cores: resources === 'fixed' ? data.cores : null,
          memory: resources === 'fixed' ? data.memory : null,
          gpus: resources === 'fixed' ? (data.gpus ?? 0) : null,
        });
      },
      [setUrlParams],
    );

    const validHosts = useMemo(
      () => repositoryHosts.filter((h): h is string => typeof h === 'string' && h.length > 0),
      [repositoryHosts],
    );

    const hasMultipleRegistries = validHosts.length > 1;

    const effectiveRegistry = useMemo(() => {
      if (validHosts.length === 0) {
        return undefined;
      }
      const selected = formData.repositoryHost;
      if (selected && validHosts.includes(selected)) {
        return selected;
      }
      // Fall back to the first available registry so dependent fields stay populated
      // even before the user explicitly picks one.
      return validHosts[0];
    }, [validHosts, formData.repositoryHost]);

    const imagesByTypeForRegistry = useMemo(() => {
      const imagesForType = imagesByType[formData.type];
      if (!imagesForType || !effectiveRegistry) {
        return {} as ImagesByProject;
      }
      return filterImagesByProjectForRegistry(imagesForType, effectiveRegistry);
    }, [imagesByType, formData.type, effectiveRegistry]);

    const availableProjects = useMemo(
      () => getProjectNames(imagesByTypeForRegistry),
      [imagesByTypeForRegistry],
    );

    const availableImages = useMemo(() => {
      if (!formData.project || !effectiveRegistry) {
        return [];
      }
      return imagesByTypeForRegistry[formData.project] || [];
    }, [imagesByTypeForRegistry, formData.project, effectiveRegistry]);

    // Check if the selected session type supports resource configuration
    // firefly and desktop don't support custom resource allocation
    const supportsResourceConfig = useMemo(() => {
      return supportsCustomResources(formData.type);
    }, [formData.type]);

    // Count only interactive sessions — headless are batch jobs with their own quota.
    // Used for the auto-naming counter (notebook1, notebook2…).
    const activeSessionsCount = useMemo(
      () => activeSessions.filter((s) => s.sessionType !== 'headless' && s.sessionType !== 'desktop-app').length,
      [activeSessions],
    );

    // Generate the next available session name based on active sessions
    const generateSessionName = useCallback(
      (sessionType: string): string => {
        // Count all active sessions (regardless of type) to determine the next counter
        // The counter starts at activeSessionsCount + 1
        const counter = activeSessionsCount + 1;

        return `${sessionType}${counter}`;
      },
      [activeSessionsCount],
    );

    // Update session name when active sessions count changes or type changes
    // Auto-generate session name when type changes or on mount
    useEffect(() => {
      const newSessionName = generateSessionName(formData.type);
      setFormData((prev) => ({
        ...prev,
        sessionName: newSessionName,
      }));
      setUrlParams({ name: newSessionName });
    }, [activeSessionsCount, generateSessionName, formData.type, setFormData, setUrlParams]);

    // Keep Standard catalog project in sync with that tab's registry / type —
    // even while Advanced is active — so Standard stays ready on switch-back.
    useEffect(() => {
      const host =
        standardForm.repositoryHost && validHosts.includes(standardForm.repositoryHost)
          ? standardForm.repositoryHost
          : validHosts[0];
      if (!host) {
        return;
      }
      const imagesForType = imagesByType[standardForm.type];
      if (!imagesForType) {
        return;
      }
      const byProject = filterImagesByProjectForRegistry(imagesForType, host);
      const names = getProjectNames(byProject);
      if (names.length === 0) {
        return;
      }
      if (standardForm.project && names.includes(standardForm.project)) {
        return;
      }
      const nextProject = names.includes(SKAHA_PROJECT) ? SKAHA_PROJECT : names[0];
      setFormsByTab((prev) => ({
        ...prev,
        [LAUNCH_TAB.STANDARD]: {
          ...prev[LAUNCH_TAB.STANDARD],
          project: nextProject,
          containerImage: '',
        },
      }));
      if (activeTab === LAUNCH_TAB.STANDARD) {
        setUrlParams({ project: nextProject, image: '' });
      }
    }, [
      standardForm.repositoryHost,
      standardForm.type,
      standardForm.project,
      imagesByType,
      validHosts,
      activeTab,
      setUrlParams,
    ]);

    // Auto-select a catalog image on the Standard draft only.
    useEffect(() => {
      const host =
        standardForm.repositoryHost && validHosts.includes(standardForm.repositoryHost)
          ? standardForm.repositoryHost
          : validHosts[0];
      if (!host) {
        return;
      }
      const imagesForType = imagesByType[standardForm.type];
      if (!imagesForType) {
        return;
      }
      const byProject = filterImagesByProjectForRegistry(imagesForType, host);
      const images = standardForm.project ? byProject[standardForm.project] || [] : [];
      if (images.length === 0) {
        return;
      }
      const currentValid = images.some((img) => img.id === standardForm.containerImage);
      if (standardForm.containerImage && currentValid) {
        return;
      }
      const desired =
        DEFAULT_IMAGE_NAMES[standardForm.type as keyof typeof DEFAULT_IMAGE_NAMES];
      const desiredBase = desired?.split(':')[0];
      const exactMatch = desired ? images.find((img) => img.name === desired) : undefined;
      const baseMatch =
        !exactMatch && desiredBase
          ? images.find((img) => img.imageName === desiredBase)
          : undefined;
      const picked = exactMatch ?? baseMatch ?? images[0];
      setFormsByTab((prev) => ({
        ...prev,
        [LAUNCH_TAB.STANDARD]: {
          ...prev[LAUNCH_TAB.STANDARD],
          containerImage: picked.id,
        },
      }));
      if (activeTab === LAUNCH_TAB.STANDARD) {
        setUrlParams({ image: picked.id });
      }
    }, [
      standardForm.repositoryHost,
      standardForm.type,
      standardForm.project,
      standardForm.containerImage,
      imagesByType,
      validHosts,
      activeTab,
      setUrlParams,
    ]);

    // Always mirror a valid host on *both* tabs: single registry pins to it,
    // multiple registries fall back to the first available when invalid.
    useEffect(() => {
      if (validHosts.length === 0) {
        return;
      }
      setFormsByTab((prev) => {
        let changed = false;
        const next: FormsByTab = { ...prev };
        ([LAUNCH_TAB.STANDARD, LAUNCH_TAB.ADVANCED] as LaunchTabIndex[]).forEach((tab) => {
          const current = prev[tab].repositoryHost;
          if (current && validHosts.includes(current)) {
            return;
          }
          next[tab] = { ...prev[tab], repositoryHost: validHosts[0] };
          changed = true;
        });
        return changed ? next : prev;
      });
    }, [validHosts]);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
      if (!isLaunchTabIndex(newValue)) {
        return;
      }
      setTabValue(newValue);
      // Keep the URL aligned with the tab the user is looking at, without
      // copying field values between the two drafts.
      syncUrlFromForm(newValue, formsByTab[newValue], resourceTypeByTab[newValue]);
    };

    const handleFieldChange = useCallback(
      (field: keyof SessionFormData) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          const value =
            field === 'memory' || field === 'cores' || field === 'gpus'
              ? Number(event.target.value)
              : event.target.value;

          setIsFormDirty(true);
          setFormData((prev) => ({
            ...prev,
            [field]: value,
          }));

          // Sync session name to URL (never sync Advanced auth username/secret)
          if (field === 'sessionName') {
            setUrlParams({ name: value as string });
          }
        },
      [setUrlParams, setFormData, setIsFormDirty],
    );

    const handleSelectChange = useCallback(
      (field: keyof SessionFormData) => (event: SelectChangeEvent) => {
        const value =
          field === 'memory' || field === 'cores' || field === 'gpus'
            ? Number(event.target.value)
            : event.target.value;

        // Changing the type re-derives the project. On a clean form it snaps
        // back to the default; on a dirty form the user's selected project is
        // preserved when it also exists for the new type — only the container
        // image resets (re-auto-selected for the new type by the effect).
        let nextProject = SKAHA_PROJECT;
        if (field === 'type' && typeof value === 'string') {
          const imagesForNewType = imagesByType[value];
          const projectsForNewType =
            imagesForNewType && effectiveRegistry
              ? getProjectNames(
                  filterImagesByProjectForRegistry(imagesForNewType, effectiveRegistry),
                )
              : [];
          if (isFormDirty && formData.project && projectsForNewType.includes(formData.project)) {
            nextProject = formData.project;
          }
        } else {
          // Any explicit edit other than the type marks the form dirty.
          setIsFormDirty(true);
        }

        setFormData((prev) => {
          const newData = { ...prev, [field]: value };

          // Reset dependent fields when session type changes
          if (field === 'type' && typeof value === 'string') {
            newData.project = nextProject;
            newData.containerImage = ''; // Will be auto-selected by useEffect
            // Automatically update session name based on the new type
            newData.sessionName = generateSessionName(value);
          }

          if (field === 'repositoryHost') {
            newData.project = '';
            newData.containerImage = '';
          }

          // Reset container image when project changes
          if (field === 'project') {
            newData.containerImage = '';
          }

          return newData;
        });

        // URL updates — catalog project/image only while on Standard.
        // Advanced username/secret are never written here (text fields only).
        if (field === 'type') {
          const newType = value as string;
          if (newType === FIREFLY_TYPE || newType === DESKTOP_TYPE) {
            setUrlParams(
              isAdvancedTab
                ? {
                    tab: 'advanced',
                    type: newType,
                    cores: null,
                    memory: null,
                    gpus: null,
                  }
                : {
                    tab: 'standard',
                    type: newType,
                    project: nextProject,
                    image: '',
                    cores: null,
                    memory: null,
                    gpus: null,
                  },
            );
            setResourceType('flexible');
          } else if (isAdvancedTab) {
            setUrlParams({ tab: 'advanced', type: newType });
          } else {
            setUrlParams({
              tab: 'standard',
              type: newType,
              project: nextProject,
              image: '',
            });
          }
        } else if (field === 'repositoryHost') {
          if (!isAdvancedTab) {
            setUrlParams({ project: '', image: '' });
          }
        } else if (field === 'project' && !isAdvancedTab) {
          setUrlParams({ project: value as string, image: '' });
        } else if (field === 'containerImage' && !isAdvancedTab) {
          setUrlParams({ image: value as string });
        } else if (field === 'memory') {
          setUrlParams({ memory: value as number });
        } else if (field === 'cores') {
          setUrlParams({ cores: value as number });
        } else if (field === 'gpus') {
          setUrlParams({ gpus: value as number });
        }

        // Notify parent component when session type changes
        if (field === 'type' && onSessionTypeChange && typeof value === 'string') {
          onSessionTypeChange(value);
        }
      },
      [
        onSessionTypeChange,
        generateSessionName,
        setUrlParams,
        imagesByType,
        effectiveRegistry,
        isFormDirty,
        formData.project,
        setFormData,
        setIsFormDirty,
        setResourceType,
        isAdvancedTab,
      ],
    );

    const handleSubmit = useCallback(
      async (event: React.FormEvent) => {
        event.preventDefault();
        if (onLaunch) {
          await onLaunch({
            ...formData,
            resourceType,
            sourceTab: sourceTabForIndex(activeTab),
          });
        }
      },
      [formData, resourceType, activeTab, onLaunch],
    );

    const handleReset = useCallback(() => {
      const resetHost = defaultRepositoryHost(repositoryHosts);
      const resetForm: SessionFormData = {
        type: defaultValues.type || NOTEBOOK_TYPE,
        project: defaultValues.project || SKAHA_PROJECT,
        containerImage: '', // Will be auto-selected by useEffect
        sessionName: defaultValues.sessionName || 'notebook1',
        memory: defaultValues.memory || DEFAULT_RAM_NUMBER,
        cores: defaultValues.cores || DEFAULT_CORES_NUMBER,
        gpus: defaultValues.gpus ?? 0,
        resourceType: 'flexible',
        repositoryHost: resetHost,
        image: '',
        repositoryAuthUsername: '',
        repositoryAuthSecret: '',
      };

      setDirtyByTab({
        [LAUNCH_TAB.STANDARD]: false,
        [LAUNCH_TAB.ADVANCED]: false,
      });
      setFormsByTab({
        [LAUNCH_TAB.STANDARD]: { ...resetForm },
        [LAUNCH_TAB.ADVANCED]: { ...resetForm },
      });
      setResourceTypeByTab({
        [LAUNCH_TAB.STANDARD]: 'flexible',
        [LAUNCH_TAB.ADVANCED]: 'flexible',
      });
      setTabValue(LAUNCH_TAB.STANDARD);

      // Reset URL parameters to defaults (never write auth credentials)
      setUrlParams({
        tab: 'standard',
        type: defaultValues.type || NOTEBOOK_TYPE,
        project: defaultValues.project || SKAHA_PROJECT,
        image: '', // Will be auto-selected by useEffect
        name: defaultValues.sessionName || 'notebook1',
        cores: null, // Flexible = no cores/memory/gpus in URL
        memory: null,
        gpus: null,
      });

      if (onReset) {
        onReset();
      }
    }, [defaultValues, onReset, repositoryHosts, setUrlParams]);

    const handleResourceTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newResourceType = event.target.value as 'flexible' | 'fixed';
      setIsFormDirty(true);
      setResourceType(newResourceType);

      // Update formData with new resource type
      setFormData((prev) => ({
        ...prev,
        resourceType: newResourceType,
      }));

      // If switching to Flexible, unset cores, memory, and gpus from URL
      if (newResourceType === 'flexible') {
        setUrlParams({ cores: null, memory: null, gpus: null });
      } else {
        // If switching to Fixed, set the current form values to URL
        setUrlParams({ cores: formData.cores, memory: formData.memory, gpus: formData.gpus ?? 0 });
      }
    };

    const handleMemoryChange = useCallback(
      (value: number) => {
        setIsFormDirty(true);
        setFormData((prev) => ({ ...prev, memory: value }));
        setUrlParams({ memory: value });
      },
      [setUrlParams, setFormData, setIsFormDirty],
    );
    const handleCoresChange = useCallback(
      (value: number) => {
        setIsFormDirty(true);
        setFormData((prev) => ({ ...prev, cores: value }));
        setUrlParams({ cores: value });
      },
      [setUrlParams, setFormData, setIsFormDirty],
    );
    const handleGpusChange = useCallback(
      (value: number) => {
        setIsFormDirty(true);
        setFormData((prev) => ({ ...prev, gpus: value }));
        setUrlParams({ gpus: value });
      },
      [setUrlParams, setFormData, setIsFormDirty],
    );

    // Helper component for the help icon tooltip
    const HelpIcon = ({ title }: { title: string }) => (
      <Tooltip title={title} placement="top">
        <HelpOutlineIcon
          fontSize="small"
          sx={{
            ml: 0.5,
            color: theme.palette.primary.main,
            cursor: 'help',
            verticalAlign: 'middle',
          }}
        />
      </Tooltip>
    );

    const resourceModeFields = supportsResourceConfig ? (
      <ResourceModeFields
        type={resourceType}
        isLoading={isLoading}
        options={{
          memory: memoryOptions?.length ? memoryOptions : DEFAULT_MEMORY_OPTIONS,
          cores: coreOptions?.length ? coreOptions : DEFAULT_CORE_OPTIONS,
          gpus: gpuOptions?.length ? gpuOptions : [0],
        }}
        values={{
          memory: formData.memory,
          cores: formData.cores,
          gpus: formData.gpus || 0,
        }}
        onChange={{
          type: handleResourceTypeChange,
          memory: handleMemoryChange,
          cores: handleCoresChange,
          gpus: handleGpusChange,
        }}
      />
    ) : null;

    return (
      <Card ref={ref} elevation={0}>
        <CardContent
          sx={{
            // Better mobile padding
            [theme.breakpoints.down('sm')]: {
              padding: theme.spacing(1.5),
              '&:last-child': {
                paddingBottom: theme.spacing(1.5),
              },
            },
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: theme.palette.divider }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="session launch tabs"
              variant="fullWidth"
              sx={{
                // Better mobile tab handling
                [theme.breakpoints.down('sm')]: {
                  minHeight: 40,
                  '& .MuiTab-root': {
                    minHeight: 40,
                    padding: theme.spacing(1, 1.5),
                    fontSize: theme.typography.body2.fontSize,
                  },
                },
                // Use scrollable tabs for very small screens if needed
                [theme.breakpoints.down('xs')]: {
                  variant: 'scrollable',
                  scrollButtons: 'auto',
                },
              }}
            >
              <Tab label="Standard" id="session-tab-0" aria-controls="session-tabpanel-0" />
              <Tab label="Advanced" id="session-tab-1" aria-controls="session-tabpanel-1" />
            </Tabs>
          </Box>

          {errorMessage && (
            <Alert severity="error" sx={{ mt: theme.spacing(2) }}>
              {errorMessage}
            </Alert>
          )}

          {isLoading ? (
            // Skeleton loading state
            <Box sx={{ pt: theme.spacing(3) }}>
              <Stack spacing={2.5}>
                {/* Type field skeleton */}
                <Grid container alignItems="center" spacing={1}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Skeleton variant="text" width="60%" height={20} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Skeleton
                      variant="rectangular"
                      width="100%"
                      height={40}
                      sx={{ borderRadius: 1 }}
                    />
                  </Grid>
                </Grid>

                {/* Image registry field skeleton */}
                <Grid container alignItems="center" spacing={1}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Skeleton variant="text" width="55%" height={20} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Skeleton
                      variant="rectangular"
                      width="100%"
                      height={40}
                      sx={{ borderRadius: 1 }}
                    />
                  </Grid>
                </Grid>

                {/* Project field skeleton */}
                <Grid container alignItems="center" spacing={1}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Skeleton variant="text" width="60%" height={20} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Skeleton
                      variant="rectangular"
                      width="100%"
                      height={40}
                      sx={{ borderRadius: 1 }}
                    />
                  </Grid>
                </Grid>

                {/* Container Image field skeleton */}
                <Grid container alignItems="center" spacing={1}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Skeleton variant="text" width="80%" height={20} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Skeleton
                      variant="rectangular"
                      width="100%"
                      height={40}
                      sx={{ borderRadius: 1 }}
                    />
                  </Grid>
                </Grid>

                {/* Session Name field skeleton */}
                <Grid container alignItems="center" spacing={1}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Skeleton variant="text" width="70%" height={20} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Skeleton
                      variant="rectangular"
                      width="100%"
                      height={40}
                      sx={{ borderRadius: 1 }}
                    />
                  </Grid>
                </Grid>

                {/* Resources field skeleton */}
                <Grid container alignItems="center" spacing={1}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Skeleton variant="text" width="60%" height={20} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Skeleton
                        variant="rectangular"
                        width={120}
                        height={32}
                        sx={{ borderRadius: 1 }}
                      />
                      <Skeleton
                        variant="rectangular"
                        width={120}
                        height={32}
                        sx={{ borderRadius: 1 }}
                      />
                    </Box>
                  </Grid>
                </Grid>

                {/* Buttons skeleton */}
                <Grid container spacing={2} sx={{ mt: theme.spacing(3) }}>
                  <Grid size={{ xs: 12, sm: 4 }} />
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Box sx={{ display: 'flex', gap: theme.spacing(2) }}>
                      <Skeleton
                        variant="rectangular"
                        width={80}
                        height={32}
                        sx={{ borderRadius: 1 }}
                      />
                      <Skeleton
                        variant="rectangular"
                        width={80}
                        height={32}
                        sx={{ borderRadius: 1 }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Stack>
            </Box>
          ) : (
            <form onSubmit={handleSubmit}>
              <TabPanel value={tabValue} index={0}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: theme.spacing(2.5),
                  }}
                >
                  {/* Type field */}
                  <Grid container alignItems="center" spacing={1}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormLabel
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        type
                        <HelpIcon title="Select the type of session to launch" />
                      </FormLabel>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      <Select
                        id="session-type"
                        value={formData.type}
                        onChange={
                          handleSelectChange('type') as React.ComponentProps<
                            typeof Select
                          >['onChange']
                        }
                        disabled={isLoading}
                        fullWidth
                        size="sm"
                      >
                        <MenuItem value="notebook">notebook</MenuItem>
                        <MenuItem value="desktop">desktop</MenuItem>
                        <MenuItem value="carta">carta</MenuItem>
                        <MenuItem value="contributed">contributed</MenuItem>
                        <MenuItem value="firefly">firefly</MenuItem>
                      </Select>
                    </Grid>
                  </Grid>

                  {/* Image registry field */}
                  <Grid container alignItems="center" spacing={1}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormLabel
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        image registry
                        <HelpIcon title="Select the image registry containing your container images." />
                      </FormLabel>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      {hasMultipleRegistries ? (
                        <Select
                          id="session-registry"
                          value={formData.repositoryHost ?? ''}
                          onChange={
                            handleSelectChange('repositoryHost') as React.ComponentProps<
                              typeof Select
                            >['onChange']
                          }
                          disabled={isLoading}
                          fullWidth
                          size="sm"
                        >
                          {validHosts.map((host) => (
                            <MenuItem key={host} value={host}>
                              {host}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <TextField
                          id="session-registry-readonly"
                          value={validHosts[0] ?? formData.repositoryHost ?? ''}
                          disabled
                          fullWidth
                          size="sm"
                        />
                      )}
                    </Grid>
                  </Grid>

                  {/* Project field */}
                  <Grid container alignItems="center" spacing={1}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormLabel
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        project
                        <HelpIcon title="Select your project allocation" />
                      </FormLabel>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      <Select
                        id="session-project"
                        value={formData.project}
                        onChange={
                          handleSelectChange('project') as React.ComponentProps<
                            typeof Select
                          >['onChange']
                        }
                        disabled={
                          isLoading ||
                          availableProjects.length === 0 ||
                          (hasMultipleRegistries && !effectiveRegistry)
                        }
                        fullWidth
                        size="sm"
                      >
                        <MenuItem value="">
                          <em>Select project</em>
                        </MenuItem>
                        {availableProjects.map((project) => (
                          <MenuItem key={project} value={project}>
                            {project}
                          </MenuItem>
                        ))}
                      </Select>
                    </Grid>
                  </Grid>

                  {/* Container Image field */}
                  <Grid container alignItems="center" spacing={1}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormLabel
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        container image
                        <HelpIcon title="Select the container image for your session" />
                      </FormLabel>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      <Select
                        id="session-image"
                        value={formData.containerImage}
                        onChange={
                          handleSelectChange('containerImage') as React.ComponentProps<
                            typeof Select
                          >['onChange']
                        }
                        disabled={
                          isLoading ||
                          !formData.project ||
                          availableImages.length === 0 ||
                          (hasMultipleRegistries && !effectiveRegistry)
                        }
                        fullWidth
                        size="sm"
                      >
                        <MenuItem value="">
                          <em>Select image</em>
                        </MenuItem>
                        {availableImages.map((image) => (
                          <MenuItem key={image.id} value={image.id}>
                            {image.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </Grid>
                  </Grid>

                  {/* Session Name field */}
                  <Grid container alignItems="center" spacing={1}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormLabel
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        session name
                        <HelpIcon title="Enter a unique name for your session (max 15 characters)" />
                      </FormLabel>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      <TextField
                        id="session-name"
                        value={formData.sessionName}
                        onChange={handleFieldChange('sessionName')}
                        disabled={isLoading}
                        inputProps={{ maxLength: 15 }}
                        placeholder="Enter session name"
                        fullWidth
                        size="sm"
                      />
                    </Grid>
                  </Grid>

                  {resourceModeFields}
                </Box>

                {/* Buttons */}
                <Grid container spacing={2} sx={{ mt: theme.spacing(3) }}>
                  <Grid size={{ xs: 12, sm: 4 }}>{/* Empty grid for alignment */}</Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Box sx={{ display: 'flex', gap: theme.spacing(2) }}>
                      {renderLaunchButton(!formData.project || !formData.containerImage)}
                      <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        onClick={handleReset}
                        disabled={isLoading}
                      >
                        Reset
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Box>
                  {/* Image access section */}
                  <Box sx={{ mb: theme.spacing(4) }}>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 500,
                        mb: theme.spacing(1),
                        ml: theme.spacing(2),
                      }}
                    >
                      Image access
                    </Typography>
                    <Divider sx={{ mb: theme.spacing(3) }} />
                    <Box sx={{ px: theme.spacing(2) }}>
                      {/* Container image field */}
                      <Grid container alignItems="center" spacing={1} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormLabel
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            container image
                            <HelpIcon title="Specify a custom container image path" />
                          </FormLabel>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                          <Select
                            id="repository-host"
                            value={
                              formData.repositoryHost ||
                              repositoryHosts.find((h) => h && typeof h === 'string') ||
                              'images-rc.canfar.net'
                            }
                            onChange={
                              handleSelectChange('repositoryHost') as React.ComponentProps<
                                typeof Select
                              >['onChange']
                            }
                            disabled={isLoading}
                            fullWidth
                            size="sm"
                          >
                            {repositoryHosts
                              .filter((host) => host && typeof host === 'string')
                              .map((host) => (
                                <MenuItem key={host} value={host}>
                                  {host}
                                </MenuItem>
                              ))}
                          </Select>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 5 }}>
                          <TextField
                            id="image"
                            value={formData.image}
                            onChange={handleFieldChange('image')}
                            disabled={isLoading}
                            fullWidth
                            size="sm"
                            placeholder="project/example-image:1.0.0"
                          />
                        </Grid>
                      </Grid>

                      {/* Repository username field */}
                      <Grid container alignItems="center" spacing={1} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormLabel
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            repository username
                            <HelpIcon title="Username for private repository access" />
                          </FormLabel>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 8 }}>
                          <TextField
                            id="repository-username"
                            value={formData.repositoryAuthUsername}
                            onChange={handleFieldChange('repositoryAuthUsername')}
                            disabled={isLoading}
                            fullWidth
                            size="sm"
                            placeholder="Repository username"
                            autoComplete="username"
                          />
                        </Grid>
                      </Grid>

                      {/* Repository secret field */}
                      <Grid container alignItems="center" spacing={1}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormLabel
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            repository secret
                            <HelpIcon title="Password or token for private repository" />
                          </FormLabel>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 8 }}>
                          <TextField
                            id="repository-secret"
                            type="password"
                            value={formData.repositoryAuthSecret}
                            onChange={handleFieldChange('repositoryAuthSecret')}
                            disabled={isLoading}
                            fullWidth
                            size="sm"
                            placeholder="Repository secret"
                            autoComplete="current-password"
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Box>

                  {/* Launch session section */}
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 500,
                        mb: theme.spacing(1),
                        ml: theme.spacing(2),
                      }}
                    >
                      Launch session
                    </Typography>
                    <Divider sx={{ mb: theme.spacing(3) }} />
                    <Box sx={{ px: theme.spacing(2) }}>
                      {/* Type field */}
                      <Grid container alignItems="center" spacing={1} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormLabel
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            type
                            <HelpIcon title="Select the type of session to launch" />
                          </FormLabel>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 8 }}>
                          <Select
                            id="advanced-session-type"
                            value={formData.type}
                            onChange={
                              handleSelectChange('type') as React.ComponentProps<
                                typeof Select
                              >['onChange']
                            }
                            disabled={isLoading}
                            fullWidth
                            size="sm"
                          >
                            <MenuItem value="notebook">notebook</MenuItem>
                            <MenuItem value="desktop">desktop</MenuItem>
                            <MenuItem value="carta">carta</MenuItem>
                            <MenuItem value="contributed">contributed</MenuItem>
                            <MenuItem value="firefly">firefly</MenuItem>
                          </Select>
                        </Grid>
                      </Grid>

                      {/* Session name field */}
                      <Grid container alignItems="center" spacing={1} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormLabel
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            session name
                            <HelpIcon title="Choose a unique name for your session (max 15 characters)" />
                          </FormLabel>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 8 }}>
                          <TextField
                            id="advanced-session-name"
                            value={formData.sessionName}
                            onChange={handleFieldChange('sessionName')}
                            disabled={isLoading}
                            fullWidth
                            size="sm"
                            inputProps={{ maxLength: 15 }}
                            placeholder="Enter session name"
                          />
                        </Grid>
                      </Grid>

                      {resourceModeFields}
                    </Box>
                  </Box>

                  {/* Buttons */}
                  <Grid container spacing={2} sx={{ mt: theme.spacing(3) }}>
                    <Grid size={{ xs: 12, sm: 4 }}>{/* Empty grid for alignment */}</Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      <Box sx={{ display: 'flex', gap: theme.spacing(2) }}>
                        {renderLaunchButton(false)}
                        <Button
                          type="button"
                          variant="outlined"
                          size="small"
                          onClick={handleReset}
                          disabled={isLoading}
                        >
                          Reset
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </TabPanel>
            </form>
          )}
        </CardContent>
      </Card>
    );
  },
);

SessionLaunchFormImpl.displayName = 'SessionLaunchFormImpl';
