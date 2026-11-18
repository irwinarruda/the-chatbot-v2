import type { SpreadsheetPickerGateway } from "~/client/modules/cash-flow/app/gateways/SpreadsheetPickerGateway";

const PICKER_SCRIPT_URL = "https://apis.google.com/js/api.js";

interface PickerResult {
  action: string;
  docs?: { id: string }[];
}

interface PickerView {
  setMode(mode: string): PickerView;
  setFileIds(fileIds: string): PickerView;
}

interface PickerBuilder {
  setAppId(appId: string): PickerBuilder;
  setOAuthToken(accessToken: string): PickerBuilder;
  setDeveloperKey(developerKey: string): PickerBuilder;
  addView(view: PickerView): PickerBuilder;
  setCallback(callback: (result: PickerResult) => void): PickerBuilder;
  build(): { setVisible(isVisible: boolean): void };
}

interface GooglePicker {
  Action: { PICKED: string; CANCEL: string };
  DocsView: new (viewId: string) => PickerView;
  DocsViewMode: { LIST: string };
  PickerBuilder: new () => PickerBuilder;
  ViewId: { SPREADSHEETS: string };
}

declare global {
  interface Window {
    gapi?: { load(library: string, callback: () => void): void };
    google?: { picker?: GooglePicker };
  }
}

let loadingPicker: Promise<GooglePicker> | undefined;

function loadPicker(): Promise<GooglePicker> {
  loadingPicker ??= new Promise<GooglePicker>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PICKER_SCRIPT_URL;
    script.onerror = () => reject(new Error("Google Picker failed to load"));
    script.onload = () => {
      window.gapi?.load("picker", () => {
        const picker = window.google?.picker;
        if (picker) resolve(picker);
        else reject(new Error("Google Picker failed to load"));
      });
    };
    document.head.append(script);
  }).catch((error) => {
    loadingPicker = undefined;
    throw error;
  });
  return loadingPicker;
}

export const browserSpreadsheetPickerGateway: SpreadsheetPickerGateway = {
  async pickSpreadsheet(picker) {
    const google = await loadPicker();
    const view = new google.DocsView(google.ViewId.SPREADSHEETS).setMode(
      google.DocsViewMode.LIST,
    );
    if (picker.spreadsheetId) view.setFileIds(picker.spreadsheetId);
    return new Promise((resolve) => {
      const builder = new google.PickerBuilder()
        .setAppId(picker.appId)
        .setOAuthToken(picker.accessToken)
        .addView(view)
        .setCallback((result) => {
          if (result.action === google.Action.CANCEL) resolve(undefined);
          if (result.action !== google.Action.PICKED) return;
          const id = result.docs?.[0]?.id;
          resolve(
            id
              ? `https://docs.google.com/spreadsheets/d/${id}/edit`
              : undefined,
          );
        });
      if (picker.developerKey) builder.setDeveloperKey(picker.developerKey);
      builder.build().setVisible(true);
    });
  },
};
