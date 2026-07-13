import { type Dictionary, getDictionary } from "~/shared/client/i18n";
import { usePrefs } from "~/shared/client/providers/usePrefs";

export function useDictionary(): Dictionary {
  const prefs = usePrefs();
  return getDictionary(prefs.locale);
}
