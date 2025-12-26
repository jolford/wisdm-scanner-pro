import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Clock, Edit, MousePointer } from 'lucide-react';

interface InteractionData {
  fieldName: string;
  viewCount: number;
  editCount: number;
  avgTimeSpentMs: number;
  correctionRate: number;
  lastInteraction: string;
}

interface DocumentHeatmapProps {
  documentId: string;
  interactions?: InteractionData[];
  imageUrl?: string;
  zones?: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export function DocumentHeatmap({ 
  documentId, 
  interactions = [],
  imageUrl,
  zones = []
}: DocumentHeatmapProps) {
  const [metric, setMetric] = useState<'time' | 'corrections' | 'views'>('time');
  
  // Generate demo data if none provided
  const data = useMemo(() => {
    if (interactions.length > 0) return interactions;
    
    return [
      { fieldName: 'Invoice Number', viewCount: 45, editCount: 3, avgTimeSpentMs: 2100, correctionRate: 0.07, lastInteraction: '2h ago' },
      { fieldName: 'Date', viewCount: 42, editCount: 8, avgTimeSpentMs: 4500, correctionRate: 0.19, lastInteraction: '1h ago' },
      { fieldName: 'Vendor Name', viewCount: 50, editCount: 12, avgTimeSpentMs: 6200, correctionRate: 0.24, lastInteraction: '30m ago' },
      { fieldName: 'Total Amount', viewCount: 55, editCount: 5, avgTimeSpentMs: 3800, correctionRate: 0.09, lastInteraction: '45m ago' },
      { fieldName: 'Line Items', viewCount: 38, editCount: 22, avgTimeSpentMs: 12500, correctionRate: 0.58, lastInteraction: '15m ago' },
      { fieldName: 'Tax Amount', viewCount: 40, editCount: 6, avgTimeSpentMs: 2900, correctionRate: 0.15, lastInteraction: '2h ago' },
      { fieldName: 'Address', viewCount: 35, editCount: 18, avgTimeSpentMs: 8700, correctionRate: 0.51, lastInteraction: '1h ago' },
      { fieldName: 'PO Number', viewCount: 30, editCount: 2, avgTimeSpentMs: 1500, correctionRate: 0.07, lastInteraction: '3h ago' },
    ];
  }, [interactions]);

  const getHeatValue = (item: InteractionData): number => {
    switch (metric) {
      case 'time':
        return item.avgTimeSpentMs / 15000; // Normalize to 0-1
      case 'corrections':
        return item.correctionRate;
      case 'views':
        return item.viewCount / 60; // Normalize to 0-1
      default:
        return 0;
    }
  };

  const getHeatColor = (value: number): string => {
    // Blue (cold) -> Yellow -> Red (hot)
    if (value < 0.33) {
      return `hsl(210, 80%, ${70 - value * 60}%)`;
    } else if (value < 0.66) {
      return `hsl(45, 90%, ${60 - (value - 0.33) * 40}%)`;
    } else {
      return `hsl(0, 80%, ${55 - (value - 0.66) * 30}%)`;
    }
  };

  const maxValue = Math.max(...data.map(getHeatValue));
  
  const sortedData = [...data].sort((a, b) => getHeatValue(b) - getHeatValue(a));

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Document Interaction Heatmap
          </CardTitle>
          <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Time Spent</SelectItem>
              <SelectItem value="corrections">Correction Rate</SelectItem>
              <SelectItem value="views">View Count</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Low activity</span>
          <div className="flex-1 mx-4 h-2 rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500" />
          <span>High activity</span>
        </div>

        {/* Heatmap Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <TooltipProvider>
            {sortedData.map((item) => {
              const heat = getHeatValue(item) / Math.max(maxValue, 0.01);
              const color = getHeatColor(heat);
              
              return (
                <Tooltip key={item.fieldName}>
                  <TooltipTrigger asChild>
                    <div
                      className="p-3 rounded-lg border cursor-pointer transition-transform hover:scale-105"
                      style={{ backgroundColor: color }}
                    >
                      <div className="font-medium text-sm truncate" style={{ color: heat > 0.5 ? 'white' : 'inherit' }}>
                        {item.fieldName}
                      </div>
                      <div className="text-xs mt-1 opacity-80" style={{ color: heat > 0.5 ? 'white' : 'inherit' }}>
                        {metric === 'time' && formatTime(item.avgTimeSpentMs)}
                        {metric === 'corrections' && `${(item.correctionRate * 100).toFixed(0)}% corrections`}
                        {metric === 'views' && `${item.viewCount} views`}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="p-3">
                    <div className="space-y-1">
                      <p className="font-medium">{item.fieldName}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <Eye className="h-3 w-3" />
                        {item.viewCount} views
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Edit className="h-3 w-3" />
                        {item.editCount} edits ({(item.correctionRate * 100).toFixed(0)}%)
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3 w-3" />
                        Avg. {formatTime(item.avgTimeSpentMs)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MousePointer className="h-3 w-3" />
                        Last: {item.lastInteraction}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>

        {/* Insights */}
        <div className="pt-3 border-t space-y-2">
          <h4 className="text-sm font-medium">Insights</h4>
          <div className="flex flex-wrap gap-2">
            {sortedData[0] && (
              <Badge variant="destructive" className="text-xs">
                Most time on: {sortedData[0].fieldName}
              </Badge>
            )}
            {data.filter(d => d.correctionRate > 0.3).length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {data.filter(d => d.correctionRate > 0.3).length} fields need attention
              </Badge>
            )}
            {data.some(d => d.correctionRate > 0.5) && (
              <Badge className="text-xs bg-amber-500">
                High correction rate detected
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
