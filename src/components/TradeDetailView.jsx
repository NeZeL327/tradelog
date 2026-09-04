import { useState } from "react";
import { Brain } from "lucide-react";
import TradeCard from "@/components/TradeCard";
import { EmotionsInlinePanel, countFilledEmotionStages } from "@/components/EmotionsPanel";

export default function TradeDetailView({ trade, onEdit }) {
  const hasEmotionData =
    countFilledEmotionStages(trade?.emotions) > 0 ||
    Number(trade?.setup_confidence) > 0 ||
    String(trade?.setup_confidence_comment || "").trim().length > 0;

  const [emotionsOpen, setEmotionsOpen] = useState(hasEmotionData);

  return (
    <div className="flex flex-col lg:flex-row gap-0 items-start">
      {emotionsOpen && hasEmotionData && (
        <EmotionsInlinePanel
          readOnly
          value={trade.emotions}
          setupConfidence={trade.setup_confidence}
          setupConfidenceComment={trade.setup_confidence_comment}
          compact
          onClose={() => setEmotionsOpen(false)}
          className="lg:mr-0"
        />
      )}

      <div className="flex-1 min-w-0">
        {!emotionsOpen && hasEmotionData && (
          <button
            type="button"
            onClick={() => setEmotionsOpen(true)}
            className="mb-4 w-full flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-card hover:border-primary/50 transition text-left"
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
                <Brain className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Pokaż dziennik emocji
              </span>
            </span>
            <span className="text-xs font-semibold text-foreground bg-background rounded-full px-2 py-0.5">
              {countFilledEmotionStages(trade.emotions)}/3
              {Number(trade.setup_confidence) > 0 ? ` · ${trade.setup_confidence}★` : ""}
            </span>
          </button>
        )}

        <TradeCard trade={trade} onEdit={onEdit} />
      </div>
    </div>
  );
}
