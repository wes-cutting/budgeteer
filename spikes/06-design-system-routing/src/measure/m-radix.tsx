// Isolated bundle probe — Radix Dialog surface (React externalized).
import * as Dialog from "@radix-ui/react-dialog";

export function M() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Edit</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Edit split</Dialog.Title>
          <Dialog.Close>Cancel</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
