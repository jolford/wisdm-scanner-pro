/**
 * Process Scheduled Exports Edge Function
 * 
 * This function processes scheduled exports by:
 * 1. Finding active schedules that should run now
 * 2. Checking their frequency (daily/weekly/monthly) and time
 * 3. Exporting validated batches for matching projects
 * 4. Updating the schedule's last_run_at and next_run_at timestamps
 * 
 * To automate this function, set up a pg_cron job:
 * 
 * SELECT cron.schedule(
 *   'process-scheduled-exports',
 *   '* * * * *',  -- Every minute (adjust as needed)
 *   $$
 *   SELECT net.http_post(
 *     url:='https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/process-scheduled-exports',
 *     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
 *   ) as request_id;
 *   $$
 * );
 * 
 * Or call it manually via the Supabase client:
 * supabase.functions.invoke('process-scheduled-exports')
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting scheduled export processing...');

    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, '0');
    const currentMinute = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}:00`;
    const currentDayOfWeek = now.getDay();
    const currentDayOfMonth = now.getDate();

    console.log(`Current time: ${currentTime}, Day of week: ${currentDayOfWeek}, Day of month: ${currentDayOfMonth}`);

    // Find all active schedules (we'll filter by time in code for flexibility)
    const { data: schedules, error: schedulesError } = await supabase
      .from('scheduled_exports')
      .select(`
        *,
        projects (
          id,
          name,
          export_types,
          metadata,
          customer_id
        )
      `)
      .eq('is_active', true);

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} potential schedules`);

    const processedSchedules: string[] = [];
    const errors: any[] = [];

    for (const schedule of schedules || []) {
      try {
        // Check if schedule time matches current time (within 2-minute window)
        const scheduleTime = schedule.time_of_day?.slice(0, 5); // HH:MM
        const currentTimeShort = currentTime.slice(0, 5); // HH:MM
        
        // Parse times for comparison
        const [schedHour, schedMin] = scheduleTime?.split(':').map(Number) || [0, 0];
        const [currHour, currMin] = currentTime.split(':').map(Number);
        
        const scheduleMinutes = schedHour * 60 + schedMin;
        const currentMinutes = currHour * 60 + currMin;
        
        // Allow 2-minute window for execution
        const timeDiff = Math.abs(scheduleMinutes - currentMinutes);
        if (timeDiff > 2) {
          continue;
        }

        console.log(`Schedule ${schedule.id} matches current time window`);

        // Check if schedule should run based on frequency
        let shouldRun = false;

        if (schedule.frequency === 'daily') {
          shouldRun = true;
        } else if (schedule.frequency === 'weekly' && schedule.day_of_week === currentDayOfWeek) {
          shouldRun = true;
        } else if (schedule.frequency === 'monthly' && schedule.day_of_month === currentDayOfMonth) {
          shouldRun = true;
        }

        if (!shouldRun) {
          console.log(`Schedule ${schedule.id} frequency check failed`);
          continue;
        }

        // Check if already ran recently (within last hour to prevent duplicates)
        if (schedule.last_run_at) {
          const lastRun = new Date(schedule.last_run_at);
          const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          if (lastRun > hourAgo) {
            console.log(`Schedule ${schedule.id} already ran recently`);
            continue;
          }
        }

        console.log(`Processing schedule ${schedule.id} for project ${schedule.project_id}`);

        // Get completed batches ready for export
        const { data: batches, error: batchesError } = await supabase
          .from('batches')
          .select('id, batch_name')
          .eq('project_id', schedule.project_id)
          .eq('status', 'complete')
          .is('exported_at', null)
          .limit(10);

        if (batchesError) throw batchesError;

        console.log(`Found ${batches?.length || 0} batches to export`);

        // Trigger export for each batch
        for (const batch of batches || []) {
          console.log(`Exporting batch ${batch.id}`);
          
          const { error: exportError } = await supabase.functions.invoke('auto-export-batch', {
            body: { batchId: batch.id }
          });

          if (exportError) {
            console.error(`Error exporting batch ${batch.id}:`, exportError);
            errors.push({ batchId: batch.id, error: exportError.message });
          }
        }

        // Update schedule
        const nextRun = new Date(now);
        if (schedule.frequency === 'daily') {
          nextRun.setDate(nextRun.getDate() + 1);
        } else if (schedule.frequency === 'weekly') {
          nextRun.setDate(nextRun.getDate() + 7);
        } else if (schedule.frequency === 'monthly') {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }

        await supabase
          .from('scheduled_exports')
          .update({
            last_run_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
          })
          .eq('id', schedule.id);

        processedSchedules.push(schedule.id);
        console.log(`Successfully processed schedule ${schedule.id}`);
      } catch (error: any) {
        console.error(`Error processing schedule ${schedule.id}:`, error);
        errors.push({ scheduleId: schedule.id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedSchedules.length,
        schedules: processedSchedules,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in process-scheduled-exports:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to process scheduled exports',
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
