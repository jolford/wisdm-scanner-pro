import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Plus, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function QuickActionsWidget() {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'New Batch',
      icon: Plus,
      onClick: () => navigate('/admin/batches/new'),
      variant: 'default' as const,
    },
    {
      label: 'Upload Documents',
      icon: Upload,
      onClick: () => navigate('/'),
      variant: 'secondary' as const,
    },
    {
      label: 'View All Batches',
      icon: FileText,
      onClick: () => navigate('/admin/batches'),
      variant: 'outline' as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              onClick={action.onClick}
              className="w-full justify-start"
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
