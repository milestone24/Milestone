import { createContext, type ReactNode, useContext, useState } from "react";

type RecordTransactionContextType = {
  open: boolean;
  assetId: string | undefined;
  openTransaction: (assetId?: string) => void;
  closeTransaction: () => void;
  setPageAssetId: (assetId: string | undefined) => void;
};

const RecordTransactionContext =
  createContext<RecordTransactionContextType | null>(null);

export function RecordTransactionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState<string | undefined>(undefined);
  const [pageAssetId, setPageAssetId] = useState<string | undefined>(
    undefined
  );

  const openTransaction = (id?: string) => {
    setAssetId(id ?? pageAssetId);
    setOpen(true);
  };

  const closeTransaction = () => {
    setOpen(false);
    setAssetId(undefined);
  };

  return (
    <RecordTransactionContext.Provider
      value={{
        open,
        assetId,
        openTransaction,
        closeTransaction,
        setPageAssetId,
      }}
    >
      {children}
    </RecordTransactionContext.Provider>
  );
}

export function useRecordTransaction() {
  const context = useContext(RecordTransactionContext);
  if (!context) {
    throw new Error(
      "useRecordTransaction must be used within a RecordTransactionProvider"
    );
  }
  return context;
}
