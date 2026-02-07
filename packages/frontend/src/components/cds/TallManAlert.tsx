/**
 * TallManAlert — renders drug names with Tall Man lettering to help clinicians
 * distinguish look-alike/sound-alike (LASA) medications. Uppercase letter
 * sequences in the tallManName prop are highlighted with bold styling and
 * contrasting color per ISMP Tall Man Lettering conventions.
 *
 * §170.315(a)(9) Clinical Decision Support — medication safety
 */

import React from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TallManAlertProps {
  drugName: string;
  tallManName: string;
  confusableWith?: string;
}

/**
 * Parse a Tall Man name string and return React nodes.
 * Consecutive uppercase letters are rendered in bold red/orange;
 * lowercase letters are rendered normally.
 *
 * Example: "hydrOXYzine" => ["hydr", <strong>OXY</strong>, "zine"]
 */
function renderTallManName(tallManName: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let currentSegment = '';
  let currentIsUpper = false;
  let keyIdx = 0;

  const flush = () => {
    if (currentSegment.length === 0) return;
    if (currentIsUpper) {
      parts.push(
        <span
          key={keyIdx++}
          className="font-bold text-red-600 dark:text-orange-400"
        >
          {currentSegment}
        </span>,
      );
    } else {
      parts.push(
        <span key={keyIdx++} className="text-foreground">
          {currentSegment}
        </span>,
      );
    }
    currentSegment = '';
  };

  for (const char of tallManName) {
    const isUpper = char >= 'A' && char <= 'Z';
    if (currentSegment.length > 0 && isUpper !== currentIsUpper) {
      flush();
    }
    currentIsUpper = isUpper;
    currentSegment += char;
  }
  flush();

  return parts;
}

export function TallManAlert({
  drugName,
  tallManName,
  confusableWith,
}: TallManAlertProps) {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-600">
      <CardContent className="flex items-start gap-3 py-3 px-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-wide leading-tight">
            {renderTallManName(tallManName)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Generic: {drugName}
          </p>
          {confusableWith && (
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-600"
              >
                Look-Alike / Sound-Alike
              </Badge>
              <span className="text-xs text-muted-foreground">
                May be confused with{' '}
                <span className="font-medium text-foreground">
                  {confusableWith}
                </span>
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
