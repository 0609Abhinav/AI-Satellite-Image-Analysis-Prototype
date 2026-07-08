import { useEffect, useRef } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import Globe from "react-globe.gl";

type LandingPageProps = {
  onLaunch: () => void;
};

const arcs = [
  { startLat: 28.6, startLng: 77.2, endLat: 37.7, endLng: -122.4, color: ["#3FA7A0", "#E8A33D"] },
  { startLat: 51.5, startLng: -0.1, endLat: 35.6, endLng: 139.6, color: ["#3FA7A0", "#E8A33D"] }
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
    <Box className="hero">
      <Box className="globeStage" aria-hidden="true">
        <div className="earthFallback">
          <div className="earthTexture" />
          <div className="orbit orbitOne" />
          <div className="orbit orbitTwo" />
          <div className="satelliteDot" />
        </div>
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
          pointsData={[{ lat: 28.6, lng: 77.2, size: 0.45 }, { lat: 37.7, lng: -122.4, size: 0.35 }]}
          pointAltitude="size"
          pointColor={() => "#E8A33D"}
          width={900}
          height={900}
        />
      </Box>
      <Box className="heroOverlay">
        <Stack spacing={3} maxWidth={720}>
          <Typography variant="overline" color="primary.main" fontFamily="IBM Plex Mono">
            LOCAL CV ANALYSIS / MISSION CONTROL
          </Typography>
          <Typography variant="h1">Satellite intelligence, running entirely on your machine.</Typography>
          <Typography variant="body1" color="text.secondary">
            Upload aerial imagery, generate feature overlays, compare year-over-year changes, and export local reports without paid APIs or cloud inference.
          </Typography>
          <Button variant="contained" color="primary" startIcon={<RocketLaunchIcon />} className="launchButton" onClick={onLaunch}>
            Launch Analysis
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
