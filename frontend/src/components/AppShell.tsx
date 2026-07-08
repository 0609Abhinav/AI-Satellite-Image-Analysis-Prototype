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
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          px: { xs: 2, md: 4 },
          py: 1.5,
          bgcolor: "rgba(11, 18, 32, 0.82)",
          borderBottom: "1px solid rgba(140, 160, 184, 0.18)",
          backdropFilter: "blur(14px)"
        }}
      >
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ overflowX: "auto" }}>
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
