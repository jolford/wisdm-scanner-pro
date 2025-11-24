import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, TrendingUp, BookOpen, Database, ArrowLeft, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function MLLearning() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [learningData, setLearningData] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [confidenceTrends, setConfidenceTrends] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load field learning data
      const { data: learning, error: learningError } = await supabase
        .from("field_learning_data")
        .select("*")
        .order("correction_count", { ascending: false })
        .limit(50);

      if (learningError) throw learningError;
      setLearningData(learning || []);

      // Load ML templates
      const { data: templatesData, error: templatesError } = await supabase
        .from("ml_document_templates")
        .select("*")
        .order("accuracy_rate", { ascending: false });

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

      // Load confidence trends (extract from extraction_confidence)
      const { data: trends, error: trendsError } = await supabase
        .from("extraction_confidence")
        .select("field_name, confidence_score, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (trendsError) throw trendsError;

      // Process trends data
      const trendsByField = (trends || []).reduce((acc: any, item) => {
        if (!acc[item.field_name]) {
          acc[item.field_name] = [];
        }
        acc[item.field_name].push({
          date: new Date(item.created_at).toLocaleDateString(),
          confidence: Math.round(item.confidence_score * 100),
        });
        return acc;
      }, {});

      setConfidenceTrends(trendsByField);
    } catch (error: any) {
      console.error("Error loading ML data:", error);
      toast({
        title: "Error",
        description: "Failed to load ML learning data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFieldColor = (field: string) => {
    const colors: Record<string, string> = {
      "Invoice Number": "#3b82f6",
      "Invoice Date": "#8b5cf6",
      "Invoice Total": "#10b981",
      "Vendor Name": "#f59e0b",
      "PO Number": "#ef4444",
    };
    return colors[field] || "#6b7280";
  };

  return (
    <AdminLayout title="ML Learning Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Brain className="h-8 w-8 text-primary" />
                ML Learning Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Monitor machine learning performance and training progress
              </p>
            </div>
          </div>
          <Button onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Corrections</p>
                <h3 className="text-2xl font-bold mt-1">
                  {learningData.reduce((sum, item) => sum + (item.correction_count || 0), 0)}
                </h3>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fields Learned</p>
                <h3 className="text-2xl font-bold mt-1">{learningData.length}</h3>
              </div>
              <Database className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ML Templates</p>
                <h3 className="text-2xl font-bold mt-1">{templates.length}</h3>
              </div>
              <Brain className="h-8 w-8 text-purple-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Accuracy</p>
                <h3 className="text-2xl font-bold mt-1">
                  {templates.length > 0
                    ? Math.round(
                        (templates.reduce((sum, t) => sum + (t.accuracy_rate || 0), 0) /
                          templates.length) *
                          100
                      ) + "%"
                    : "N/A"}
                </h3>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </Card>
        </div>

        <Tabs defaultValue="corrections" className="space-y-4">
          <TabsList>
            <TabsTrigger value="corrections">Correction History</TabsTrigger>
            <TabsTrigger value="templates">ML Templates</TabsTrigger>
            <TabsTrigger value="trends">Confidence Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="corrections" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Corrections</h3>
              <div className="space-y-2">
                {learningData.slice(0, 20).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.field_name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.original_value && (
                          <span className="line-through text-red-500 mr-2">
                            {item.original_value}
                          </span>
                        )}
                        <span className="text-green-500">{item.corrected_value}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">
                        {item.correction_count} {item.correction_count === 1 ? "time" : "times"}
                      </Badge>
                      <Badge
                        variant={
                          item.confidence_score >= 0.9
                            ? "default"
                            : item.confidence_score >= 0.7
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {Math.round((item.confidence_score || 0) * 100)}% confidence
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">ML Document Templates</h3>
              <div className="space-y-2">
                {templates.map((template) => (
                  <div key={template.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium">{template.template_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {template.document_type}
                        </div>
                      </div>
                      <Badge
                        variant={template.is_active ? "default" : "secondary"}
                        className={!template.is_active ? "opacity-50" : ""}
                      >
                        {template.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Accuracy:</span>
                        <span className="font-medium ml-2">
                          {Math.round((template.accuracy_rate || 0) * 100)}%
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Training Samples:</span>
                        <span className="font-medium ml-2">
                          {template.training_data_count || 0}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Updated: {new Date(template.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Confidence Score Trends</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  {Object.entries(confidenceTrends).map(([field, data]: any) => (
                    <Line
                      key={field}
                      type="monotone"
                      data={data}
                      dataKey="confidence"
                      stroke={getFieldColor(field)}
                      name={field}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Field Accuracy Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={learningData
                    .slice(0, 10)
                    .map((item) => ({
                      field: item.field_name,
                      confidence: Math.round((item.confidence_score || 0) * 100),
                      corrections: item.correction_count,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="field" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="confidence" fill="#8884d8" name="Confidence %" />
                  <Bar
                    yAxisId="right"
                    dataKey="corrections"
                    fill="#82ca9d"
                    name="Corrections"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
