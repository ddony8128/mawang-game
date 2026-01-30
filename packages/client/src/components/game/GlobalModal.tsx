import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/uiStore";

export function GlobalModal() {
  const { currentModal, confirmModal } = useUIStore();

  if (!currentModal) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="bg-card border-primary/60 max-w-xs text-center">
        <DialogHeader className="items-center">
          {currentModal.imageUrl && (
            <img
              src={currentModal.imageUrl}
              alt=""
              className="w-28 h-28 mx-auto mb-2 object-contain drop-shadow-lg"
            />
          )}
          <DialogTitle className="text-base font-bold whitespace-pre-line">
            {currentModal.title}
          </DialogTitle>
        </DialogHeader>
        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
          {currentModal.message}
        </p>
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="gold" onClick={confirmModal}>
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

