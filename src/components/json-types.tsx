export type JSONPrimitive = string | number | boolean | null;
export interface JSONObject {
  [key: string]: JSONValue;
}
export type JSONValue = JSONPrimitive | JSONObject | JSONValue[];
