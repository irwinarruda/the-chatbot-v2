import type { PrefsDTO } from "~/contracts/http/shared/prefs";

export interface PrefsGateway {
  persistPrefs(prefs: PrefsDTO): void;
}
