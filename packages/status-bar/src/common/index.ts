export interface StatusBarEntry {
  id?: string;
  text?: string;
  alignment: StatusBarAlignment;
  color?: string;
  className?: string;
  tooltip?: string;
  command?: string;
  arguments?: any[];
  priority?: number;
  icon?: string;
  onClick?: (e: any) => void;
}

export enum StatusBarAlignment {
  LEFT, RIGHT,
}

export const IStatusBarService = Symbol('IStatusBarService');

export interface IStatusBarService {
  getBackgroundColor(): string | undefined;
  setBackgroundColor(color?: string): void;
  setColor(color?: string): void;
  addElement(id: string, entry: StatusBarEntry): void;
  setElement(id: string, fields: object): void;
  removeElement(id: string): void;
  leftEntries: StatusBarEntry[];
  rightEntries: StatusBarEntry[];
}
