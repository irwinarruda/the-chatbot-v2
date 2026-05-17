import { type Dictionary, getDictionary } from "~/client/i18n";
import { usePrefs } from "~/client/providers/usePrefs";

export function useDictionary(): Dictionary {
  const prefs = usePrefs();
  return getDictionary(prefs.locale);
}
