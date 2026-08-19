export type Issue = {
  id: string;
  rule: "DOOR_WIDTH" | "FIRE_RATING";
  title: string;
  element: string;
  location: string;
  actual: string;
  required: string;
  penalty: number;
  x: number;
  y: number;
  localId?: number;
  modelId?: string;
  guid?: string;
};

export type ParsedModel = {
  issues: Issue[];
  doorsChecked: number;
  passedChecks: number;
  elementCount: number;
  floors: string[];
};
