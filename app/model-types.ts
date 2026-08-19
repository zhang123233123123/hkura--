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
};
