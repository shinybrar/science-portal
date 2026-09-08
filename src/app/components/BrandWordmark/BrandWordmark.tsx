import { Box, Typography } from '@mui/material';

export function BrandWordmark() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
      <Typography
        variant="overline"
        component="span"
        sx={{ display: 'block', lineHeight: 1.15, letterSpacing: '0.08em' }}
      >
        CANFAR
      </Typography>
      <Typography
        variant="subtitle1"
        component="span"
        sx={{ fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' }}
      >
        Science Portal
      </Typography>
    </Box>
  );
}
