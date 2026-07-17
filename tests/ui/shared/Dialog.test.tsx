import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/shared/client/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/shared/client/components/ui/dialog";

function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" />}>
        Edit profile
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Profile settings</DialogTitle>
        <DialogDescription>
          Update the name shown in your account.
        </DialogDescription>
        <label htmlFor="profile-name">Name</label>
        <input id="profile-name" defaultValue="Ada" />
      </DialogContent>
    </Dialog>
  );
}

function AlertDialogExample({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<button type="button" />}>
        Delete project
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Delete project permanently?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep project</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe("Dialog", () => {
  test("provides accessible context, manages focus, and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<DialogExample />);
    const trigger = screen.getByRole("button", { name: "Edit profile" });

    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      description: "Update the name shown in your account.",
      name: "Profile settings",
    });
    expect(dialog).toBeVisible();
    const nameInput = screen.getByRole("textbox", { name: "Name" });
    await waitFor(() => expect(nameInput).toHaveFocus());

    await user.keyboard("{Escape}");

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe("AlertDialog", () => {
  test("confirms a destructive action and closes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<AlertDialogExample onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Delete project" }));

    const dialog = await screen.findByRole("alertdialog", {
      description: "This action cannot be undone.",
      name: "Delete project permanently?",
    });
    await user.click(
      screen.getByRole("button", { name: "Delete permanently" }),
    );

    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  test("cancels without confirming the destructive action", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<AlertDialogExample onConfirm={onConfirm} />);
    const trigger = screen.getByRole("button", { name: "Delete project" });

    await user.click(trigger);
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete project permanently?",
    });
    await user.click(screen.getByRole("button", { name: "Keep project" }));

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
