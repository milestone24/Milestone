// rrule ESM/CJS interop: Namespace import works for both environments
// Server (CJS): Module exports object with RRule property
// Client (ESM via Vite): Named exports accessible via namespace import
import * as rrule from "rrule";
//import { RRule } from "rrule";
// Type-safe access: RRule is available on the namespace in both CJS and ESM
//const RRule: typeof rrule.RRule = rrule.RRule;
//import type { RRule as RRuleType } from "rrule";
//const RRule: typeof rrule.RRule = rrule.RRule;
/** @ts-ignore */
export const RRule: typeof rrule.RRule = rrule.RRule || rrule.default.RRule;
