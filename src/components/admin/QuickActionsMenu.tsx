import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FolderPlus, Upload, FileText, BarChart2, 
  Settings, Users, Zap, RefreshCw 
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface QuickAction {
  icon: any;
  label: string;
  description: string;
  action: () => void;
  color: string;
}

export const QuickActionsMenu = () => {
  const navigate = useNavigate();
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);

  const quickActions: QuickAction[] = [
    {
      icon: FolderPlus,
      label: 'New Batch',
      description: 'Create a new document batch',
      action: () => navigate('/admin/batches/new'),
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
    },
    {
      icon: Upload,
      label: 'Upload Documents',
      description: 'Add documents to existing batch',
      action: () => navigate('/admin/documents'),
      color: 'text-green-600 bg-green-50 hover:bg-green-100',
    },
    {
      icon: FileText,
      label: 'Validation Queue',
      description: 'Review pending documents',
      action: () => navigate('/queue'),
      color: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
    },
    {
      icon: BarChart2,
      label: 'View Analytics',
      description: 'Check processing metrics',
      action: () => navigate('/admin/analytics'),
      color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
    },
    {
      icon: Users,
      label: 'Manage Users',
      description: 'Add or edit user accounts',
      action: () => navigate('/admin/users'),
      color: 'text-pink-600 bg-pink-50 hover:bg-pink-100',
    },
    {
      icon: Zap,
      label: 'Batch Templates',
      description: 'Configure auto-rules',
      action: () => navigate('/admin/batch-templates'),
      color: 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100',
    },
    {
      icon: RefreshCw,
      label: 'Reprocess Docs',
      description: 'Re-run OCR extraction',
      action: () => navigate('/admin/document-reprocessing'),
      color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100',
    },
    {
      icon: Settings,
      label: 'System Settings',
      description: 'Configure application',
      action: () => navigate('/admin/system-viability'),
      color: 'text-gray-600 bg-gray-50 hover:bg-gray-100',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
        <CardDescription>Common tasks at your fingertips</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className={`h-auto flex-col items-center gap-2 py-4 ${action.color} border-2 hover:scale-105 transition-transform`}
              onClick={action.action}
            >
              <action.icon className="h-6 w-6" />
              <span className="text-xs font-medium text-center">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
