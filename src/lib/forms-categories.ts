/** Forms & procedures categories, in screen order (Riaan, 27 Oct 2026). The
 * key is stored in forms_procedures.category; existing documents start in
 * "Apex Forms and Procedures". */
export const FORMS_CATEGORIES = [
  { key: "apex_client_info", label: "Apex Client Info", note: null },
  { key: "apex_forms", label: "Apex Forms and Procedures", note: null },
  { key: "sacaa", label: "SACAA Forms and Procedures", note: null },
  { key: "sahpa", label: "SAHPA Forms and Procedures", note: null },
  { key: "general", label: "General", note: "General and Tech Dummy" },
] as const;

export type FormsCategory = (typeof FORMS_CATEGORIES)[number]["key"];
export const DEFAULT_FORMS_CATEGORY: FormsCategory = "apex_forms";

export function isFormsCategory(v: unknown): v is FormsCategory {
  return FORMS_CATEGORIES.some((c) => c.key === v);
}

/** Items grouped by category in screen order (empty categories included). */
export function groupByCategory<T extends { category: string }>(items: T[]) {
  return FORMS_CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => (isFormsCategory(i.category) ? i.category : DEFAULT_FORMS_CATEGORY) === c.key),
  }));
}
