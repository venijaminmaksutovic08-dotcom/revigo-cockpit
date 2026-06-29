export type DayStatus = "Compression" | "Protect ADR" | "Opportunity" | "Need Day" | "Rescue Day";

export interface DayData {
  datum: string;
  dan: string;
  popunjenost: number;
  targetPopunjenost: number;
  adr: number;
  targetAdr: number;
  brojNocenja: number;
  targetNocenja: number;
  pickup: number;
  status: DayStatus;
  preporukaCene: number;
  isPast: boolean;
}

export type KPIStatus = "ahead" | "onpace" | "behind" | "empty";

export interface KPIData {
  label: string;
  value: string;
  rawValue: number;
  target: string;
  rawTarget: number;
  gap: string;
  achievement: number;
  unit?: string;
  prefix?: string;
  status: KPIStatus;
  remainingLabel: string;
  lastYearValue: number;
  lastYearLabel: string;
  yoyChangePct: number | null;
}

export interface PriorityAction {
  id: number;
  priority: "High" | "Medium" | "Low";
  text: string;
  detail: string;
  impact: string;
}

export interface RevenueGapItem {
  label: string;
  gap: number;
  isPositive: boolean;
}

export const dailyData: DayData[] = [];

export const revenueGapData = {
  total: 0,
  target: 0,
  achieved: 0,
  items: [] as RevenueGapItem[],
};

export const priorityActions: PriorityAction[] = [];

export const hotels: string[] = [];
export const periods: string[] = [];
