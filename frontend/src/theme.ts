import { createTheme } from "@mui/material/styles";

export const missionTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0B1220",
      paper: "#121B2E"
    },
    primary: {
      main: "#3FA7A0",
      contrastText: "#0B1220"
    },
    secondary: {
      main: "#E8A33D",
      contrastText: "#0B1220"
    },
    text: {
      primary: "#E7EDF5",
      secondary: "#8CA0B8"
    }
  },
  typography: {
    fontFamily: '"IBM Plex Sans", Arial, sans-serif',
    h1: {
      fontFamily: '"Space Grotesk", Arial, sans-serif',
      fontSize: "clamp(2.5rem, 7vw, 5.75rem)",
      lineHeight: 0.96,
      fontWeight: 700,
      letterSpacing: 0
    },
    h2: {
      fontFamily: '"Space Grotesk", Arial, sans-serif',
      fontWeight: 700,
      letterSpacing: 0
    },
    button: {
      fontWeight: 700,
      letterSpacing: 0
    },
    overline: {
      letterSpacing: 0,
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          minHeight: 44,
          boxShadow: "none",
          "&:focus-visible": {
            outline: "2px solid #E8A33D",
            outlineOffset: 3
          }
        }
      }
    }
  }
});
