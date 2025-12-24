import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Anomaly } from '@/components/AnomalyDetectionAlert';

interface AnomalyDetectionConfig {
  projectId?: string;
  batchId?: string;
  enabled?: boolean;
  thresholds?: {
    valueDeviationPercent?: number;
    minSampleSize?: number;
  };
}

interface FieldStats {
  fieldName: string;
  values: number[];
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export function useAnomalyDetection(config: AnomalyDetectionConfig) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fieldStats, setFieldStats] = useState<Map<string, FieldStats>>(new Map());

  const { 
    projectId, 
    batchId, 
    enabled = true,
    thresholds = {
      valueDeviationPercent: 50,
      minSampleSize: 5
    }
  } = config;

  // Calculate statistics for a set of numeric values
  const calculateStats = (values: number[]): { mean: number; stdDev: number } => {
    if (values.length === 0) return { mean: 0, stdDev: 0 };
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    return { mean, stdDev };
  };

  // Detect anomalies in a single document
  const detectDocumentAnomalies = useCallback(async (
    documentId: string,
    metadata: Record<string, any>
  ): Promise<Anomaly[]> => {
    const detected: Anomaly[] = [];
    
    // Check numeric fields against historical data
    const numericFields = ['Total', 'Amount', 'Quantity', 'Price', 'Tax'];
    
    for (const field of numericFields) {
      const value = metadata[field] || metadata[field.toLowerCase()];
      if (value === undefined || value === null) continue;
      
      const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
      if (isNaN(numValue)) continue;
      
      const stats = fieldStats.get(field);
      if (!stats || stats.values.length < thresholds.minSampleSize!) continue;
      
      // Check for significant deviation
      const deviation = Math.abs((numValue - stats.mean) / stats.mean) * 100;
      
      if (deviation > thresholds.valueDeviationPercent!) {
        const isSpike = numValue > stats.mean;
        
        detected.push({
          id: `${documentId}-${field}`,
          type: isSpike ? 'value_spike' : 'value_drop',
          severity: deviation > 100 ? 'high' : deviation > 75 ? 'medium' : 'low',
          field,
          currentValue: numValue,
          averageValue: stats.mean,
          expectedRange: {
            min: stats.mean - stats.stdDev * 2,
            max: stats.mean + stats.stdDev * 2
          },
          deviation,
          message: `${field} is ${deviation.toFixed(0)}% ${isSpike ? 'higher' : 'lower'} than average`,
          documentId,
          detectedAt: new Date()
        });
      }
    }
    
    return detected;
  }, [fieldStats, thresholds]);

  // Build baseline statistics from historical documents
  const buildBaseline = useCallback(async () => {
    if (!projectId && !batchId) return;
    
    setIsAnalyzing(true);
    
    try {
      let query = supabase
        .from('documents')
        .select('extracted_metadata')
        .eq('validation_status', 'validated')
        .limit(100);
      
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      if (batchId) {
        query = query.eq('batch_id', batchId);
      }
      
      const { data: documents } = await query;
      
      if (!documents || documents.length < thresholds.minSampleSize!) {
        setIsAnalyzing(false);
        return;
      }
      
      const newStats = new Map<string, FieldStats>();
      const numericFields = ['Total', 'Amount', 'Quantity', 'Price', 'Tax'];
      
      for (const field of numericFields) {
        const values: number[] = [];
        
        for (const doc of documents) {
          const metadata = doc.extracted_metadata as Record<string, any> || {};
          const value = metadata[field] || metadata[field.toLowerCase()];
          if (value === undefined || value === null) continue;
          
          const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          if (!isNaN(numValue)) {
            values.push(numValue);
          }
        }
        
        if (values.length >= thresholds.minSampleSize!) {
          const { mean, stdDev } = calculateStats(values);
          newStats.set(field, {
            fieldName: field,
            values,
            mean,
            stdDev,
            min: Math.min(...values),
            max: Math.max(...values)
          });
        }
      }
      
      setFieldStats(newStats);
    } catch (error) {
      console.error('Failed to build anomaly baseline:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId, batchId, thresholds.minSampleSize]);

  // Analyze current batch for anomalies
  const analyzeCurrentBatch = useCallback(async () => {
    if (!batchId || fieldStats.size === 0) return;
    
    setIsAnalyzing(true);
    
    try {
      const { data: documents } = await supabase
        .from('documents')
        .select('id, extracted_metadata')
        .eq('batch_id', batchId);
      
      if (!documents) return;
      
      const allAnomalies: Anomaly[] = [];
      
      for (const doc of documents) {
        const metadata = doc.extracted_metadata as Record<string, any> || {};
        const docAnomalies = await detectDocumentAnomalies(doc.id, metadata);
        allAnomalies.push(...docAnomalies);
      }
      
      setAnomalies(allAnomalies);
    } catch (error) {
      console.error('Failed to analyze batch:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [batchId, detectDocumentAnomalies, fieldStats]);

  // Build baseline on mount or config change
  useEffect(() => {
    if (enabled) {
      buildBaseline();
    }
  }, [enabled, buildBaseline]);

  // Dismiss an anomaly
  const dismissAnomaly = useCallback((anomalyId: string) => {
    setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
  }, []);

  // Clear all anomalies
  const clearAnomalies = useCallback(() => {
    setAnomalies([]);
  }, []);

  return {
    anomalies,
    isAnalyzing,
    fieldStats,
    buildBaseline,
    analyzeCurrentBatch,
    detectDocumentAnomalies,
    dismissAnomaly,
    clearAnomalies
  };
}
