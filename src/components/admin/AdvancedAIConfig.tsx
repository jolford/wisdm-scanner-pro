import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, TrendingUp, Scan, Target } from 'lucide-react';

interface AdvancedAISettings {
  enableConfidenceScoring?: boolean;
  enableHandwritingMode?: boolean;
  enableSmartDetection?: boolean;
  enableSelfLearning?: boolean;
  enableMLTemplates?: boolean;
}

interface AdvancedAIConfigProps {
  settings: AdvancedAISettings;
  onSettingsChange: (settings: AdvancedAISettings) => void;
  disabled?: boolean;
}

export function AdvancedAIConfig({ 
  settings, 
  onSettingsChange,
  disabled = false 
}: AdvancedAIConfigProps) {
  
  const handleToggle = (key: keyof AdvancedAISettings, value: boolean) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Advanced AI Capabilities
          </h3>
        </div>
        <Badge variant="outline" className="bg-primary/10">
          Enterprise
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Confidence Scoring */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="flex gap-3">
            <Target className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="confidence-scoring" className="font-medium cursor-pointer">
                Confidence Scoring
              </Label>
              <p className="text-sm text-muted-foreground">
                Get accuracy scores (0-100%) for each extracted field. Auto-flags low-confidence fields for review.
              </p>
            </div>
          </div>
          <Switch
            id="confidence-scoring"
            checked={settings.enableConfidenceScoring ?? false}
            onCheckedChange={(checked) => handleToggle('enableConfidenceScoring', checked)}
            disabled={disabled}
          />
        </div>

        {/* Handwriting Recognition */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="flex gap-3">
            <Scan className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="handwriting-mode" className="font-medium cursor-pointer">
                Advanced Handwriting Recognition
              </Label>
              <p className="text-sm text-muted-foreground">
                Specialized OCR for cursive, print, and mixed handwriting styles using Gemini Pro.
              </p>
            </div>
          </div>
          <Switch
            id="handwriting-mode"
            checked={settings.enableHandwritingMode ?? false}
            onCheckedChange={(checked) => handleToggle('enableHandwritingMode', checked)}
            disabled={disabled}
          />
        </div>

        {/* Smart Field Detection */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="flex gap-3">
            <Brain className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="smart-detection" className="font-medium cursor-pointer">
                Smart Field Detection
              </Label>
              <p className="text-sm text-muted-foreground">
                Auto-discover form fields without manual configuration. AI analyzes document structure.
              </p>
            </div>
          </div>
          <Switch
            id="smart-detection"
            checked={settings.enableSmartDetection ?? false}
            onCheckedChange={(checked) => handleToggle('enableSmartDetection', checked)}
            disabled={disabled}
          />
        </div>

        {/* Self-Learning System */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="flex gap-3">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="self-learning" className="font-medium cursor-pointer">
                Self-Learning System
              </Label>
              <p className="text-sm text-muted-foreground">
                Tracks validation corrections and improves accuracy over time automatically.
              </p>
            </div>
          </div>
          <Switch
            id="self-learning"
            checked={settings.enableSelfLearning ?? false}
            onCheckedChange={(checked) => handleToggle('enableSelfLearning', checked)}
            disabled={disabled}
          />
        </div>

        {/* ML Templates */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="ml-templates" className="font-medium cursor-pointer">
                Machine Learning Templates
              </Label>
              <p className="text-sm text-muted-foreground">
                Auto-create templates for document types. Learns patterns and improves with each batch.
              </p>
            </div>
          </div>
          <Switch
            id="ml-templates"
            checked={settings.enableMLTemplates ?? false}
            onCheckedChange={(checked) => handleToggle('enableMLTemplates', checked)}
            disabled={disabled}
          />
        </div>
      </div>

      {Object.values(settings).some(v => v) && (
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> Enable all features for maximum accuracy. The self-learning system gets smarter with every correction you make.
          </p>
        </div>
      )}
    </Card>
  );
}
