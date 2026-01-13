import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProviderStore } from "@/stores/provider";
import { SelectProviderStep } from "./SelectProviderStep";
import { StandardProviderForm } from "./StandardProviderForm";
import type { OpencodeClient } from "@/services/opencode/types";

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: OpencodeClient | null;
}

export function AddProviderDialog({ open, onOpenChange, client }: AddProviderDialogProps) {
  const { registry, editingProvider, setEditingProvider } = useProviderStore();
  const [step, setStep] = useState<"select" | "configure">("select");
  const [selectedRegistryId, setSelectedRegistryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRegistry = useMemo(() => {
    if (!searchQuery.trim()) return registry;
    const query = searchQuery.toLowerCase();
    return Object.fromEntries(
      Object.entries(registry).filter(
        ([id, entry]) =>
          entry.name.toLowerCase().includes(query) ||
          id.toLowerCase().includes(query)
      )
    );
  }, [registry, searchQuery]);

  const handleSelect = (registryId: string) => {
    setSelectedRegistryId(registryId);
    setStep("configure");
  };

  const handleBack = () => {
    setStep("select");
    setSelectedRegistryId(null);
  };

  const handleComplete = () => {
    setStep("select");
    setSelectedRegistryId(null);
    setEditingProvider(null);
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep("select");
      setSelectedRegistryId(null);
      setEditingProvider(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>选择服务商</DialogTitle>
              <DialogDescription>
                从预设列表中选择或配置自定义服务商
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                placeholder="搜索服务商..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              <SelectProviderStep
                registry={filteredRegistry}
                onSelect={handleSelect}
              />
            </div>
          </>
        ) : (
          <StandardProviderForm
            registryId={selectedRegistryId || editingProvider?.registryId || ""}
            onBack={handleBack}
            onComplete={handleComplete}
            editingProvider={editingProvider}
            client={client}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
