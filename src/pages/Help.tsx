import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  BookOpen, 
  HelpCircle, 
  Wrench, 
  Mail, 
  ArrowLeft,
  Upload,
  Eye,
  CheckCircle,
  Download,
  ScanLine,
  FolderOpen,
  Settings,
  AlertCircle,
  FileText,
  Database,
  Cloud,
  Shield,
  Bot
} from 'lucide-react';
import wisdmLogo from '@/assets/wisdm-logo.png';
import { AIAssistant } from '@/components/AIAssistant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Help = () => {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('guides');
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: user?.email || '',
    subject: '',
    message: ''
  });
  const [isSending, setIsSending] = useState(false);

  const handleContactSupport = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('contact-support', {
        body: {
          ...contactForm,
          userAgent: navigator.userAgent
        }
      });

      if (error) throw error;

      toast.success('Support request sent successfully! We\'ll get back to you soon.');
      setContactDialogOpen(false);
      setContactForm({
        name: '',
        email: user?.email || '',
        subject: '',
        message: ''
      });
    } catch (error: any) {
      console.error('Error sending support request:', error);
      toast.error('Failed to send support request. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const guides = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: BookOpen,
      description: 'Learn the basics of document processing',
      steps: [
        { title: 'Select a Project', description: 'Choose from available projects or create a new one (Admin only)', icon: FolderOpen },
        { title: 'Create or Select a Batch', description: 'Group your documents into batches for organized processing', icon: FileText },
        { title: 'Scan Documents', description: 'Upload files or use a physical scanner to add documents', icon: ScanLine },
        { title: 'Validate Extracted Data', description: 'Review and correct the automatically extracted information', icon: Eye },
        { title: 'Export Results', description: 'Send validated documents to Filebound, Docmgt, or download as PDF', icon: Download },
      ]
    },
    {
      id: 'scanning',
      title: 'Document Scanning',
      icon: Upload,
      description: 'How to scan and upload documents',
      steps: [
        { title: 'Upload Method', description: 'Drag & drop files or click to browse. Supports PDF, JPG, PNG formats', icon: Upload },
        { title: 'Physical Scanner', description: 'Use TWAIN-compatible scanners for direct document capture', icon: ScanLine },
        { title: 'Batch Processing', description: 'Multiple documents can be added to the same batch for bulk processing', icon: FileText },
        { title: 'OCR Extraction', description: 'Text and metadata are automatically extracted using AI-powered OCR', icon: Database },
      ]
    },
    {
      id: 'validation',
      title: 'Document Validation',
      icon: Eye,
      description: 'Review and correct extracted data with advanced tools',
      steps: [
        { title: 'Review Queue', description: 'Access the Validation tab to see pending documents with real-time progress tracking', icon: Eye },
        { title: 'Use Bulk Operations', description: 'Select multiple documents (Shift+Click or Ctrl+Click) to validate, reject, or delete in bulk', icon: CheckCircle },
        { title: 'Search & Filter', description: 'Use the search bar and filters to find documents by type, confidence score, or issues', icon: Search },
        { title: 'Smart Suggestions', description: 'Get AI-powered field suggestions based on historical data and vendor patterns', icon: Bot },
        { title: 'Keyboard Shortcuts', description: 'Press ? to view keyboard shortcuts for faster navigation and validation', icon: Settings },
        { title: 'Check Extracted Data', description: 'Review text and metadata fields for accuracy with confidence scores', icon: CheckCircle },
        { title: 'Make Corrections', description: 'Edit fields directly or adjust extraction regions', icon: Settings },
        { title: 'Track Progress', description: 'Monitor validation metrics including accuracy, time per document, and completion percentage', icon: Database },
      ]
    },
    {
      id: 'exporting',
      title: 'Exporting Documents',
      icon: Download,
      description: 'Send validated documents to external systems',
      steps: [
        { title: 'Filebound Export', description: 'Configure Filebound credentials in project settings, then export validated batches', icon: Cloud },
        { title: 'Docmgt Export', description: 'Set up Docmgt integration to send documents to your document management system', icon: Database },
        { title: 'PDF Export', description: 'Download batch reports as PDF with all metadata included', icon: FileText },
        { title: 'Image Export', description: 'Download original scanned images in ZIP format', icon: Download },
      ]
    },
  ];

  const faqs = [
    {
      category: 'General',
      questions: [
        {
          q: 'What file formats are supported?',
          a: 'WISDM Capture Pro supports PDF, JPG, and PNG files. Multi-page PDFs are processed automatically, with each page treated as a separate document.'
        },
        {
          q: 'How does the license system work?',
          a: 'Your license includes a specific number of document processing credits. Each scanned and processed document consumes one credit. Admins can view remaining capacity in the dashboard.'
        },
        {
          q: 'Can I delete documents after uploading?',
          a: 'Yes, you can delete documents from your batches. Navigate to the Validated tab, click the delete icon on any document. Note: This does not restore license credits.'
        },
        {
          q: 'What is a batch?',
          a: 'A batch is a collection of related documents processed together. Batches help organize work and can be exported as a group to external systems.'
        },
      ]
    },
    {
      category: 'Scanning',
      questions: [
        {
          q: 'My physical scanner is not detected. What should I do?',
          a: 'Ensure your scanner is TWAIN-compatible and drivers are installed. The scanner must be connected and powered on before accessing the Physical Scanner tab. Browser security settings may also affect detection.'
        },
        {
          q: 'Why is OCR accuracy low for some documents?',
          a: 'OCR quality depends on image clarity, resolution, and text formatting. For best results: use high-resolution scans (300 DPI+), ensure good lighting, avoid skewed images, and use clear fonts.'
        },
        {
          q: 'Can I scan multiple pages at once?',
          a: 'Yes! Upload multi-page PDFs or use your physical scanner\'s automatic document feeder (ADF) if available. Each page will be processed as a separate document in your batch.'
        },
      ]
    },
    {
      category: 'Validation & Export',
      questions: [
        {
          q: 'How do I use bulk operations?',
          a: 'Select multiple documents by holding Shift (range) or Ctrl/Cmd (individual). A toolbar will appear with bulk actions: Validate All, Reject All, Delete All, Export, or Move. This saves time when processing similar documents.'
        },
        {
          q: 'What are Smart Suggestions?',
          a: 'Smart Suggestions analyze your historical validation data to predict values for empty fields. They show confidence scores and sources (Historical Data or Vendor Pattern). Click "Apply" to accept a suggestion instantly.'
        },
        {
          q: 'How do I use keyboard shortcuts?',
          a: 'Press ? (question mark) anywhere to view all keyboard shortcuts. Common ones: Arrow keys for navigation, V to validate, R to reject, E to edit, Escape to close dialogs. Shortcuts work everywhere except when typing in input fields.'
        },
        {
          q: 'What is the Progress Tracking Dashboard?',
          a: 'The dashboard shows real-time metrics: total documents, validated/pending/rejected counts, average time per document, and accuracy percentage. It updates automatically as you validate documents and shows estimated completion time.'
        },
        {
          q: 'How do I filter documents?',
          a: 'Use the Search & Filter bar to find documents by: search term (any text), document type, minimum confidence score (0-100%), or documents with issues only. Combine filters for precise results.'
        },
        {
          q: 'What if extracted data is incorrect?',
          a: 'Use the Validation screen to review and edit any extracted fields. You can modify text, adjust extraction regions, or re-extract data from selected areas of the document. Smart Suggestions can help fill missing fields.'
        },
        {
          q: 'How do I configure Filebound/Docmgt export?',
          a: 'Admins can configure export settings in Project Settings. Enter the API URL, username, password, and map WISDM fields to your ECM system fields. Test the connection before saving.'
        },
        {
          q: 'Can I export before validating all documents?',
          a: 'Export functions only include validated documents. Documents in the validation queue will not be exported. Complete validation before exporting your batch. Use bulk operations to validate multiple documents quickly.'
        },
        {
          q: 'What happens if an export fails?',
          a: 'Export errors are logged and displayed via toast notifications. Common issues include network connectivity, invalid credentials, or API endpoint problems. Check project export configuration and connection status.'
        },
      ]
    },
    {
      category: 'Admin',
      questions: [
        {
          q: 'How do I create a new project?',
          a: 'Navigate to Admin → Projects → New Project. Define extraction fields that match your document types. Each field will be automatically detected during OCR processing.'
        },
        {
          q: 'How do I manage user permissions?',
          a: 'Go to Admin → Users to view all users. You can assign roles (admin, user) and set specific permissions (scan, validate, export) for each user.'
        },
        {
          q: 'How do I assign customers to users?',
          a: 'In Admin → Customers, you can create customer accounts and assign users to them. Users will only see batches and projects associated with their assigned customers.'
        },
        {
          q: 'How are licenses managed?',
          a: 'Visit Admin → Licenses to view, create, and manage licenses. Monitor remaining document capacity, expiration dates, and usage history. Licenses can be active, expired, or exhausted.'
        },
      ]
    },
  ];

  const troubleshooting = [
    {
      issue: 'Unable to upload documents',
      icon: AlertCircle,
      solutions: [
        'Check your license capacity - you may have used all available credits',
        'Verify you have "scan" permission enabled for your account',
        'Ensure files are in supported formats (PDF, JPG, PNG)',
        'Try reducing file size if uploads are timing out',
        'Check browser console for specific error messages',
      ]
    },
    {
      issue: 'Validation screen not loading',
      icon: Eye,
      solutions: [
        'Ensure a project and batch are selected',
        'Check that documents exist in the validation queue',
        'Refresh the page to reload document data',
        'Verify you have "validate" permission',
        'Clear search filters if no documents appear',
        'Check browser console for errors',
      ]
    },
    {
      issue: 'Progress dashboard not updating',
      icon: Database,
      solutions: [
        'Dashboard updates automatically when you validate documents',
        'If metrics seem stuck, refresh the page',
        'Ensure you\'re validating documents (not just viewing)',
        'Progress calculates from all documents in the batch',
        'Check that batch contains documents to track',
      ]
    },
    {
      issue: 'Bulk operations not working',
      icon: CheckCircle,
      solutions: [
        'Select at least one document first (click checkboxes)',
        'Use Shift+Click for ranges, Ctrl/Cmd+Click for individual',
        'Bulk toolbar appears when documents are selected',
        'Some bulk actions require specific permissions',
        'Deselect all and try selecting again if toolbar is stuck',
      ]
    },
    {
      issue: 'Keyboard shortcuts not responding',
      icon: Settings,
      solutions: [
        'Shortcuts don\'t work while typing in input fields (press Escape first)',
        'Press ? to view all available shortcuts',
        'Some shortcuts require no modifier keys (just the letter)',
        'Navigation shortcuts use Shift key (e.g., Shift+Q for Queue)',
        'Reload page if shortcuts stop working completely',
      ]
    },
    {
      issue: 'Export failing to external systems',
      icon: Cloud,
      solutions: [
        'Test connection in project settings first',
        'Verify API credentials are correct and not expired',
        'Check URL format includes https:// protocol',
        'Ensure external system API is accessible from your network',
        'Review field mappings - all required fields must be mapped',
        'Private IP addresses and localhost are blocked for security',
      ]
    },
    {
      issue: 'Poor OCR accuracy',
      icon: FileText,
      solutions: [
        'Use higher resolution scans (300 DPI recommended)',
        'Ensure documents are well-lit and not blurry',
        'Avoid skewed or rotated images',
        'Try re-scanning with better quality settings',
        'Manually correct extracted data in validation screen',
      ]
    },
    {
      issue: 'Security warnings or blocked actions',
      icon: Shield,
      solutions: [
        'External API URLs must use HTTPS protocol',
        'Private IP ranges (192.168.x.x, 10.x.x.x) are blocked for security',
        'Localhost connections are not permitted',
        'Contact admin if you need to add trusted external domains',
        'Check that you have appropriate role-based permissions',
      ]
    },
  ];

  // Filter content based on search
  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.questions.length > 0);

  const filteredGuides = guides.filter(guide =>
    guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guide.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTroubleshooting = troubleshooting.filter(item =>
    item.issue.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.solutions.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img 
                src={wisdmLogo} 
                alt="WISDM Logo" 
                className="h-10 w-auto" 
              />
              <div className="h-8 w-px bg-border" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Help Center
                </h1>
                <p className="text-xs text-muted-foreground">Documentation & Support</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate('/admin')} className="gap-2">
                  <Settings className="h-4 w-4" />
                  Admin
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to App
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Search Bar */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search help articles, FAQs, and guides..."
                className="pl-10 h-12 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 h-12 bg-muted/50">
            <TabsTrigger value="guides" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BookOpen className="h-4 w-4" />
              <span className="font-medium">Guides</span>
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HelpCircle className="h-4 w-4" />
              <span className="font-medium">FAQs</span>
            </TabsTrigger>
            <TabsTrigger value="troubleshooting" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Wrench className="h-4 w-4" />
              <span className="font-medium">Troubleshooting</span>
            </TabsTrigger>
            <TabsTrigger value="ai-assistant" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bot className="h-4 w-4" />
              <span className="font-medium">AI Assistant</span>
            </TabsTrigger>
          </TabsList>

          {/* Guides Tab */}
          <TabsContent value="guides" className="space-y-6">
            {filteredGuides.length === 0 ? (
              <Card className="p-12 text-center">
                <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No guides found</h3>
                <p className="text-muted-foreground">Try adjusting your search query</p>
              </Card>
            ) : (
              filteredGuides.map((guide) => (
                <Card key={guide.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/20 rounded-lg">
                        <guide.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">{guide.title}</CardTitle>
                        <CardDescription className="text-base mt-1">{guide.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {guide.steps.map((step, idx) => (
                        <div key={idx} className="flex gap-4 items-start p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex-shrink-0">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold">
                              {idx + 1}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <step.icon className="h-4 w-4 text-primary" />
                              <h4 className="font-semibold text-base">{step.title}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            {filteredFaqs.length === 0 ? (
              <Card className="p-12 text-center">
                <HelpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No FAQs found</h3>
                <p className="text-muted-foreground">Try adjusting your search query</p>
              </Card>
            ) : (
              filteredFaqs.map((category) => (
                <Card key={category.category}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm px-3 py-1">
                        {category.category}
                      </Badge>
                      <CardTitle className="text-xl">{category.questions.length} Questions</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.questions.map((faq, idx) => (
                        <AccordionItem key={idx} value={`item-${idx}`}>
                          <AccordionTrigger className="text-left hover:no-underline">
                            <div className="flex items-start gap-2">
                              <HelpCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                              <span className="font-medium">{faq.q}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground pl-7">
                            {faq.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Troubleshooting Tab */}
          <TabsContent value="troubleshooting" className="space-y-6">
            {filteredTroubleshooting.length === 0 ? (
              <Card className="p-12 text-center">
                <Wrench className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No troubleshooting topics found</h3>
                <p className="text-muted-foreground">Try adjusting your search query</p>
              </Card>
            ) : (
              filteredTroubleshooting.map((item, idx) => (
                <Card key={idx} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="bg-gradient-to-r from-orange-500/10 to-red-500/10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-orange-500/20 rounded-lg">
                        <item.icon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      </div>
                      <CardTitle className="text-xl">{item.issue}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Possible Solutions:
                    </h4>
                    <ul className="space-y-2">
                      {item.solutions.map((solution, sIdx) => (
                        <li key={sIdx} className="flex gap-3 items-start p-3 rounded-lg bg-muted/30">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center mt-0.5">
                            {sIdx + 1}
                          </div>
                          <p className="text-sm text-muted-foreground flex-1">{solution}</p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* AI Assistant Tab */}
          <TabsContent value="ai-assistant" className="space-y-6">
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Bot className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>GPT-5 AI Assistant</CardTitle>
                    <CardDescription>
                      Get instant help with document processing, troubleshooting, and system questions
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AIAssistant 
                  useCase="troubleshooting"
                  placeholder="Ask me about scanning issues, validation problems, export configurations, or any other questions..."
                />
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-accent/5">
              <CardHeader>
                <CardTitle className="text-lg">AI Assistant Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Instant answers</strong> - Get help without waiting for support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Context-aware</strong> - Understands WISDM Capture Pro features and workflows</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Troubleshooting help</strong> - Diagnose and resolve common issues</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span><strong>Best practices</strong> - Learn tips for optimal document processing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Contact Support Card */}
        <Card className="mt-8 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-primary" />
              <CardTitle>Still Need Help?</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              If you couldn't find the answer you're looking for, please contact your system administrator
              or reach out to our support team.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                className="gap-2"
                onClick={() => setContactDialogOpen(true)}
              >
                <Mail className="h-4 w-4" />
                Contact Support
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate('/admin/error-logs')} className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  View Error Logs
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Support Dialog */}
        <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Contact Support</DialogTitle>
              <DialogDescription>
                Fill out the form below and we'll get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="your.email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  placeholder="What do you need help with?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Describe your issue or question in detail..."
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setContactDialogOpen(false)}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleContactSupport}
                disabled={isSending}
              >
                {isSending ? 'Sending...' : 'Send Message'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Help;
