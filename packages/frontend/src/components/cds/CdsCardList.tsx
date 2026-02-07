/**
 * CDS Card List — renders CDS Hooks cards with source attribution for DSI compliance.
 * Maps indicator to visual severity. Provides accept/override actions per card
 * and optional "Was this helpful?" feedback widget.
 *
 * §170.315(a)(9) Clinical Decision Support
 * §170.315(b)(11) Decision Support Interventions — Source Attribution
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CDSCard } from '@/types/cds';

interface CdsCardListProps {
  cards: CDSCard[];
  hookInstance: string;
  patientId: string;
  onAccept?: (card: CDSCard) => void;
  onOverride?: (card: CDSCard) => void;
  onFeedback?: (cardId: string, outcome: string) => void;
}

const indicatorStyles: Record<string, { border: string; bg: string; icon: React.ReactNode }> = {
  critical: {
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    icon: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />,
  },
  warning: {
    border: 'border-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  },
  info: {
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
  },
};

function CdsCard({
  card,
  onAccept,
  onOverride,
  onFeedback,
}: {
  card: CDSCard;
  onAccept?: (card: CDSCard) => void;
  onOverride?: (card: CDSCard) => void;
  onFeedback?: (cardId: string, outcome: string) => void;
}) {
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const style = indicatorStyles[card.indicator] || indicatorStyles.info;

  if (dismissed) return null;

  const handleAccept = () => {
    onAccept?.(card);
    setDismissed(true);
  };

  const handleFeedback = (outcome: string) => {
    setFeedbackGiven(outcome);
    onFeedback?.(card.uuid || card.summary, outcome);
  };

  return (
    <Alert className={`${style.border} ${style.bg} mb-3`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{style.icon}</div>
        <div className="flex-1 min-w-0">
          <AlertTitle className="flex items-center gap-2">
            <span>{card.summary}</span>
            <Badge
              variant="outline"
              className={
                card.indicator === 'critical'
                  ? 'border-red-500 text-red-700 dark:text-red-400'
                  : card.indicator === 'warning'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                    : 'border-blue-500 text-blue-700 dark:text-blue-400'
              }
            >
              {card.indicator}
            </Badge>
          </AlertTitle>

          {card.detail && (
            <AlertDescription className="mt-1 text-sm">
              {card.detail}
            </AlertDescription>
          )}

          {/* Source Attribution — DSI §170.315(b)(11) */}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Source: {card.source.label}</span>
            {card.source.url && (
              <a
                href={card.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Reference
              </a>
            )}
          </div>

          {/* Suggestions */}
          {card.suggestions && card.suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              {card.suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {suggestion.isRecommended && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  )}
                  <span>{suggestion.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Links */}
          {card.links && card.links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {card.links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {link.label}
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleAccept}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Accept
            </Button>
            {card.indicator !== 'info' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOverride?.(card)}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Override
              </Button>
            )}
          </div>

          {/* Feedback widget */}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Was this helpful?</span>
            {feedbackGiven ? (
              <span className="text-green-600">Thank you for your feedback</span>
            ) : (
              <>
                <button
                  onClick={() => handleFeedback('helpful')}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                >
                  <ThumbsUp className="h-3 w-3" />
                  Yes
                </button>
                <button
                  onClick={() => handleFeedback('not-helpful')}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                >
                  <ThumbsDown className="h-3 w-3" />
                  No
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );
}

export function CdsCardList({
  cards,
  hookInstance,
  patientId,
  onAccept,
  onOverride,
  onFeedback,
}: CdsCardListProps) {
  if (!cards || cards.length === 0) return null;

  // Sort: critical first, then warning, then info
  const sortedCards = [...cards].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.indicator] ?? 2) - (order[b.indicator] ?? 2);
  });

  return (
    <div className="space-y-1">
      {sortedCards.map((card, idx) => (
        <CdsCard
          key={card.uuid || idx}
          card={card}
          onAccept={onAccept}
          onOverride={onOverride}
          onFeedback={onFeedback}
        />
      ))}
    </div>
  );
}
