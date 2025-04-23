import React, { ReactNode } from 'react';
import { Box, Container, Paper, Typography, useTheme, useMediaQuery } from '@mui/material';

interface ResponsiveContainerProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disablePadding?: boolean;
  disablePaper?: boolean;
  paperProps?: React.ComponentProps<typeof Paper>;
  headerContent?: ReactNode;
  footerContent?: ReactNode;
}

/**
 * A responsive container component that adapts to different screen sizes
 * and provides consistent padding, paper elevation, and optional title/subtitle
 */
const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  title,
  subtitle,
  maxWidth = 'lg',
  disablePadding = false,
  disablePaper = false,
  paperProps = {},
  headerContent,
  footerContent,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  // Adaptive padding based on screen size
  const getPadding = () => {
    if (disablePadding) return 0;
    if (isMobile) return 2;
    if (isTablet) return 3;
    return 4;
  };

  const padding = getPadding();

  const content = (
    <>
      {(title || headerContent) && (
        <Box sx={{ mb: 3 }}>
          {title && (
            <Typography 
              variant={isMobile ? 'h5' : 'h4'} 
              component="h1"
              gutterBottom
            >
              {title}
            </Typography>
          )}
          
          {subtitle && (
            <Typography 
              variant="subtitle1" 
              color="text.secondary"
              gutterBottom
            >
              {subtitle}
            </Typography>
          )}
          
          {headerContent}
        </Box>
      )}

      {children}

      {footerContent && (
        <Box sx={{ mt: 3 }}>
          {footerContent}
        </Box>
      )}
    </>
  );

  return (
    <Container maxWidth={maxWidth}>
      {disablePaper ? (
        <Box sx={{ py: padding }}>
          {content}
        </Box>
      ) : (
        <Paper 
          elevation={2} 
          sx={{ 
            p: padding, 
            my: isMobile ? 2 : 3,
            width: '100%',
            ...paperProps.sx
          }}
          {...paperProps}
        >
          {content}
        </Paper>
      )}
    </Container>
  );
};

export default ResponsiveContainer; 