import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/uiStore";

export function GlobalModal() {
  const { currentModal, confirmModal } = useUIStore();

  if (!currentModal) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="bg-card border-primary/60 max-w-lg px-8 py-6 text-center">
        <DialogHeader className="items-center">
          {currentModal.imageUrl && (
            <img
              src={currentModal.imageUrl}
              alt=""
              className="w-56 h-56 mx-auto mb-4 object-contain drop-shadow-lg"
            />
          )}
          <DialogTitle className="text-xl font-bold whitespace-pre-line">
            {currentModal.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            알림 또는 시스템 메시지를 표시하는 대화상자입니다.
          </DialogDescription>
        </DialogHeader>
        <p className="mt-3 text-base text-muted-foreground whitespace-pre-line">
          {currentModal.message}
        </p>
        <div className="mt-6 flex justify-center">
          <Button size="lg" variant="gold" onClick={confirmModal}>
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

