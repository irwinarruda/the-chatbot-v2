import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ArtifactList } from "~/modules/artifacts/client/components/ArtifactList";
import { UploadTokenCard } from "~/modules/artifacts/client/components/UploadTokenCard";
import { artifactService } from "~/modules/artifacts/client/services/artifactService";
import type { ArtifactDTO } from "~/modules/artifacts/entities/dtos/ArtifactDTO";
import { ArtifactVisibility } from "~/modules/artifacts/entities/enums/ArtifactVisibility";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

vi.mock("~/shared/client/providers/usePrefs", () => ({
  usePrefs: () => ({ locale: "en", theme: "dark" }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("artifact management", () => {
  test("keeps token mutation disabled until status is known", async () => {
    let resolveStatus = (_status: { configured: boolean }) => {};
    const status = new Promise<{ configured: boolean }>((resolve) => {
      resolveStatus = resolve;
    });
    vi.spyOn(artifactService, "getUploadTokenStatus").mockReturnValue(status);
    const rotate = vi
      .spyOn(artifactService, "rotateUploadToken")
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
    vi.spyOn(artifactService, "getUploadTokenStatus").mockResolvedValue({
      configured: false,
    });
    vi.spyOn(artifactService, "rotateUploadToken").mockResolvedValue({
      configured: true,
      token: "tca_generated-upload-token",
    });

    render(<UploadTokenCard />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Create token" }),
    );

    const configElement = await screen.findByLabelText(
      "Skill configuration JSON",
    );
    const config = JSON.parse(configElement.textContent ?? "");
    const environment = config.defaultEnvironment;
    expect(config.environments[environment]).toEqual({
      baseUrl: window.location.origin,
      artifactToken: "tca_generated-upload-token",
    });
    expect(
      screen.getByText("~/.agents/skills/the-chatbot-artifact/config.json"),
    ).toBeVisible();
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
    vi.spyOn(artifactService, "listArtifacts").mockResolvedValue(artifacts);
    let resolveVisibility = (_artifact: (typeof artifacts)[number]) => {};
    const visibility = new Promise<(typeof artifacts)[number]>((resolve) => {
      resolveVisibility = resolve;
    });
    const changeVisibility = vi
      .spyOn(artifactService, "changeVisibility")
      .mockReturnValue(visibility);

    render(<ArtifactList />);

    const buttons = await screen.findAllByRole("button", {
      name: "Make public",
    });
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });
    fireEvent.click(buttons[1]);
    expect(changeVisibility).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVisibility({
        ...artifacts[0],
        visibility: ArtifactVisibility.Public,
      });
      await visibility;
    });

    expect(buttons[1]).toBeEnabled();
  });
});
