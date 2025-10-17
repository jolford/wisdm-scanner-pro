import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ScheduledExport {
  id?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time_of_day: string;
  day_of_week?: number;
  day_of_month?: number;
  is_active: boolean;
  export_types: string[];
}

interface ScheduledExportConfigProps {
  projectId: string;
  availableExportTypes: string[];
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const ScheduledExportConfig = ({ projectId, availableExportTypes }: ScheduledExportConfigProps) => {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduledExport[]>([]);
  const [loading, setLoading] = useState(false);

  // Load existing schedules
  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_exports')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;

      if (data) {
        setSchedules(data.map(s => ({
          id: s.id,
          frequency: s.frequency as 'daily' | 'weekly' | 'monthly',
          time_of_day: s.time_of_day,
          day_of_week: s.day_of_week || undefined,
          day_of_month: s.day_of_month || undefined,
          is_active: s.is_active,
          export_types: s.export_types as string[],
        })));
      }
    } catch (error: any) {
      console.error('Error loading schedules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scheduled exports',
        variant: 'destructive',
      });
    }
  };

  // Load schedules on mount
  useEffect(() => {
    if (projectId) {
      loadSchedules();
    }
  }, [projectId]);

  const addSchedule = () => {
    setSchedules([
      ...schedules,
      {
        frequency: 'daily',
        time_of_day: '09:00',
        is_active: true,
        export_types: availableExportTypes,
      },
    ]);
  };

  const removeSchedule = async (index: number) => {
    const schedule = schedules[index];
    if (schedule.id) {
      try {
        const { error } = await supabase
          .from('scheduled_exports')
          .delete()
          .eq('id', schedule.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Scheduled export deleted',
        });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'Failed to delete schedule',
          variant: 'destructive',
        });
        return;
      }
    }

    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const updateSchedule = (index: number, updates: Partial<ScheduledExport>) => {
    setSchedules(schedules.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const saveSchedules = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      for (const schedule of schedules) {
        const scheduleData = {
          project_id: projectId,
          frequency: schedule.frequency,
          time_of_day: schedule.time_of_day,
          day_of_week: schedule.day_of_week || null,
          day_of_month: schedule.day_of_month || null,
          is_active: schedule.is_active,
          export_types: schedule.export_types,
          created_by: user.id,
        };

        if (schedule.id) {
          // Update existing
          const { error } = await supabase
            .from('scheduled_exports')
            .update(scheduleData)
            .eq('id', schedule.id);

          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from('scheduled_exports')
            .insert(scheduleData);

          if (error) throw error;
        }
      }

      toast({
        title: 'Success',
        description: 'Scheduled exports saved successfully',
      });

      await loadSchedules();
    } catch (error: any) {
      console.error('Error saving schedules:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save scheduled exports',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Scheduled Exports</h3>
        <Button type="button" onClick={addSchedule} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {schedules.map((schedule, index) => (
        <Card key={index} className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={schedule.is_active}
                  onCheckedChange={(checked) => updateSchedule(index, { is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSchedule(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency</Label>
                <Select
                  value={schedule.frequency}
                  onValueChange={(value) =>
                    updateSchedule(index, { frequency: value as 'daily' | 'weekly' | 'monthly' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={schedule.time_of_day}
                  onChange={(e) => updateSchedule(index, { time_of_day: e.target.value })}
                />
              </div>

              {schedule.frequency === 'weekly' && (
                <div>
                  <Label>Day of Week</Label>
                  <Select
                    value={schedule.day_of_week?.toString()}
                    onValueChange={(value) =>
                      updateSchedule(index, { day_of_week: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {schedule.frequency === 'monthly' && (
                <div>
                  <Label>Day of Month</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={schedule.day_of_month || ''}
                    onChange={(e) =>
                      updateSchedule(index, { day_of_month: parseInt(e.target.value) })
                    }
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Export Types</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availableExportTypes.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      checked={schedule.export_types.includes(type)}
                      onCheckedChange={(checked) => {
                        const newTypes = checked
                          ? [...schedule.export_types, type]
                          : schedule.export_types.filter((t) => t !== type);
                        updateSchedule(index, { export_types: newTypes });
                      }}
                    />
                    <Label className="capitalize">{type}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}

      {schedules.length > 0 && (
        <Button type="button" onClick={saveSchedules} disabled={loading}>
          {loading ? 'Saving...' : 'Save Schedules'}
        </Button>
      )}
    </div>
  );
};
