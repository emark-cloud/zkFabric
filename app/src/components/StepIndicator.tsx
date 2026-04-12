"use client";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;

        return (
          <div key={label} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-heading font-bold border-2 transition-all duration-300 ${
                  isCompleted
                    ? "bg-[#8b5cf6]/20 border-[#8b5cf6] text-[#a78bfa]"
                    : isActive
                      ? "border-[#8b5cf6] text-[#e4e4e7] animate-glow-pulse"
                      : "border-[#1a1b23] text-[#3f3f46]"
                }`}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-2 text-[10px] uppercase tracking-wider font-heading whitespace-nowrap ${
                  isCompleted || isActive ? "text-[#a1a1aa]" : "text-[#3f3f46]"
                }`}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={`w-12 sm:w-20 h-[2px] mx-2 mb-6 transition-all duration-500 ${
                  isCompleted
                    ? "bg-gradient-to-r from-[#8b5cf6] to-[#22d3ee]"
                    : "bg-[#1a1b23]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
