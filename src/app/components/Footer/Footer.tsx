import React from 'react';
import { Box } from '@/app/components/Box/Box';
import { Grid } from '@/app/components/Grid/Grid';
import { Typography } from '@/app/components/Typography/Typography';
import { Link } from '@/app/components/Link/Link';
import { SocialLink, SocialLinkProps } from '@/app/components/SocialLink/SocialLink';
import { Container } from '@mui/material';

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
  hidden?: boolean;
}

export interface FooterProps {
  sections: FooterSection[];
  socialLinks?: SocialLinkProps[];
  copyright?: string;
}

export const Footer: React.FC<FooterProps> = ({
  sections,
  socialLinks,
  copyright = `© ${new Date().getFullYear()}`,
}) => {
  return (
    <Box component="footer" sx={{ mt: 'auto', pt: 8, pb: 6 }}>
      <Container maxWidth="lg">
        <Box
          sx={(theme) => ({
            height: '1px',
            mb: 5,
            background: `linear-gradient(to right, transparent, ${theme.palette.divider}, transparent)`,
          })}
        />

        <Grid container spacing={4}>
          <Grid size={12}>
            <Typography variant="body2" color="secondary" sx={{ mb: 1 }}>
              {copyright}
            </Typography>
          </Grid>

          {sections.map((section, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
              {!section.hidden && (
                <Typography
                  variant="overline"
                  component="h2"
                  sx={{
                    display: 'block',
                    mb: 1.5,
                    color: 'text.secondary',
                    letterSpacing: '0.08em',
                  }}
                >
                  {section.title}
                </Typography>
              )}
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {section.links.map((link, linkIndex) => (
                  <Box component="li" key={linkIndex} sx={{ mb: 1 }}>
                    <Link
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      variant="secondary"
                      sx={{
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                          color: 'primary.main',
                        },
                      }}
                    >
                      {link.label}
                    </Link>
                  </Box>
                ))}
              </Box>
            </Grid>
          ))}

          {socialLinks && socialLinks.length > 0 && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="h6" sx={{ visibility: 'hidden' }}>
                Resources
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {socialLinks.map((social, index) => (
                  <SocialLink key={index} {...social} />
                ))}
              </Box>
            </Grid>
          )}
        </Grid>
      </Container>
    </Box>
  );
};
