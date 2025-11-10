import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DEFAULT_WIDGETS, WIDGET_REGISTRY } from '@/components/dashboard/WidgetRegistry';

interface DashboardWidget {
  id: string;
  widget_type: string;
  position: number;
  config: Record<string, any>;
  is_visible: boolean;
}

export function useDashboardWidgets() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const { data: widgets = [], isLoading } = useQuery({
    queryKey: ['dashboard-widgets', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('user_dashboard_widgets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_visible', true)
        .order('position');

      if (error) throw error;

      // If no widgets exist, initialize with defaults
      if (!data || data.length === 0) {
        const defaultWidgets = DEFAULT_WIDGETS.map((w) => ({
          user_id: userId,
          widget_type: w.type,
          position: w.position,
          config: WIDGET_REGISTRY[w.type]?.defaultConfig || {},
          is_visible: true,
        }));

        const { data: created, error: createError } = await supabase
          .from('user_dashboard_widgets')
          .insert(defaultWidgets)
          .select();

        if (createError) throw createError;
        return created as DashboardWidget[];
      }

      return data as DashboardWidget[];
    },
    enabled: !!userId,
  });

  const addWidgetMutation = useMutation({
    mutationFn: async (widgetType: string) => {
      if (!userId) throw new Error('User not authenticated');

      const maxPosition = widgets.reduce((max, w) => Math.max(max, w.position), -1);
      
      const { data, error } = await supabase
        .from('user_dashboard_widgets')
        .insert({
          user_id: userId,
          widget_type: widgetType,
          position: maxPosition + 1,
          config: WIDGET_REGISTRY[widgetType]?.defaultConfig || {},
          is_visible: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
      toast.success('Widget added successfully');
    },
    onError: () => {
      toast.error('Failed to add widget');
    },
  });

  const removeWidgetMutation = useMutation({
    mutationFn: async (widgetId: string) => {
      const { error } = await supabase
        .from('user_dashboard_widgets')
        .delete()
        .eq('id', widgetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
      toast.success('Widget removed successfully');
    },
    onError: () => {
      toast.error('Failed to remove widget');
    },
  });

  const reorderWidgetsMutation = useMutation({
    mutationFn: async (reorderedWidgets: DashboardWidget[]) => {
      if (!userId) throw new Error('User not authenticated');
      
      const updates = reorderedWidgets.map((widget, index) => ({
        id: widget.id,
        user_id: userId,
        widget_type: widget.widget_type,
        position: index,
        config: widget.config,
        is_visible: widget.is_visible,
      }));

      const { error } = await supabase
        .from('user_dashboard_widgets')
        .upsert(updates);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-widgets'] });
    },
    onError: () => {
      toast.error('Failed to reorder widgets');
    },
  });

  return {
    widgets,
    isLoading,
    addWidget: addWidgetMutation.mutate,
    removeWidget: removeWidgetMutation.mutate,
    reorderWidgets: reorderWidgetsMutation.mutate,
  };
}
