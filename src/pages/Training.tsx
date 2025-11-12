import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  ScanLine, 
  FileCheck, 
  Database, 
  Download, 
  Settings, 
  PlayCircle,
  ChevronLeft,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Training() {
  const navigate = useNavigate();
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("overview");

  const modules = [
    {
      id: "overview",
      title: "Getting Started",
      icon: BookOpen,
      duration: "5 min",
      description: "Learn the basics of WISDM Capture Pro and your first workflow",
      sections: [
        {
          title: "What is WISDM Capture Pro?",
          content: "WISDM Capture Pro is an enterprise-grade document processing platform that helps you digitize, validate, and export documents efficiently. It combines AI-powered OCR, intelligent validation, and seamless integration with your existing systems."
        },
        {
          title: "Core Workflow",
          content: "Every document follows this path: Scan → Validate → Export. Documents are organized into Projects and Batches for better organization and tracking."
        },
        {
          title: "User Interface Overview",
          content: "The main navigation provides access to: Queue (active work), Batches (document management), Admin (configuration), and Help resources."
        }
      ]
    },
    {
      id: "scanning",
      title: "Document Scanning",
      icon: ScanLine,
      duration: "8 min",
      description: "Master document capture from scanners, files, and mobile devices",
      sections: [
        {
          title: "Physical Scanner Integration",
          content: "WISDM supports direct integration with physical scanners. Configure your scanner in Admin → Scanner Auto-Import Config. The system monitors scanner folders and automatically imports new scans into designated projects."
        },
        {
          title: "File Upload",
          content: "Upload documents manually by clicking 'Scan/Upload' in any batch. Supported formats include PDF, TIFF, JPEG, PNG. Multi-page PDFs are automatically separated based on your configuration."
        },
        {
          title: "Batch Creation",
          content: "Documents are grouped into batches. Create a new batch from Batches → New Batch. Select your project, add a description, and start uploading documents. Each batch tracks its own status and validation progress."
        },
        {
          title: "Document Separation",
          content: "Configure automatic document separation using barcodes, blank pages, or page count. Set this up in Admin → Document Separation Config to automatically split multi-page scans."
        }
      ]
    },
    {
      id: "validation",
      title: "Validation Workflows",
      icon: FileCheck,
      duration: "12 min",
      description: "Learn to validate documents efficiently and accurately",
      sections: [
        {
          title: "Validation Queue",
          content: "Access your validation queue from the main Queue page. Documents awaiting validation appear in the 'Scan' section. Click any document to open the validation screen."
        },
        {
          title: "OCR and Data Extraction",
          content: "WISDM automatically extracts text using AI-powered OCR. Custom fields can be defined per project to extract specific data points (dates, amounts, names, etc.). Review and correct extracted values in the validation screen."
        },
        {
          title: "Validation Screen Features",
          content: "The validation screen shows the document preview on the left and extracted fields on the right. Use keyboard shortcuts (↑↓ for navigation, Enter to save) for faster validation. Click any field to edit its value."
        },
        {
          title: "Batch Validation",
          content: "Validate multiple documents at once using Batch Validation. This view shows all documents in a batch side-by-side, allowing you to quickly review and correct data across multiple files."
        },
        {
          title: "Field Change History",
          content: "Every field change is tracked. View the change history by clicking the clock icon next to any field. This audit trail shows who changed what and when."
        }
      ]
    },
    {
      id: "excel-lookup",
      title: "Excel Validation Lookup",
      icon: Database,
      duration: "10 min",
      description: "Validate documents against Excel spreadsheets (perfect for microfilm projects)",
      sections: [
        {
          title: "What is Excel Lookup?",
          content: "Excel Lookup allows you to validate extracted document data against a reference Excel spreadsheet. This is ideal for microfilm projects where you have a master list of documents with known metadata."
        },
        {
          title: "Upload Reference Excel",
          content: "Navigate to Admin → Validation Lookup Config. Select 'Excel Spreadsheet' as your system type. Upload your Excel file (.xlsx or .xls). The system will automatically parse column headers."
        },
        {
          title: "Configure Key Column",
          content: "Select which Excel column contains your lookup key (e.g., 'File Name'). This column will be matched against your WISDM extracted field to find the correct record."
        },
        {
          title: "Map Fields",
          content: "Map your WISDM extraction fields to Excel columns. For example, map 'Grantor' to the 'Grantor(s)' column, 'Grantee' to 'Grantee(s)', etc. This tells WISDM which fields to validate."
        },
        {
          title: "Using Lookup During Validation",
          content: "When validating a document, the system will automatically look up the key value in your Excel file. If found, it displays the Excel values alongside your extracted values for comparison. Mismatches are highlighted for quick review."
        },
        {
          title: "Fuzzy Matching",
          content: "The lookup uses fuzzy matching, so partial matches will be found. This helps when OCR isn't perfect or file names have slight variations."
        }
      ]
    },
    {
      id: "export",
      title: "Export & Integration",
      icon: Download,
      duration: "10 min",
      description: "Export validated documents to various formats and systems",
      sections: [
        {
          title: "Export Formats",
          content: "WISDM supports multiple export formats: CSV (metadata only), JSON (full data), XML (structured data), PDF (documents + metadata), and native image formats (TIFF, JPEG, PNG)."
        },
        {
          title: "ECM Integration",
          content: "Connect to enterprise content management systems directly. Supported systems include SharePoint, FileNet Documentum, FileBound, and generic DocMgt systems. Configure in Admin → ECM Export Config."
        },
        {
          title: "Batch Export",
          content: "Export entire batches at once. From the Batches page, select a batch and click Export. Choose your format and destination. The system generates a ZIP file with all documents and metadata."
        },
        {
          title: "Scheduled Exports",
          content: "Set up automatic exports to run on a schedule. Configure in Admin → Scheduled Export Config. The system will export completed batches automatically to your designated location."
        },
        {
          title: "Export Metadata",
          content: "All exports include rich metadata: document type, extraction fields, validation status, timestamps, and user information. Customize which fields are included in the export."
        }
      ]
    },
    {
      id: "admin",
      title: "Administration",
      icon: Settings,
      duration: "15 min",
      description: "Configure projects, users, and system settings",
      sections: [
        {
          title: "Project Management",
          content: "Projects organize related documents. Create projects in Admin → Projects. Each project can have custom fields, validation rules, and export configurations."
        },
        {
          title: "User & Role Management",
          content: "Manage users in Admin → Users. Assign roles: Admin (full access), Manager (batch management), Validator (validation only), or Viewer (read-only). Roles control what features users can access."
        },
        {
          title: "Custom Fields",
          content: "Define custom extraction fields per project. Go to Admin → Projects → Edit Project → Custom Fields. Add fields like 'Invoice Number', 'Date Recorded', 'Grantor', etc. These fields appear in the validation screen."
        },
        {
          title: "Batch Templates",
          content: "Save common batch configurations as templates. Create in Admin → Batch Templates. Templates include project selection, custom field defaults, and validation settings for quick batch creation."
        },
        {
          title: "Audit Trail",
          content: "Every action is logged. View the audit trail in Admin → Audit Trail. Search by user, action type, or date range to track all system activity."
        },
        {
          title: "License Management",
          content: "Monitor your license usage in Admin → Licenses. View document processing limits, user counts, and feature availability. Upgrade licenses as needed for your organization."
        }
      ]
    }
  ];

  const toggleModuleComplete = (moduleId: string) => {
    setCompletedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const startModule = (moduleId: string) => {
    // Switch to the module's tab
    setActiveTab(moduleId);
    
    // Scroll to the detailed content section
    setTimeout(() => {
      const detailedContent = document.getElementById('training-content');
      if (detailedContent) {
        detailedContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/help")}
            className="mb-4"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                WISDM Training Center
              </h1>
              <p className="text-muted-foreground mt-2">
                Master document processing with comprehensive step-by-step guides
              </p>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <Badge variant="secondary">
              {completedModules.size} of {modules.length} modules completed
            </Badge>
            <Badge variant="outline">
              ~{modules.reduce((acc, m) => acc + parseInt(m.duration), 0)} min total
            </Badge>
          </div>
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {modules.map((module) => {
            const Icon = module.icon;
            const isCompleted = completedModules.has(module.id);
            
            return (
              <Card 
                key={module.id} 
                className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                  isCompleted ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg ${isCompleted ? 'bg-primary/20' : 'bg-muted'}`}>
                      <Icon className={`h-6 w-6 ${isCompleted ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    {isCompleted && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <CardTitle className="text-xl">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{module.duration}</Badge>
                    <Button
                      variant={isCompleted ? "outline" : "default"}
                      size="sm"
                      onClick={() => startModule(module.id)}
                    >
                      {isCompleted ? 'Review' : 'Start'}
                      <PlayCircle className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detailed Content */}
        <Card id="training-content">
          <CardHeader>
            <CardTitle>Training Modules</CardTitle>
            <CardDescription>
              Click on any section below to view detailed training content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 lg:grid-cols-6 gap-2 h-auto p-1">
                {modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <TabsTrigger 
                      key={module.id} 
                      value={module.id}
                      className="flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden lg:inline">{module.title}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {modules.map((module) => (
                <TabsContent key={module.id} value={module.id} className="space-y-6 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-semibold">{module.title}</h3>
                      <p className="text-muted-foreground mt-1">{module.description}</p>
                    </div>
                    <Button
                      variant={completedModules.has(module.id) ? "outline" : "default"}
                      onClick={() => toggleModuleComplete(module.id)}
                    >
                      {completedModules.has(module.id) ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Completed
                        </>
                      ) : (
                        'Mark Complete'
                      )}
                    </Button>
                  </div>

                  {module.sections.map((section, idx) => (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                            {idx + 1}
                          </div>
                          {section.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground leading-relaxed">
                          {section.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Tips */}
        <Card className="mt-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Quick Tips for Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>Use keyboard shortcuts (↑↓ arrows, Enter) during validation for 10x faster processing</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>Set up batch templates for recurring document types to save configuration time</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>Enable auto-export for completed batches to streamline your workflow</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>Review the audit trail regularly to track team performance and identify bottlenecks</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
