import { Box, Button, Stack } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import CompareIcon from "@mui/icons-material/Compare";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PublicIcon from "@mui/icons-material/Public";
import type { PageKey } from "../App";

type AppShellProps = {
  children: React.ReactNode;
  page: PageKey;
  onNavigate: (page: PageKey) => void;
};

const navItems = [
  { label: "Globe", page: "landing" as const, icon: <PublicIcon fontSize="small" /> },
  { label: "Upload", page: "upload" as const, icon: <CloudUploadIcon fontSize="small" /> },
  { label: "Analyze", page: "analyze" as const, icon: <AnalyticsIcon fontSize="small" /> },
  { label: "Compare", page: "compare" as const, icon: <CompareIcon fontSize="small" /> },
  { label: "Results", page: "results" as const, icon: <AssessmentIcon fontSize="small" /> }
];

export function AppShell({ children, page, onNavigate }: AppShellProps) {
  return (
    <Box minHeight="100vh" bgcolor="background.default">
      <Box
        component="nav"
        className="missionNav"
      >
        <Stack direction="row" spacing={1} justifyContent="flex-end" className="navScroll">
          {navItems.map((item) => (
            <Button
              key={item.label}
              color={item.page === page ? "primary" : "inherit"}
              variant={item.page === page ? "outlined" : "text"}
              startIcon={item.icon}
              onClick={() => onNavigate(item.page)}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </Box>
      {children}
    </Box>
  );
}
