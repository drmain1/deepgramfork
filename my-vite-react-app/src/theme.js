import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2c3e50', // Dark blue for sidebar
    },
    secondary: {
      main: '#6c757d', // Gray for secondary elements
    },
    background: {
      default: '#f8f9fa', // Light gray background
      paper: '#ffffff', // White for cards and modals
    },
  },
  typography: {
    fontFamily: 'Arial, sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#2c3e50',
          color: 'white',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

export default theme;
