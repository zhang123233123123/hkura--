import fs from "node:fs";
import path from "node:path";
import { IfcAPI, IFCDOOR, IFCBUILDINGSTOREY, IFCRELDEFINESBYPROPERTIES, IFCRELCONTAINEDINSPATIALSTRUCTURE } from "web-ifc";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/smoke-ifc.mjs model.ifc");

const api = new IfcAPI();
api.SetWasmPath(`${path.resolve("node_modules/web-ifc")}/`, true);
await api.Init();
const bytes = new Uint8Array(fs.readFileSync(input));
const modelId = api.OpenModel(bytes);

const count = (type, inherited = false) => api.GetLineIDsWithType(modelId, type, inherited).size();
const values = (vector) => Array.from({ length: vector.size() }, (_, index) => vector.get(index));
const unwrap = (value) => value && typeof value === "object" && "value" in value ? value.value : value;
const findProperty = (node, name) => {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) { const result = findProperty(child, name); if (result !== undefined) return result; }
    return undefined;
  }
  if (String(unwrap(node.Name) ?? "").toLowerCase() === name.toLowerCase()) return unwrap(node.NominalValue ?? node.Value);
  for (const child of Object.values(node)) { const result = findProperty(child, name); if (result !== undefined) return result; }
};
const doorVector = api.GetLineIDsWithType(modelId, IFCDOOR, true);
const doors = [];
for (let index = 0; index < Math.min(doorVector.size(), 5); index++) {
  const door = api.GetLine(modelId, doorVector.get(index), false);
  doors.push({ expressID: door.expressID, guid: door.GlobalId?.value, name: door.Name?.value, width: door.OverallWidth?.value });
}

const firstDoorId = doorVector.size() ? doorVector.get(0) : null;
let firstDoorFireRating;
let firstDoorStorey;
for (const relationId of values(api.GetLineIDsWithType(modelId, IFCRELDEFINESBYPROPERTIES, false))) {
  const relation = api.GetLine(modelId, relationId, true);
  if (relation.RelatedObjects?.some((item) => item.expressID === firstDoorId || item.value === firstDoorId)) firstDoorFireRating ??= findProperty(relation.RelatingPropertyDefinition, "FireRating");
}
for (const relationId of values(api.GetLineIDsWithType(modelId, IFCRELCONTAINEDINSPATIALSTRUCTURE, false))) {
  const relation = api.GetLine(modelId, relationId, true);
  if (relation.RelatedElements?.some((item) => item.expressID === firstDoorId || item.value === firstDoorId)) firstDoorStorey = unwrap(relation.RelatingStructure?.Name);
}

console.log(JSON.stringify({
  totalLines: api.GetAllLines(modelId).size(),
  doorCount: doorVector.size(),
  storeyCount: count(IFCBUILDINGSTOREY, true),
  propertyRelations: count(IFCRELDEFINESBYPROPERTIES),
  containmentRelations: count(IFCRELCONTAINEDINSPATIALSTRUCTURE),
  sampleDoors: doors,
  firstDoorFireRating: firstDoorFireRating ?? null,
  firstDoorStorey: firstDoorStorey ?? null,
}, null, 2));

api.CloseModel(modelId);
