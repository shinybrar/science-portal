'use client';

import React from 'react';
import {
  Box,
  Container,
  Link as MuiLink,
  Stack,
  SvgIcon,
  Typography,
  type SvgIconProps,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import GroupOutlined from '@mui/icons-material/GroupOutlined';
import PublishOutlined from '@mui/icons-material/PublishOutlined';
import ViewInArOutlined from '@mui/icons-material/ViewInArOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import CloudOutlined from '@mui/icons-material/CloudOutlined';
import MailOutlined from '@mui/icons-material/MailOutlined';
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined';
import { DiscordIcon } from '@/app/components/icons/DiscordIcon';

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
  description?: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
  layout?: 'links' | 'cards';
}

export interface FooterProps {
  sections: FooterSection[];
  copyright?: string;
}

function GitHubIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .267.18.578.688.48A10.019 10.019 0 0 0 22 12c0-5.523-4.477-10-10-10z" />
    </SvgIcon>
  );
}

const LINK_ICONS: Record<string, React.ReactElement<SvgIconProps>> = {
  Documentation: <DescriptionOutlined />,
  About: <InfoOutlined />,
  'Open Source': <GitHubIcon />,
  'Storage Management': <FolderOutlined />,
  'Group Management': <GroupOutlined />,
  'Data Publication': <PublishOutlined />,
  'Science Portal': <ViewInArOutlined />,
  'CADC Search': <SearchOutlined />,
  'OpenStack Cloud': <CloudOutlined />,
  'Email Support': <MailOutlined />,
  Discord: <DiscordIcon />,
  'Platform status': <MonitorHeartOutlined />,
};

function linkIcon(label: string, fontSize: number) {
  return React.cloneElement(LINK_ICONS[label] ?? <DescriptionOutlined />, {
    sx: { fontSize },
  });
}

function linkOpen(link: FooterLink) {
  return {
    href: link.href,
    target: link.external ? '_blank' : undefined,
    rel: link.external ? 'noopener noreferrer' : undefined,
  };
}

function FooterNavLink({ link }: { link: FooterLink }) {
  return (
    <MuiLink
      {...linkOpen(link)}
      underline="none"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
        whiteSpace: 'nowrap',
        color: 'text.primary',
        fontSize: '0.875rem',
        fontWeight: 500,
        '& .MuiSvgIcon-root': { color: 'text.secondary' },
        '&:hover': {
          color: 'primary.main',
          '& .MuiSvgIcon-root': { color: 'primary.main' },
        },
      }}
    >
      {linkIcon(link.label, 18)}
      {link.label}
    </MuiLink>
  );
}

function FooterSupportCard({ link }: { link: FooterLink }) {
  return (
    <MuiLink
      {...linkOpen(link)}
      underline="none"
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        p: 1.25,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
        transition: theme.transitions.create(['border-color', 'background-color']),
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        },
      })}
    >
      <Box
        sx={(theme) => ({
          display: 'grid',
          placeItems: 'center',
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 1,
          color: 'primary.main',
          bgcolor: alpha(theme.palette.primary.main, 0.1),
        })}
      >
        {linkIcon(link.label, 20)}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {link.label}
        </Typography>
        {link.description ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {link.description}
          </Typography>
        ) : null}
      </Box>
    </MuiLink>
  );
}

export const Footer: React.FC<FooterProps> = ({
  sections,
  copyright = `© ${new Date().getFullYear()}`,
}) => {
  return (
    <Box
      component="footer"
      sx={(theme) => ({
        mt: 'auto',
        pt: { xs: 5, md: 6 },
        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.05),
        borderTop: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 4, md: 5 },
            pb: { xs: 4, md: 5 },
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          {sections.map((section) => (
            <Box key={section.title} component="nav" aria-label={section.title}>
              <Typography
                variant="overline"
                component="h2"
                sx={{
                  display: 'block',
                  mb: section.layout === 'cards' ? 1.5 : 1,
                  color: 'text.secondary',
                  letterSpacing: '0.08em',
                }}
              >
                {section.title}
              </Typography>
              {section.layout === 'cards' ? (
                <Stack spacing={1}>
                  {section.links.map((link) => (
                    <FooterSupportCard key={link.href} link={link} />
                  ))}
                </Stack>
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {section.links.map((link) => (
                    <Box component="li" key={link.href}>
                      <FooterNavLink link={link} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            py: 2.5,
            pb: 3,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {copyright}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};
