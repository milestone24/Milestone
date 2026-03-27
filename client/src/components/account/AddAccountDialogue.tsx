import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger, DialogContent } from "../ui/dialog";
import { AccountCreate, DRAFT_KEY } from "./AccountCreate";
import { UserAssetOrphanInsert } from "@shared/schema";

type AddAccountDialogueProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UserAssetOrphanInsert) => Promise<void>;
};

const AddAccountDialogue: React.FC<AddAccountDialogueProps> = ({
  open,
  onOpenChange,
  onSubmit,
}) => {
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) sessionStorage.removeItem(DRAFT_KEY);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={true}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground border-primary"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="overflow-y-scroll max-h-[90vh]"
      >
        <AccountCreate
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AddAccountDialogue;
