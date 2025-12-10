import { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Video,
  Monitor,
  Sparkles,
  FileText,
  Zap,
  Shield,
  BarChart3,
  Share2,
  CheckCircle,
  Clock,
  TrendingUp,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface PresentationSlide {
  id: string;
  title: string;
  subtitle: string;
  content: React.ReactNode;
  route?: string;
  duration: number; // seconds
  animation: 'fade' | 'slide-up' | 'zoom';
}

const presentationSlides: PresentationSlide[] = [
  {
    id: 'intro',
    title: 'WISDM Capture Pro',
    subtitle: 'Enterprise Document Intelligence Platform',
    duration: 8,
    animation: 'zoom',
    content: (
      <div className="flex flex-col items-center justify-center gap-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-violet-500/30 to-purple-500/30 rounded-full" />
          <h1 className="relative text-7xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            WISDM Capture
          </h1>
        </div>
        <p className="text-2xl text-muted-foreground max-w-2xl">
          Transform your document workflows with AI-powered capture, extraction, and automation
        </p>
        <div className="flex gap-4 mt-4">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Shield className="w-4 h-4 mr-2" /> SOC 2 Ready
          </Badge>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Sparkles className="w-4 h-4 mr-2" /> AI-Powered
          </Badge>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Zap className="w-4 h-4 mr-2" /> Real-Time
          </Badge>
        </div>
      </div>
    )
  },
  {
    id: 'problem',
    title: 'The Challenge',
    subtitle: 'Manual document processing is costly and error-prone',
    duration: 10,
    animation: 'slide-up',
    content: (
      <div className="grid grid-cols-3 gap-8">
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-8 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-3xl font-bold text-destructive">85%</h3>
            <p className="text-lg text-muted-foreground mt-2">Time spent on manual data entry</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-8 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-orange-500" />
            <h3 className="text-3xl font-bold text-orange-500">4.2%</h3>
            <p className="text-lg text-muted-foreground mt-2">Average manual entry error rate</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-8 text-center">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-3xl font-bold text-yellow-500">$12+</h3>
            <p className="text-lg text-muted-foreground mt-2">Cost per manually processed document</p>
          </CardContent>
        </Card>
      </div>
    )
  },
  {
    id: 'solution',
    title: 'The Solution',
    subtitle: 'Intelligent automation from capture to export',
    duration: 12,
    animation: 'slide-up',
    content: (
      <div className="flex items-center justify-center gap-6">
        {[
          { icon: FileText, label: 'Capture', desc: 'Multi-channel input' },
          { icon: Sparkles, label: 'Extract', desc: 'AI-powered OCR' },
          { icon: CheckCircle, label: 'Validate', desc: 'Smart verification' },
          { icon: Share2, label: 'Export', desc: 'Seamless integration' }
        ].map((step, i) => (
          <div key={step.label} className="flex items-center">
            <Card className="p-6 text-center hover:scale-105 transition-transform bg-gradient-to-br from-background to-muted/50">
              <CardContent className="p-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold">{step.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">{step.desc}</p>
              </CardContent>
            </Card>
            {i < 3 && (
              <div className="w-12 h-0.5 bg-gradient-to-r from-violet-500 to-purple-600 mx-2" />
            )}
          </div>
        ))}
      </div>
    )
  },
  {
    id: 'ai-features',
    title: 'AI-Powered Intelligence',
    subtitle: 'Powered by Google Gemini & GPT-5',
    duration: 12,
    animation: 'fade',
    content: (
      <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto">
        {[
          { title: '96%+ Accuracy', desc: 'Field extraction confidence with continuous learning', icon: BarChart3 },
          { title: 'PII Detection', desc: 'Automatic sensitive data identification and redaction', icon: Shield },
          { title: 'Smart Routing', desc: 'Confidence-based document workflow automation', icon: Zap },
          { title: 'Logo Recognition', desc: 'Vendor identification through visual analysis', icon: Sparkles }
        ].map((feature) => (
          <Card key={feature.title} className="p-6 hover:border-primary/50 transition-colors">
            <CardContent className="p-0 flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-1">{feature.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  },
  {
    id: 'metrics',
    title: 'Real Results',
    subtitle: 'Proven ROI across enterprise deployments',
    duration: 10,
    animation: 'slide-up',
    content: (
      <div className="grid grid-cols-4 gap-8">
        {[
          { value: '87%', label: 'Automation Rate', color: 'from-green-500 to-emerald-600' },
          { value: '< 3s', label: 'Processing Time', color: 'from-blue-500 to-cyan-600' },
          { value: '$12K+', label: 'Monthly Savings', color: 'from-violet-500 to-purple-600' },
          { value: '342hrs', label: 'Time Saved', color: 'from-orange-500 to-amber-600' }
        ].map((metric) => (
          <Card key={metric.label} className="text-center overflow-hidden">
            <CardContent className="p-8 relative">
              <div className={cn(
                "absolute inset-0 opacity-10 bg-gradient-to-br",
                metric.color
              )} />
              <h3 className={cn(
                "text-5xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                metric.color
              )}>
                {metric.value}
              </h3>
              <p className="text-lg text-muted-foreground mt-2">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  },
  {
    id: 'integrations',
    title: 'Seamless Integrations',
    subtitle: '40+ pre-built connectors for your existing systems',
    duration: 8,
    animation: 'fade',
    content: (
      <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
        {[
          'SharePoint', 'Microsoft Teams', 'QuickBooks', 'Salesforce',
          'FileBound', 'Documentum', 'Resware', 'DocMGT',
          'n8n', 'Power Automate', 'Zapier', 'Custom API'
        ].map((integration) => (
          <Badge
            key={integration}
            variant="secondary"
            className="text-lg px-6 py-3 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
          >
            {integration}
          </Badge>
        ))}
      </div>
    )
  },
  {
    id: 'demo-cta',
    title: 'See It In Action',
    subtitle: "Let's explore the live platform",
    duration: 6,
    animation: 'zoom',
    route: '/admin',
    content: (
      <div className="flex flex-col items-center gap-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
          <Monitor className="w-12 h-12 text-white" />
        </div>
        <p className="text-2xl text-muted-foreground">
          Redirecting to live dashboard...
        </p>
      </div>
    )
  }
];

export function PresentationMode() {
  const [isActive, setIsActive] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const slide = presentationSlides[currentSlide];
  const totalSlides = presentationSlides.length;

  // Auto-advance slides
  useEffect(() => {
    if (!isActive || !isPlaying) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const increment = 100 / (slide.duration * 10);
        if (prev >= 100) {
          if (currentSlide < totalSlides - 1) {
            setCurrentSlide((s) => s + 1);
            if (slide.route) {
              navigate(slide.route);
            }
            return 0;
          } else {
            setIsPlaying(false);
            return 100;
          }
        }
        return prev + increment;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, isPlaying, currentSlide, slide, totalSlides, navigate]);

  const nextSlide = useCallback(() => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide((s) => s + 1);
      setProgress(0);
    }
  }, [currentSlide, totalSlides]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide((s) => s - 1);
      setProgress(0);
    }
  }, [currentSlide]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          nextSlide();
          break;
        case 'ArrowLeft':
          prevSlide();
          break;
        case 'Escape':
          setIsActive(false);
          break;
        case 'p':
          setIsPlaying((p) => !p);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, nextSlide, prevSlide]);

  if (!isActive) {
    return (
      <Button
        onClick={() => setIsActive(true)}
        className="fixed bottom-4 right-4 z-50 gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg"
      >
        <Video className="w-4 h-4" />
        Start Presentation
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-background">
      {/* Slide content */}
      <div 
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center p-16 transition-all duration-500",
          slide.animation === 'fade' && 'animate-in fade-in',
          slide.animation === 'slide-up' && 'animate-in slide-in-from-bottom-8',
          slide.animation === 'zoom' && 'animate-in zoom-in-95'
        )}
        key={slide.id}
      >
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">{slide.title}</h1>
          <p className="text-xl text-muted-foreground">{slide.subtitle}</p>
        </div>
        
        <div className="flex-1 flex items-center justify-center w-full max-w-6xl">
          {slide.content}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent">
        <div className="max-w-4xl mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-4">
            {presentationSlides.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 h-1 rounded-full transition-colors cursor-pointer",
                  i < currentSlide ? 'bg-primary' : i === currentSlide ? 'bg-primary/50' : 'bg-muted'
                )}
                onClick={() => {
                  setCurrentSlide(i);
                  setProgress(0);
                }}
              >
                {i === currentSlide && (
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={prevSlide} disabled={currentSlide === 0}>
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={nextSlide} disabled={currentSlide === totalSlides - 1}>
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            <span className="text-sm text-muted-foreground">
              {currentSlide + 1} / {totalSlides} • Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Space</kbd> to advance
            </span>

            <Button variant="ghost" size="icon" onClick={() => setIsActive(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
