import { Text, View } from "react-native";
import { useRecordTransaction } from "@milestone/js-common/react/context/RecordTransactionContext";
import { AppModal } from "@/components/ui/modal";

export function RecordTransactionModal() {
  const { open, closeTransaction } = useRecordTransaction();

  return (
    <AppModal
      open={open}
      onOpenChange={(open) => {
        if (!open) closeTransaction();
      }}
      title="Record Transaction"
      description="Full transaction recording will be implemented in a follow-up phase."
    >
      <View className="py-4">
        <Text className="text-muted-foreground text-sm">
          Use the web client for full transaction recording until this modal is ported.
        </Text>
      </View>
    </AppModal>
  );
}
