/**
 * ResultTrendingChart — SVG-based line chart for lab result trending.
 * Renders data points connected by lines, with a shaded green reference-range
 * band and color-coded dots (blue = in range, red = out of range).
 * No external charting dependencies; pure React + SVG.
 */

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DataPoint {
  date: string;
  value: number;
  unit: string;
}

interface ResultTrendingChartProps {
  data: DataPoint[];
  title: string;
  referenceRange?: { low: number; high: number };
  height?: number;
  width?: number;
}

const PADDING = { top: 30, right: 50, bottom: 50, left: 60 };

export function ResultTrendingChart({
  data,
  title,
  referenceRange,
  height = 300,
  width = 600,
}: ResultTrendingChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height: height - 80 }}
          >
            No trending data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const { points, yMin, yMax, xScale, yScale } = useMemo(() => {
    const values = data.map((d) => d.value);
    let computedYMin = Math.min(...values);
    let computedYMax = Math.max(...values);

    // Extend range to include reference range if provided
    if (referenceRange) {
      computedYMin = Math.min(computedYMin, referenceRange.low);
      computedYMax = Math.max(computedYMax, referenceRange.high);
    }

    // Add 10% padding to Y axis
    const yPadding = (computedYMax - computedYMin) * 0.1 || 1;
    computedYMin -= yPadding;
    computedYMax += yPadding;

    const xScaleFn = (index: number): number => {
      if (data.length === 1) return chartWidth / 2;
      return (index / (data.length - 1)) * chartWidth;
    };

    const yScaleFn = (value: number): number => {
      if (computedYMax === computedYMin) return chartHeight / 2;
      return chartHeight - ((value - computedYMin) / (computedYMax - computedYMin)) * chartHeight;
    };

    const computedPoints = data.map((d, i) => ({
      x: xScaleFn(i),
      y: yScaleFn(d.value),
      value: d.value,
      date: d.date,
      unit: d.unit,
      inRange: referenceRange
        ? d.value >= referenceRange.low && d.value <= referenceRange.high
        : true,
    }));

    return {
      points: computedPoints,
      yMin: computedYMin,
      yMax: computedYMax,
      xScale: xScaleFn,
      yScale: yScaleFn,
    };
  }, [data, referenceRange, chartWidth, chartHeight]);

  // Build polyline path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Y-axis tick generation
  const yTicks = useMemo(() => {
    const tickCount = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(yMin + (i / tickCount) * (yMax - yMin));
    }
    return ticks;
  }, [yMin, yMax]);

  // Format date for x-axis label
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format value for y-axis label
  const formatValue = (val: number): string => {
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(1);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          {title}
          {data.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({data[0].unit})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            style={{ minWidth: Math.min(width, 400) }}
            role="img"
            aria-label={`${title} trend chart with ${data.length} data points`}
          >
            <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
              {/* Reference Range Band */}
              {referenceRange && (
                <rect
                  x={0}
                  y={yScale(referenceRange.high)}
                  width={chartWidth}
                  height={yScale(referenceRange.low) - yScale(referenceRange.high)}
                  fill="rgb(34, 197, 94)"
                  opacity={0.12}
                  rx={2}
                />
              )}

              {/* Reference Range Boundary Lines */}
              {referenceRange && (
                <>
                  <line
                    x1={0}
                    y1={yScale(referenceRange.high)}
                    x2={chartWidth}
                    y2={yScale(referenceRange.high)}
                    stroke="rgb(34, 197, 94)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    opacity={0.5}
                  />
                  <line
                    x1={0}
                    y1={yScale(referenceRange.low)}
                    x2={chartWidth}
                    y2={yScale(referenceRange.low)}
                    stroke="rgb(34, 197, 94)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    opacity={0.5}
                  />
                  {/* Reference range labels */}
                  <text
                    x={chartWidth + 4}
                    y={yScale(referenceRange.high)}
                    fontSize={10}
                    fill="rgb(34, 197, 94)"
                    dominantBaseline="middle"
                  >
                    {formatValue(referenceRange.high)}
                  </text>
                  <text
                    x={chartWidth + 4}
                    y={yScale(referenceRange.low)}
                    fontSize={10}
                    fill="rgb(34, 197, 94)"
                    dominantBaseline="middle"
                  >
                    {formatValue(referenceRange.low)}
                  </text>
                </>
              )}

              {/* Grid Lines */}
              {yTicks.map((tick, i) => (
                <g key={`grid-${i}`}>
                  <line
                    x1={0}
                    y1={yScale(tick)}
                    x2={chartWidth}
                    y2={yScale(tick)}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    opacity={0.1}
                  />
                  <text
                    x={-8}
                    y={yScale(tick)}
                    fontSize={11}
                    fill="currentColor"
                    textAnchor="end"
                    dominantBaseline="middle"
                    opacity={0.5}
                  >
                    {formatValue(tick)}
                  </text>
                </g>
              ))}

              {/* X Axis */}
              <line
                x1={0}
                y1={chartHeight}
                x2={chartWidth}
                y2={chartHeight}
                stroke="currentColor"
                strokeWidth={1}
                opacity={0.2}
              />

              {/* X Axis Labels */}
              {points.map((p, i) => (
                <text
                  key={`x-label-${i}`}
                  x={p.x}
                  y={chartHeight + 18}
                  fontSize={10}
                  fill="currentColor"
                  textAnchor="middle"
                  opacity={0.5}
                >
                  {formatDate(data[i].date)}
                </text>
              ))}

              {/* Data Line */}
              {points.length > 1 && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Data Points */}
              {points.map((p, i) => (
                <g key={`point-${i}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    fill={p.inRange ? 'rgb(59, 130, 246)' : 'rgb(239, 68, 68)'}
                    stroke="white"
                    strokeWidth={2}
                  >
                    <title>
                      {formatDate(p.date)}: {p.value} {p.unit}
                      {referenceRange
                        ? p.inRange
                          ? ' (within range)'
                          : ' (OUT OF RANGE)'
                        : ''}
                    </title>
                  </circle>
                  {/* Value label above/below point */}
                  <text
                    x={p.x}
                    y={p.y - 10}
                    fontSize={10}
                    fill={p.inRange ? 'rgb(59, 130, 246)' : 'rgb(239, 68, 68)'}
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {p.value}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Legend */}
        {referenceRange && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span>Within reference range</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              <span>Outside reference range</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-6 rounded-sm bg-green-500/20 border border-green-500/30" />
              <span>
                Reference range ({formatValue(referenceRange.low)} -{' '}
                {formatValue(referenceRange.high)})
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
