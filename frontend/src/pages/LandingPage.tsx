import { useEffect, useRef } from "react";
import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SecurityIcon from "@mui/icons-material/Security";
import SpeedIcon from "@mui/icons-material/Speed";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import Globe from "react-globe.gl";

type LandingPageProps = {
  onLaunch: () => void;
};

const arcs = [
  {
    startLat: 28.6,
    startLng: 77.2,
    endLat: 37.7,
    endLng: -122.4,
    color: ["#3FA7A0", "#E8A33D"],
  },
  {
    startLat: 51.5,
    startLng: -0.1,
    endLat: 35.6,
    endLng: 139.6,
    color: ["#3FA7A0", "#E8A33D"],
  },
];

const localGlobeTexture =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='512' viewBox='0 0 1024 512'%3E%3Crect width='1024' height='512' fill='%230b2f4e'/%3E%3Cpath fill='%233fa7a0' opacity='.86' d='M130 142c58-36 134-26 174 11 30 28 12 70-37 78-64 11-76 56-139 48-52-7-91-45-88-82 2-22 32-38 90-55Zm305-6c43-28 118-26 155 8 31 29 16 68-31 74-46 7-68 31-121 28-65-4-103-37-92-72 7-20 37-24 89-38Zm238 63c73-47 166-37 218 13 40 39 23 92-41 103-76 13-100 66-180 56-70-9-117-57-106-102 7-28 49-44 109-70ZM209 354c68-33 142-22 174 19 23 31-3 65-58 74-72 13-121-11-145-42-15-20-8-36 29-51Zm367-21c55-33 142-21 188 23 33 31 20 72-34 78-60 7-87 34-154 26-59-8-96-43-85-78 5-18 34-28 85-49Z'/%3E%3Cpath fill='%23e8a33d' opacity='.25' d='M0 248h1024v3H0zm0-78h1024v2H0zm0 160h1024v2H0z'/%3E%3C/svg%3E";

export function LandingPage({ onLaunch }: LandingPageProps) {
  const globeRef = useRef<any>(null);

  useEffect(() => {
    const controls = globeRef.current?.controls?.();

    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.45;
      controls.enableZoom = false;
    }
  }, []);

  return (
    <Box
      className="hero"
      sx={{
        position: "relative",
        minHeight: {
          xs: "calc(100vh - 72px)",
          md: "calc(100vh - 80px)",
        },
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        px: {
          xs: 2.5,
          sm: 5,
          md: 8,
          lg: 12,
        },
        py: {
          xs: 7,
          md: 5,
        },
        isolation: "isolate",
        background:
          "radial-gradient(circle at 72% 46%, rgba(16, 83, 103, 0.38), transparent 30%), linear-gradient(135deg, #030712 0%, #071522 48%, #071b25 100%)",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          zIndex: -4,
          opacity: 0.28,
          backgroundImage:
            "linear-gradient(rgba(63,167,160,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(63,167,160,0.07) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage:
            "linear-gradient(to right, black, transparent 78%)",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          zIndex: -3,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg, rgba(3,7,18,0.98) 0%, rgba(3,7,18,0.88) 35%, rgba(3,7,18,0.25) 66%, rgba(3,7,18,0.1) 100%)",
        },
      }}
    >
      <Box className="floatingGlow floatingGlowPrimary" />

      <Box className="floatingGlow floatingGlowAccent" />

      <Box
        className="globeStage heroGlobeShell"
        aria-hidden="true"
        sx={{
          position: "absolute",
          right: {
            xs: "-310px",
            sm: "-240px",
            md: "-160px",
            lg: "-40px",
          },
          top: "50%",
          width: {
            xs: 620,
            md: 760,
            lg: 900,
          },
          height: {
            xs: 620,
            md: 760,
            lg: 900,
          },
          transform: "translateY(-50%)",
          zIndex: 0,
          "& > canvas": {
            position: "relative",
            zIndex: 2,
          },
        }}
      >
        <Box className="globeGlow" />

        <div className="earthFallback">
          <div className="earthTexture" />
          <div className="orbit orbitOne" />
          <div className="orbit orbitTwo" />
          <div className="satelliteDot" />
        </div>

        <Box className="globeFloat">
          <Globe
            ref={globeRef}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl={localGlobeTexture}
            arcsData={arcs}
            arcColor="color"
            arcAltitude={0.18}
            arcStroke={0.8}
            arcDashLength={0.48}
            arcDashGap={2}
            arcDashAnimateTime={3400}
            pointsData={[
              {
                lat: 28.6,
                lng: 77.2,
                size: 0.45,
              },
              {
                lat: 37.7,
                lng: -122.4,
                size: 0.35,
              },
            ]}
            pointAltitude="size"
            pointColor={() => "#E8A33D"}
            width={900}
            height={900}
          />
        </Box>

        <Box className="globeScan" />
      </Box>

      <Box
        className="heroOverlay"
        sx={{
          position: "relative",
          zIndex: 3,
          width: "100%",
          maxWidth: 1440,
          mx: "auto",
        }}
      >
        <Stack
          spacing={3}
          maxWidth={760}
          className="heroCopy"
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.2}
          >
            <Box className="statusDot" />

            <Typography
              variant="overline"
              color="primary.main"
              fontFamily="IBM Plex Mono"
              sx={{
                color: "#5eead4",
                fontWeight: 900,
                letterSpacing: {
                  xs: 1.6,
                  md: 2.7,
                },
                fontSize: {
                  xs: 10,
                  sm: 12,
                },
              }}
            >
              LOCAL CV ANALYSIS / MISSION CONTROL
            </Typography>
          </Stack>

          <Typography
            variant="h1"
            className="heroTitle"
          >
            Satellite intelligence, running entirely{" "}
            <Box component="span">on your machine.</Box>
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            className="heroText"
          >
            Upload aerial imagery, generate feature overlays, compare
            year-over-year changes, and export local reports without paid APIs
            or cloud inference.
          </Typography>

          <Stack
            direction="row"
            spacing={1.2}
            flexWrap="wrap"
            useFlexGap
            className="heroDelayOne"
          >
            <FeatureChip
              icon={<SecurityIcon />}
              label="Private and local"
            />

            <FeatureChip
              icon={<SpeedIcon />}
              label="Fast visual analysis"
            />

            <FeatureChip
              icon={<AutoAwesomeIcon />}
              label="AI-powered insights"
            />
          </Stack>

          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            alignItems={{
              xs: "stretch",
              sm: "center",
            }}
            spacing={2}
            className="heroDelayTwo"
          >
            <Button
              variant="contained"
              color="primary"
              startIcon={<RocketLaunchIcon />}
              className="launchButton"
              onClick={onLaunch}
            >
              Launch Analysis
            </Button>

            <Typography
              className="heroFinePrint"
            >
              No cloud inference
              <br />
              No imagery leaves your device
            </Typography>
          </Stack>

          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={{
              xs: 1.5,
              sm: 4,
            }}
            className="heroDelayThree"
          >
            <StatItem
              value="100%"
              label="local processing"
            />

            <StatItem
              value="0"
              label="paid inference APIs"
            />

            <StatItem
              value="CV + AI"
              label="analysis pipeline"
            />
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

function FeatureChip({
  icon,
  label,
}: {
  icon: React.ReactElement;
  label: string;
}) {
  return (
    <Chip
      icon={icon}
      label={label}
      className="featureChip"
    />
  );
}

function StatItem({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <Box className="statItem">
      <Typography
        className="statValue"
      >
        {value}
      </Typography>

      <Box className="statDivider" />

      <Typography
        className="statLabel"
      >
        {label}
      </Typography>
    </Box>
  );
}
