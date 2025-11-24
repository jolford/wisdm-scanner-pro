import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, GitBranch, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export default function SmartRouting() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [highConfidenceThreshold, setHighConfidenceThreshold] = useState(90);
  const [mediumConfidenceThreshold, setMediumConfidenceThreshold] = useState(70);
  const [autoValidateEnabled, setAutoValidateEnabled] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's customer_id
      const { data: userCustomers } = await supabase
        .from("user_customers")
        .select("customer_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!userCustomers?.customer_id) {
        throw new Error("No customer found");
      }

      // Check if config exists
      const { data: existing } = await supabase
        .from("routing_config")
        .select("id")
        .eq("customer_id", userCustomers.customer_id)
        .maybeSingle();

      if (existing) {
        // Update existing config
        const { error } = await supabase
          .from("routing_config")
          .update({
            enabled,
            high_confidence_threshold: highConfidenceThreshold,
            medium_confidence_threshold: mediumConfidenceThreshold,
            auto_validate_enabled: autoValidateEnabled,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from("routing_config")
          .insert({
            customer_id: userCustomers.customer_id,
            enabled,
            high_confidence_threshold: highConfidenceThreshold,
            medium_confidence_threshold: mediumConfidenceThreshold,
            auto_validate_enabled: autoValidateEnabled,
          });

        if (error) throw error;
      }

      toast({
        title: "Configuration Saved",
        description: "Smart routing settings have been updated successfully",
      });
    } catch (error: any) {
      console.error("Error saving configuration:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save routing configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's customer_id
        const { data: userCustomers } = await supabase
          .from("user_customers")
          .select("customer_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (!userCustomers?.customer_id) return;

        // Load routing config
        const { data: config } = await supabase
          .from("routing_config")
          .select("*")
          .eq("customer_id", userCustomers.customer_id)
          .maybeSingle();

        if (config) {
          setEnabled(config.enabled ?? true);
          setHighConfidenceThreshold(config.high_confidence_threshold ?? 90);
          setMediumConfidenceThreshold(config.medium_confidence_threshold ?? 70);
          setAutoValidateEnabled(config.auto_validate_enabled ?? false);
        }
      } catch (error) {
        console.error("Error loading config:", error);
      }
    };

    loadConfig();
  }, []);

  return (
    <AdminLayout title="Smart Document Routing">
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
                <GitBranch className="h-8 w-8 text-primary" />
                Smart Document Routing
              </h1>
              <p className="text-muted-foreground mt-1">
                Automatically route documents based on confidence scores
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        </div>

        {/* Status Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Smart Routing Status</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {enabled
                  ? "Documents are automatically routed based on confidence scores"
                  : "All documents go to the standard validation queue"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="routing-enabled">Enable Smart Routing</Label>
              <Switch
                id="routing-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
          </div>
        </Card>

        {/* Routing Rules */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <h3 className="font-semibold">High Confidence</h3>
                <p className="text-sm text-muted-foreground">Auto-validate eligible</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Confidence Threshold</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Slider
                    value={[highConfidenceThreshold]}
                    onValueChange={(value) => setHighConfidenceThreshold(value[0])}
                    min={80}
                    max={100}
                    step={1}
                    className="flex-1"
                    disabled={!enabled}
                  />
                  <span className="text-sm font-medium w-12 text-right">
                    {highConfidenceThreshold}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="auto-validate" className="text-sm">
                  Auto-validate documents
                </Label>
                <Switch
                  id="auto-validate"
                  checked={autoValidateEnabled}
                  onCheckedChange={setAutoValidateEnabled}
                  disabled={!enabled}
                />
              </div>
              <div className="text-sm text-muted-foreground pt-2">
                Documents with confidence ≥ {highConfidenceThreshold}% will
                {autoValidateEnabled ? " be automatically validated" : " go to high-priority queue"}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-6 w-6 text-blue-500" />
              <div>
                <h3 className="font-semibold">Medium Confidence</h3>
                <p className="text-sm text-muted-foreground">Standard validation</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Confidence Threshold</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Slider
                    value={[mediumConfidenceThreshold]}
                    onValueChange={(value) => setMediumConfidenceThreshold(value[0])}
                    min={50}
                    max={90}
                    step={1}
                    className="flex-1"
                    disabled={!enabled}
                  />
                  <span className="text-sm font-medium w-12 text-right">
                    {mediumConfidenceThreshold}%
                  </span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground pt-2">
                Documents with confidence between {mediumConfidenceThreshold}% and{" "}
                {highConfidenceThreshold}% will go to the standard validation queue
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-orange-500" />
              <div>
                <h3 className="font-semibold">Low Confidence</h3>
                <p className="text-sm text-muted-foreground">Manual review required</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Automatic Threshold</Label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-1 h-2 bg-muted rounded-full" />
                  <span className="text-sm font-medium w-12 text-right">
                    &lt; {mediumConfidenceThreshold}%
                  </span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground pt-2">
                Documents with confidence &lt; {mediumConfidenceThreshold}% will go to the review
                queue for manual validation
              </div>
            </div>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">How Smart Routing Works</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              When a document is processed by the OCR engine, it receives a confidence score
              indicating the reliability of the extracted data.
            </p>
            <p>
              Smart routing automatically directs documents to different queues based on these
              confidence scores:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>High confidence (≥{highConfidenceThreshold}%)</strong>:{" "}
                {autoValidateEnabled
                  ? "Automatically validated and sent to export queue"
                  : "Sent to high-priority validation queue for quick approval"}
              </li>
              <li>
                <strong>
                  Medium confidence ({mediumConfidenceThreshold}%-{highConfidenceThreshold}%)
                </strong>
                : Routed to standard validation queue for manual review
              </li>
              <li>
                <strong>Low confidence (&lt;{mediumConfidenceThreshold}%)</strong>: Flagged for
                detailed manual review with highlighted uncertain fields
              </li>
            </ul>
            <p className="pt-2">
              This reduces manual validation work by 30-40% for high-confidence documents while
              ensuring quality control for uncertain extractions.
            </p>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
