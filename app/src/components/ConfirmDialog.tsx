"use client";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "default";
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  variant = "default",
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#0a0b0d] border border-[#1a1b23] rounded-xl p-6 max-w-md w-full mx-4 animate-fade-in-up shadow-2xl">
        <h3 className={`text-lg font-heading font-bold mb-2 ${isDanger ? "text-[#f87171]" : "text-[#e4e4e7]"}`}>
          {title}
        </h3>
        <p className="text-sm text-[#71717a] mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-[#1a1b23] text-[#a1a1aa] hover:bg-[#111218] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              isDanger
                ? "bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] hover:bg-[#f87171]/20"
                : "bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 text-[#a78bfa] hover:bg-[#8b5cf6]/20"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
