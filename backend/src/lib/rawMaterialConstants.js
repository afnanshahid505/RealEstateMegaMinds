const MATERIAL_CATEGORIES = ["BINDING", "AGGREGATE", "FUEL", "ADDITIVE", "OTHER"];
const MATERIAL_UNITS = ["BAGS", "KG", "TONS", "LITRES", "CUBIC_METERS"];

const LEGACY_UNIT_MAP = {
  bags: "BAGS",
  bag: "BAGS",
  kg: "KG",
  kgs: "KG",
  tons: "TONS",
  ton: "TONS",
  litres: "LITRES",
  liters: "LITRES",
  litre: "LITRES",
  "cubic meters": "CUBIC_METERS",
  "cubic_meters": "CUBIC_METERS",
};

function normalizeUnit(unit) {
  if (!unit) return null;
  const upper = String(unit).trim().toUpperCase().replace(/\s+/g, "_");
  if (MATERIAL_UNITS.includes(upper)) return upper;
  return LEGACY_UNIT_MAP[String(unit).trim().toLowerCase()] || null;
}

function validateMaterialInput(body, { requireAll = false } = {}) {
  const errors = [];
  if (requireAll || body.category != null) {
    if (!MATERIAL_CATEGORIES.includes(body.category)) errors.push("Invalid category");
  }
  if (requireAll || body.unit != null) {
    const u = normalizeUnit(body.unit);
    if (!u) errors.push("Invalid unit of measure");
    else body.unit = u;
  }
  return errors;
}

module.exports = {
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  normalizeUnit,
  validateMaterialInput,
};
