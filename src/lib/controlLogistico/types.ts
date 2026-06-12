import type { ModuleKey } from "@/lib/modulePermissions";

export type ControlStatus = "ok" | "warning" | "critical" | "neutral";
export type PriorityLevel = "critical" | "warning" | "info";

export interface ControlPriority {
  id: string;
  moduleKey: ModuleKey;
  level: PriorityLevel;
  title: string;
  context?: string;
  href: string;
  createdAt?: string;
}

export interface ControlFlowStage {
  key: string;
  label: string;
  value: number | string;
  status: ControlStatus;
  href: string;
}

export interface ControlModuleSignal {
  key: ModuleKey;
  label: string;
  description: string;
  count?: number;
  status: ControlStatus;
  href: string;
}

export interface ControlAction {
  id: string;
  label: string;
  href: string;
  moduleKey: ModuleKey;
}

export interface ControlLogisticoResumen {
  success: true;
  generatedAt: string;
  user: { id: string; name: string; role: string };
  visibleModules: ModuleKey[];
  headline: {
    status: ControlStatus;
    critical: number;
    pending: number;
    completedToday: number;
  };
  priorities: ControlPriority[];
  flow: ControlFlowStage[];
  modules: ControlModuleSignal[];
  actions: ControlAction[];
}

