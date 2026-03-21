'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Grid from '@mui/material/Grid';

type Variant = 'dashboard' | 'table' | 'chat' | 'default';

export default function LoadingSkeleton({ variant = 'default' }: { variant?: Variant }) {
  if (variant === 'dashboard') {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={320} height={20} sx={{ mb: 3 }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[0, 1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={i}>
              <Skeleton variant="rectangular" height={100} sx={{ borderRadius: '8px' }} />
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={3}>
          {[0, 1].map((i) => (
            <Grid size={{ xs: 12, lg: 6 }} key={i}>
              <Skeleton variant="rectangular" height={300} sx={{ borderRadius: '8px' }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (variant === 'table') {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={320} height={20} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: '8px', mb: 1 }} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: '4px', mb: 0.5 }} />
        ))}
      </Box>
    );
  }

  if (variant === 'chat') {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 3 }} />
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 2, justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
            {i % 2 === 0 && <Skeleton variant="circular" width={36} height={36} />}
            <Skeleton variant="rectangular" width={i % 2 === 0 ? '60%' : '45%'} height={60} sx={{ borderRadius: '8px' }} />
          </Box>
        ))}
        <Skeleton variant="rectangular" height={56} sx={{ borderRadius: '8px', mt: 'auto' }} />
      </Box>
    );
  }

  // default
  return (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={240} height={36} sx={{ mb: 1 }} />
      <Skeleton variant="text" width={360} height={20} sx={{ mb: 3 }} />
      <Skeleton variant="rectangular" height={400} sx={{ borderRadius: '8px' }} />
    </Box>
  );
}
