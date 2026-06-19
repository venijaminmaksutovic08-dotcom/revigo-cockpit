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

export const kpiData: KPIData[] = [
  { label: "Ukupan Prihod",  value: "—", rawValue: 0, target: "—", rawTarget: 0, gap: "—", achievement: 0 },
  { label: "Broj Noćenja",   value: "—", rawValue: 0, target: "—", rawTarget: 0, gap: "—", achievement: 0 },
  { label: "ADR",            value: "—", rawValue: 0, target: "—", rawTarget: 0, gap: "—", achievement: 0 },
  { label: "Popunjenost",    value: "—", rawValue: 0, target: "—", rawTarget: 0, gap: "—", achievement: 0 },
  { label: "RevPAR",         value: "—", rawValue: 0, target: "—", rawTarget: 0, gap: "—", achievement: 0 },
];

export const revenueGapData = {
  total: 0,
  target: 0,
  achieved: 0,
  items: [] as RevenueGapItem[],
};

export const priorityActions: PriorityAction[] = [];

export const hotels: string[] = [];
export const periods: string[] = [];
