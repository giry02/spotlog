import schema from '../../../docs/contracts/admin-v1/schemas.json' with { type: 'json' };

type Shape = { $ref?: string; type?: string; const?: unknown; enum?: unknown[]; anyOf?: Shape[]; allOf?: Shape[]; if?: Shape; then?: Shape; properties?: Record<string, Shape>; required?: string[]; additionalProperties?: boolean | Shape; items?: Shape; minLength?: number; maxLength?: number; minimum?: number; maximum?: number; maxItems?: number };
const definitions = schema.$defs as unknown as Record<string, Shape>;
/** The generated DTO schema uses this bounded subset; unsupported keywords must not silently validate. */
export function matchesAdminDto(name: string, value: unknown): boolean {
  let budget = 300000;
  const matches = (shape: Shape, input: unknown, depth = 0): boolean => {
    if (--budget < 0 || depth > 45 || !shape) return false;
    if (!Object.keys(shape).length) return true;
    if (shape.$ref) return matches(definitions[shape.$ref.replace('#/$defs/', '')], input, depth + 1);
    if (shape.allOf && !shape.allOf.every(candidate => matches(candidate,input,depth+1))) return false;
    if (shape.if && matches(shape.if,input,depth+1) && shape.then && !matches(shape.then,input,depth+1)) return false;
    if ('const' in shape && shape.const !== input) return false;
    if (shape.enum && !shape.enum.includes(input)) return false;
    if (shape.anyOf) return shape.anyOf.some(candidate => matches(candidate, input, depth + 1));
    if (shape.type === 'null') return input === null;
    if (shape.type === 'string') return typeof input === 'string' && input.length >= (shape.minLength ?? 0) && input.length <= (shape.maxLength ?? Infinity);
    if (shape.type === 'number' || shape.type === 'integer') return typeof input === 'number' && Number.isFinite(input) && (shape.type !== 'integer' || Number.isInteger(input)) && input >= (shape.minimum ?? -Infinity) && input <= (shape.maximum ?? Infinity);
    if (shape.type === 'boolean') return typeof input === 'boolean';
    if (shape.type === 'array') return Array.isArray(input) && input.length <= (shape.maxItems ?? Infinity) && input.every(item => matches(shape.items!, item, depth + 1));
    if (shape.type === 'object' || shape.properties || shape.required) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
      const object = input as Record<string, unknown>;
      if (shape.required?.some(key => !Object.hasOwn(object, key))) return false;
      return Object.entries(object).every(([key, item]) => shape.properties?.[key] ? item === undefined && !shape.required?.includes(key) || matches(shape.properties[key], item, depth + 1) : shape.additionalProperties !== false && (typeof shape.additionalProperties !== 'object' || matches(shape.additionalProperties, item, depth + 1)));
    }
    return !!shape.enum || 'const' in shape || !!shape.allOf || !!shape.if;
  };
  return matches(definitions[name], value);
}
