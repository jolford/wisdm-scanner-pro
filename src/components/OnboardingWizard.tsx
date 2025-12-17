import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  ArrowLeft,
  Building2, 
  FolderOpen, 
  FileText, 
  Upload, 
  CheckCheck,
  Sparkles,
  Rocket
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  action: {
    label: string;
    route: string;
  };
  tips: string[];
  checkComplete: () => Promise<boolean>;
}

const wizardSteps: WizardStep[] = [
  {
    id: 'create_customer',
    title: 'Create Organization',
    description: 'Set up your company or organization to manage projects, users, and licenses.',
    icon: Building2,
    action: { label: 'Create Organization', route: '/admin/customers/new' },
    tips: [
      'Organizations help you separate different clients or departments',
      'You can create multiple organizations for different business units',
      'Users can be assigned to one or more organizations'
    ],
    checkComplete: async () => {
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      return (count || 0) > 0;
    },
  },
  {
    id: 'create_project',
    title: 'Configure Project',
    description: 'Create a document processing project with custom extraction fields for your document types.',
    icon: FolderOpen,
    action: { label: 'Create Project', route: '/admin/projects/new' },
    tips: [
      'Projects define what data to extract from your documents',
      'Add extraction fields like Invoice Number, Date, Amount, etc.',
      'Enable features like signature verification or PII detection'
    ],
    checkComplete: async () => {
      const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true });
      return (count || 0) > 0;
    },
  },
  {
    id: 'create_batch',
    title: 'Start a Batch',
    description: 'Create your first document batch to organize and process related documents together.',
    icon: FileText,
    action: { label: 'Create Batch', route: '/admin/batches/new' },
    tips: [
      'Batches group related documents for processing',
      'You can set priority levels for urgent batches',
      'Assign batches to specific operators for review'
    ],
    checkComplete: async () => {
      const { count } = await supabase.from('batches').select('*', { count: 'exact', head: true });
      return (count || 0) > 0;
    },
  },
  {
    id: 'upload_document',
    title: 'Upload Documents',
    description: 'Add documents to your batch for AI-powered extraction and validation.',
    icon: Upload,
    action: { label: 'Go to Queue', route: '/' },
    tips: [
      'Supported formats: PDF, PNG, JPEG, TIFF, BMP, WEBP',
      'AI will automatically extract data based on your project fields',
      'Multi-page PDFs can be split automatically if configured'
    ],
    checkComplete: async () => {
      const { count } = await supabase.from('documents').select('*', { count: 'exact', head: true });
      return (count || 0) > 0;
    },
  },
  {
    id: 'validate_document',
    title: 'Validate Results',
    description: 'Review AI extractions, make corrections, and approve documents for export.',
    icon: CheckCheck,
    action: { label: 'Open Validation', route: '/' },
    tips: [
      'Click on any field to edit extracted values',
      'Low confidence fields are highlighted for review',
      'Use keyboard shortcuts for faster validation'
    ],
    checkComplete: async () => {
      const { count } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('validation_status', 'validated');
      return (count || 0) > 0;
    },
  },
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isCheckingSteps, setIsCheckingSteps] = useState(true);

  const { data: preferences } = useQuery({
    queryKey: ['user-preferences-wizard'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_preferences')
        .select('onboarding_dismissed, onboarding_completed_steps')
        .eq('user_id', user.id)
        .single();

      if (error) return null;
      return data;
    },
  });

  // Check step completion on mount
  useEffect(() => {
    const checkSteps = async () => {
      setIsCheckingSteps(true);
      const completed: string[] = [];
      for (const step of wizardSteps) {
        try {
          const isComplete = await step.checkComplete();
          if (isComplete) completed.push(step.id);
        } catch {
          // Ignore errors
        }
      }
      setCompletedSteps(completed);
      setIsCheckingSteps(false);

      // Auto-open wizard for new users with no completed steps
      if (completed.length === 0 && !preferences?.onboarding_dismissed) {
        setOpen(true);
      }
    };

    if (preferences !== undefined) {
      checkSteps();
    }
  }, [preferences]);

  const dismissWizard = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_preferences')
        .update({ onboarding_dismissed: true })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['user-preferences-wizard'] });
    },
  });

  const progress = ((completedSteps.length) / wizardSteps.length) * 100;
  const currentStepData = wizardSteps[currentStep];
  const isCurrentStepComplete = completedSteps.includes(currentStepData?.id);
  const allComplete = completedSteps.length === wizardSteps.length;

  const goToStep = (index: number) => {
    if (index >= 0 && index < wizardSteps.length) {
      setCurrentStep(index);
    }
  };

  const handleAction = () => {
    setOpen(false);
    navigate(currentStepData.action.route);
  };

  if (isCheckingSteps || preferences?.onboarding_dismissed || allComplete) {
    return null;
  }

  return (
    <>
      {/* Floating trigger button */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-6 z-40 gap-2 shadow-lg"
        size="lg"
      >
        <Sparkles className="h-4 w-4" />
        Getting Started
        <Badge variant="secondary" className="ml-1">
          {completedSteps.length}/{wizardSteps.length}
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="p-4 sm:p-6 pb-0 pr-12">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl sm:text-2xl flex items-center gap-2">
                  <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
                  Welcome to WISDM
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Complete these steps to start processing documents
                </DialogDescription>
              </div>
              <Badge
                variant="outline"
                className="text-xs sm:text-sm flex-shrink-0 whitespace-nowrap sm:self-start max-w-full sm:max-w-[45%] truncate"
              >
                {completedSteps.length} of {wizardSteps.length} complete
              </Badge>
            </div>
            <Progress value={progress} className="mt-4 h-2" />
          </DialogHeader>

          <div className="flex flex-col sm:flex-row h-[60vh] sm:h-[450px]">
            {/* Step sidebar */}
            <div className="w-full sm:w-56 border-b sm:border-b-0 sm:border-r bg-muted/30 p-3 sm:p-4 overflow-x-auto sm:overflow-y-auto flex sm:block gap-2">
              <div className="flex sm:flex-col sm:space-y-2 gap-2 sm:gap-0 min-w-max sm:min-w-0">
                {wizardSteps.map((step, index) => {
                  const isComplete = completedSteps.includes(step.id);
                  const isCurrent = index === currentStep;
                  const Icon = step.icon;

                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(index)}
                      className={cn(
                        "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg text-left transition-all flex-shrink-0 sm:flex-shrink sm:w-full",
                        isCurrent && "bg-primary/10 border border-primary/20",
                        !isCurrent && "hover:bg-muted"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center",
                        isComplete && "bg-green-100 text-green-600",
                        !isComplete && isCurrent && "bg-primary/20 text-primary",
                        !isComplete && !isCurrent && "bg-muted text-muted-foreground"
                      )}>
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        )}
                      </div>
                      <div className="hidden sm:block flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          isComplete && "text-green-600",
                          isCurrent && !isComplete && "text-primary"
                        )}>
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Step {index + 1}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col overflow-y-auto overflow-x-hidden">
              {currentStepData && (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center",
                        isCurrentStepComplete ? "bg-green-100" : "bg-primary/10"
                      )}>
                        <currentStepData.icon className={cn(
                          "h-6 w-6",
                          isCurrentStepComplete ? "text-green-600" : "text-primary"
                        )} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold truncate">{currentStepData.title}</h3>
                        {isCurrentStepComplete && (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            Completed
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-6">
                      {currentStepData.description}
                    </p>

                    <Card className="bg-muted/30 border-dashed">
                      <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                          Pro Tips
                        </h4>
                        <ul className="space-y-2">
                          {currentStepData.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Circle className="h-1.5 w-1.5 mt-2 flex-shrink-0 fill-current" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 sm:pt-6 border-t mt-6">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => goToStep(currentStep - 1)}
                        disabled={currentStep === 0}
                        className="whitespace-nowrap"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => goToStep(currentStep + 1)}
                        disabled={currentStep === wizardSteps.length - 1}
                        className="whitespace-nowrap"
                      >
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" onClick={() => dismissWizard.mutate()} className="whitespace-nowrap">
                        Skip Setup
                      </Button>
                      <Button onClick={handleAction} className="whitespace-nowrap">
                        {currentStepData.action.label}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
