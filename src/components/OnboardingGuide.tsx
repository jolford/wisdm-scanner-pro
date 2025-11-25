import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, ArrowRight, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action: {
    label: string;
    route: string;
  };
  checkComplete: () => Promise<boolean>;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'create_customer',
    title: 'Create Your First Customer',
    description: 'Set up a customer organization to organize your projects and users',
    action: { label: 'Create Customer', route: '/admin/customers/new' },
    checkComplete: async () => {
      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });
      return (count || 0) > 0;
    },
  },
  {
    id: 'create_project',
    title: 'Set Up Your First Project',
    description: 'Configure a document processing project with extraction fields',
    action: { label: 'Create Project', route: '/admin/projects/new' },
    checkComplete: async () => {
      const { count } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });
      return (count || 0) > 0;
    },
  },
  {
    id: 'create_batch',
    title: 'Create Your First Batch',
    description: 'Start processing documents by creating a batch',
    action: { label: 'Create Batch', route: '/admin/batches/new' },
    checkComplete: async () => {
      const { count } = await supabase
        .from('batches')
        .select('*', { count: 'exact', head: true });
      return (count || 0) > 0;
    },
  },
  {
    id: 'upload_document',
    title: 'Upload Your First Document',
    description: 'Add a document to process and validate',
    action: { label: 'Upload Documents', route: '/admin/documents' },
    checkComplete: async () => {
      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
      return (count || 0) > 0;
    },
  },
  {
    id: 'validate_document',
    title: 'Validate a Document',
    description: 'Review and validate extracted data from your document',
    action: { label: 'Go to Queue', route: '/queue' },
    checkComplete: async () => {
      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('validation_status', 'validated');
      return (count || 0) > 0;
    },
  },
];

export const OnboardingGuide = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDismissed, setIsDismissed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const { data: preferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('onboarding_dismissed, onboarding_completed_steps')
        .single();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (preferences) {
      setIsDismissed(preferences.onboarding_dismissed || false);
      setCompletedSteps(preferences.onboarding_completed_steps || []);
    }
  }, [preferences]);

  useEffect(() => {
    // Check which steps are complete
    const checkSteps = async () => {
      const completed: string[] = [];
      for (const step of onboardingSteps) {
        const isComplete = await step.checkComplete();
        if (isComplete) {
          completed.push(step.id);
        }
      }
      setCompletedSteps(completed);
    };

    if (!isDismissed) {
      checkSteps();
    }
  }, [isDismissed]);

  const dismissOnboarding = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_preferences')
        .update({ onboarding_dismissed: true })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      setIsDismissed(true);
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });

  if (isDismissed || completedSteps.length === onboardingSteps.length) {
    return null;
  }

  const progress = (completedSteps.length / onboardingSteps.length) * 100;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              Getting Started Guide
              <span className="text-sm font-normal text-muted-foreground">
                {completedSteps.length} of {onboardingSteps.length} complete
              </span>
            </CardTitle>
            <CardDescription>
              Follow these steps to set up your document processing workflow
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => dismissOnboarding.mutate()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="mt-4" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {onboardingSteps.map((step, index) => {
            const isComplete = completedSteps.includes(step.id);
            return (
              <div
                key={step.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-background transition-colors"
              >
                {isComplete ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h4 className={`font-medium ${isComplete ? 'line-through text-muted-foreground' : ''}`}>
                    {index + 1}. {step.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {!isComplete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => navigate(step.action.route)}
                  >
                    {step.action.label}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
