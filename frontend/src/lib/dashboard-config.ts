const DASHBOARD_CONFIG_KEY = "zas_dashboard_config";

export interface DashboardConfig {
  year: number;
  autoEmailOperaciones: boolean;
}

export function getDefaultDashboardConfig(): DashboardConfig {
  return {
    year: new Date().getFullYear(),
    autoEmailOperaciones: false,
  };
}

export function getDashboardConfig(): DashboardConfig {
  if (typeof window === "undefined") return getDefaultDashboardConfig();
  try {
    const stored = localStorage.getItem(DASHBOARD_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DashboardConfig>;
      return { ...getDefaultDashboardConfig(), ...parsed };
    }
  } catch {
    console.error("Error reading dashboard config");
  }
  return getDefaultDashboardConfig();
}

export function saveDashboardConfig(config: DashboardConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DASHBOARD_CONFIG_KEY, JSON.stringify(config));
  } catch {
    console.error("Error saving dashboard config");
  }
}
