'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

export default function ChartLoadingFallback() {
  return (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="rectangular" height={300} sx={{ borderRadius: '12px' }} />
    </Box>
  );
}
