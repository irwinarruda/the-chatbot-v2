import type { Selection } from "@opentui/core";
import { useRenderer } from "@opentui/react";
import { useEffect } from "react";

export function useAutoCopy() {
  const renderer = useRenderer();

  useEffect(() => {
    const handleSelection = (selection: Selection) => {
      const text = selection.getSelectedText();
      if (text) {
        renderer.copyToClipboardOSC52(text);
      }
    };

    renderer.on("selection", handleSelection);
    return () => {
      renderer.off("selection", handleSelection);
    };
  }, [renderer]);
}
