// Isolated bundle probe — React Aria Components Dialog surface (React externalized).
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";

export function M() {
  return (
    <DialogTrigger>
      <Button>Edit</Button>
      <ModalOverlay isDismissable>
        <Modal>
          <Dialog>
            <Heading slot="title">Edit split</Heading>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
