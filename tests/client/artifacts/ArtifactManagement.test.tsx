import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiArtifactRepository } from "~/client/modules/artifacts/app/repositories/ApiArtifactRepository";
import { ArtifactList } from "~/client/modules/artifacts/screens/ArtifactsScreen/ArtifactList";
import { UploadTokenCard } from "~/client/modules/artifacts/screens/ArtifactsScreen/UploadTokenCard";
import { useApp } from "~/client/shared/stores/app";
import type { ArtifactDTO } from "~/contracts/http/artifacts/artifact";
import { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

vi.mock("~/client/shared/hooks/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark", palette: "barro" }),
}));

beforeEach(() => {
  useApp.getState().resetArtifacts();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("artifact management", () => {
  test("keeps token mutation disabled until status is known", async () => {
    let resolveStatus = (_status: { configured: boolean }) => {};
    const status = new Promise<{ configured: boolean }>((resolve) => {
      resolveStatus = resolve;
    });
    vi.spyOn(apiArtifactRepository, "getUploadTokenStatus").mockReturnValue(
      status,
    );
    const rotate = vi
      .spyOn(apiArtifactRepository, "rotateUploadToken")
      .mockResolvedValue({ configured: true, token: "secret" });

    render(<UploadTokenCard />);

    const createButton = screen.getByRole("button", { name: "Create token" });
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);
    expect(rotate).not.toHaveBeenCalled();

    await act(async () => {
      resolveStatus({ configured: false });
      await status;
    });

    expect(createButton).toBeEnabled();
  });

  test("shows the generated token as a ready-to-save skill configuration", async () => {
    vi.spyOn(apiArtifactRepository, "getUploadTokenStatus").mockResolvedValue({
      configured: false,
    });
    vi.spyOn(apiArtifactRepository, "rotateUploadToken").mockResolvedValue({
      configured: true,
      token: "tca_generated-upload-token",
    });

    render(<UploadTokenCard />);

    const createButton = await screen.findByRole("button", {
      name: "Create token",
    });
    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.click(createButton);

    const configElement = await screen.findByLabelText(
      "Skill configuration JSON",
    );
    const config = JSON.parse(configElement.textContent ?? "");
    const environment = config.defaultEnvironment;
    expect(config.environments[environment]).toEqual({
      baseUrl: window.location.origin,
      artifactToken: "tca_generated-upload-token",
    });
    expect(screen.getByText("~/.config/the-chatbot/config.json")).toBeVisible();
  });

  test("serializes artifact mutations across rows", async () => {
    const artifacts: ArtifactDTO[] = [
      {
        id: "d8749e8c-57a9-4b9c-b6f7-392238f63312",
        title: "Plan A",
        visibility: ArtifactVisibility.Private,
        version: 1,
        createdAt: "2026-08-16T12:00:00.000Z",
        updatedAt: "2026-08-16T12:00:00.000Z",
      },
      {
        id: "2fcdcd42-8bc0-45dc-9ae0-02e953f7f9da",
        title: "Plan B",
        visibility: ArtifactVisibility.Private,
        version: 1,
        createdAt: "2026-08-16T12:00:00.000Z",
        updatedAt: "2026-08-16T12:00:00.000Z",
      },
    ];
    vi.spyOn(apiArtifactRepository, "listArtifacts").mockResolvedValue(
      artifacts,
    );
    let resolveVisibility = (_artifact: (typeof artifacts)[number]) => {};
    const visibility = new Promise<(typeof artifacts)[number]>((resolve) => {
      resolveVisibility = resolve;
    });
    const changeVisibility = vi
      .spyOn(apiArtifactRepository, "changeVisibility")
      .mockReturnValue(visibility);

    render(<ArtifactList />);

    const user = userEvent.setup();
    const menus = await screen.findAllByRole("button", {
      name: "More actions",
    });
    await user.click(menus[0]);
    await user.click(
      await screen.findByRole("menuitem", { name: "Make public" }),
    );
    expect(changeVisibility).toHaveBeenCalledTimes(1);

    await user.click(menus[1]);
    const secondItem = await screen.findByRole("menuitem", {
      name: "Make public",
    });
    expect(secondItem).toHaveAttribute("aria-disabled", "true");
    await user.click(secondItem);
    expect(changeVisibility).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVisibility({
        ...artifacts[0],
        visibility: ArtifactVisibility.Public,
      });
      await visibility;
    });

    await waitFor(() => {
      expect(
        screen.getByRole("menuitem", { name: "Make public" }),
      ).not.toHaveAttribute("aria-disabled", "true");
    });
  });
});
