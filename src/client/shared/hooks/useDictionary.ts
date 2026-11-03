import {
  type Dictionary,
  getDictionary,
} from "~/client/shared/i18n/dictionary";
import { usePrefs } from "./usePrefs";

export function useDictionary(): Dictionary {
  const prefs = usePrefs();
  return getDictionary(prefs.locale);
}
