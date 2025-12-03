import React, { createContext, useContext, useState, useCallback } from 'react';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  currentStep: number;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  resetTour: () => void;
  isTourActive: boolean;
  startTour: () => void;
  endTour: () => void;
  demoSteps: DemoStep[];
}

const demoSteps: DemoStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WISDM Capture Pro',
    description: 'Enterprise-grade document capture and AI processing platform. Let\'s explore the key features.',
    targetSelector: '.demo-logo',
    position: 'bottom'
  },
  {
    id: 'upload',
    title: 'Multi-Channel Document Capture',
    description: 'Upload documents via drag-and-drop, physical scanner, mobile capture, email, or fax integration.',
    targetSelector: '.demo-upload',
    position: 'right'
  },
  {
    id: 'ai-processing',
    title: 'AI-Powered Processing',
    description: 'Advanced OCR with confidence scoring, PII detection, and smart field extraction using Google Gemini and GPT models.',
    targetSelector: '.demo-ai-badge',
    position: 'bottom'
  },
  {
    id: 'validation',
    title: 'Intelligent Validation',
    description: 'Side-by-side document viewer with field-level confidence thresholds and automatic formatting.',
    targetSelector: '.demo-validation',
    position: 'left'
  },
  {
    id: 'workflows',
    title: 'Visual Workflow Builder',
    description: 'Create automated processing rules with our drag-and-drop workflow designer.',
    targetSelector: '.demo-workflows',
    position: 'bottom'
  },
  {
    id: 'integrations',
    title: 'Integration Marketplace',
    description: 'Connect with SharePoint, Teams, QuickBooks, Salesforce, FileBound, and more.',
    targetSelector: '.demo-integrations',
    position: 'bottom'
  },
  {
    id: 'analytics',
    title: 'Real-Time Analytics',
    description: 'Monitor processing metrics, confidence trends, and ROI with comprehensive dashboards.',
    targetSelector: '.demo-analytics',
    position: 'left'
  },
  {
    id: 'security',
    title: 'Enterprise Security',
    description: 'SOC 2 ready with AES-256 encryption, RLS policies, audit trails, and HIPAA compliance features.',
    targetSelector: '.demo-security',
    position: 'bottom'
  }
];

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode(prev => !prev);
    if (!isDemoMode) {
      setCurrentStep(0);
    }
  }, [isDemoMode]);

  const nextStep = useCallback(() => {
    if (currentStep < demoSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsTourActive(false);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < demoSteps.length) {
      setCurrentStep(step);
    }
  }, []);

  const resetTour = useCallback(() => {
    setCurrentStep(0);
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsTourActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsTourActive(false);
  }, []);

  return (
    <DemoModeContext.Provider value={{
      isDemoMode,
      toggleDemoMode,
      currentStep,
      totalSteps: demoSteps.length,
      nextStep,
      prevStep,
      goToStep,
      resetTour,
      isTourActive,
      startTour,
      endTour,
      demoSteps
    }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoModeProvider');
  }
  return context;
}
