import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FileSignature, AlertTriangle, CheckCircle, XCircle, 
  Search, Filter, RefreshCw, Eye, ThumbsUp, ThumbsDown,
  BarChart3, Users, FileCheck, Clock, TrendingUp, Loader2,
  ChevronRight, Download, Maximize2
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SignatureRecord {
  id: string;
  document_id: string;
  file_name: string;
  batch_name: string;
  batch_id: string;
  signer_name: string;
  address: string;
  city: string;
  zip: string;
  signature_url?: string;
  similarity_score: number | null;
  authentication_status: string | null;
  voter_match_status: string | null;
  created_at: string;
  needs_review: boolean;
}

interface VerificationStats {
  total: number;
  verified: number;
  rejected: number;
  pending: number;
  avgSimilarity: number;
}

export default function SignatureVerificationHub() {
  const [activeTab, setActiveTab] = useState('queue');
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VerificationStats>({
    total: 0, verified: 0, rejected: 0, pending: 0, avgSimilarity: 0
  });
  const [selectedSignature, setSelectedSignature] = useState<SignatureRecord | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    fetchPetitionProjects();
  }, []);

  useEffect(() => {
    if (selectedProject && selectedProject !== 'all') {
      fetchSignatures();
    } else if (projects.length > 0) {
      // Auto-select first petition project
      const firstPetition = projects[0];
      if (firstPetition) {
        setSelectedProject(firstPetition.id);
      }
    }
  }, [selectedProject, projects]);

  const fetchPetitionProjects = async () => {
    try {
      // Fetch projects that have petition-related extraction fields or document types
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, extraction_fields, metadata')
        .eq('is_active', true);

      if (error) throw error;

      // Filter to petition projects based on extraction fields
      const petitionProjects = (data || []).filter(p => {
        const fields = p.extraction_fields as any[];
        if (!fields) return false;
        return fields.some(f => 
          f.name?.toLowerCase().includes('signer') || 
          f.name?.toLowerCase().includes('signature') ||
          f.name?.toLowerCase().includes('petition')
        );
      });

      setProjects(petitionProjects.map(p => ({ id: p.id, name: p.name })));
      
      if (petitionProjects.length === 0) {
        toast.info('No petition projects found', {
          description: 'Create a project with signature/petition fields to use this hub'
        });
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load petition projects');
    }
  };

  const fetchSignatures = async () => {
    if (!selectedProject || selectedProject === 'all') return;
    
    setLoading(true);
    try {
      // Fetch documents with line items (signatures) from petition batches
      const { data: documents, error } = await supabase
        .from('documents')
        .select(`
          id, file_name, created_at, line_items, 
          signature_similarity_score, signature_authentication_status,
          needs_review, batch_id,
          batches!inner(batch_name, project_id)
        `)
        .eq('batches.project_id', selectedProject)
        .not('line_items', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Transform documents with line items into signature records
      const signatureRecords: SignatureRecord[] = [];
      
      (documents || []).forEach(doc => {
        const lineItems = doc.line_items as any[];
        if (!lineItems?.length) return;

        lineItems.forEach((item, idx) => {
          signatureRecords.push({
            id: `${doc.id}-${idx}`,
            document_id: doc.id,
            file_name: doc.file_name,
            batch_name: (doc.batches as any)?.batch_name || 'Unknown',
            batch_id: doc.batch_id || '',
            signer_name: item.signer_name || item.name || 'Unknown',
            address: item.address || '',
            city: item.city || '',
            zip: item.zip || '',
            signature_url: item.signature_region?.url,
            similarity_score: doc.signature_similarity_score,
            authentication_status: doc.signature_authentication_status || 'pending',
            voter_match_status: item.voter_match_status || 'pending',
            created_at: doc.created_at || new Date().toISOString(),
            needs_review: doc.needs_review || false
          });
        });
      });

      setSignatures(signatureRecords);
      calculateStats(signatureRecords);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      toast.error('Failed to load signatures');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (records: SignatureRecord[]) => {
    const verified = records.filter(r => r.authentication_status === 'verified').length;
    const rejected = records.filter(r => r.authentication_status === 'rejected').length;
    const pending = records.filter(r => !r.authentication_status || r.authentication_status === 'pending').length;
    const scores = records.filter(r => r.similarity_score !== null).map(r => r.similarity_score!);
    const avgSimilarity = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    setStats({
      total: records.length,
      verified,
      rejected,
      pending,
      avgSimilarity: Math.round(avgSimilarity * 100) / 100
    });
  };

  const handleVerify = async (record: SignatureRecord, status: 'verified' | 'rejected') => {
    setVerifying(record.id);
    try {
      // Update the document's signature status
      const { error } = await supabase
        .from('documents')
        .update({
          signature_authentication_status: status,
          needs_review: false,
          validated_at: new Date().toISOString()
        })
        .eq('id', record.document_id);

      if (error) throw error;

      // Update local state
      setSignatures(prev => prev.map(s => 
        s.document_id === record.document_id 
          ? { ...s, authentication_status: status, needs_review: false }
          : s
      ));

      toast.success(`Signature ${status === 'verified' ? 'verified' : 'rejected'}`);
    } catch (error) {
      console.error('Error updating signature:', error);
      toast.error('Failed to update signature status');
    } finally {
      setVerifying(null);
    }
  };

  const runBatchVerification = async () => {
    if (!selectedProject || selectedProject === 'all') {
      toast.error('Please select a project first');
      return;
    }

    toast.info('Starting batch verification...', { duration: 5000 });

    try {
      const { data, error } = await supabase.functions.invoke('validate-voter-registry', {
        body: {
          projectId: selectedProject,
          signatures: signatures.filter(s => s.authentication_status === 'pending').map(s => ({
            name: s.signer_name,
            address: s.address,
            city: s.city,
            zip: s.zip
          }))
        }
      });

      if (error) throw error;

      toast.success(`Batch verification complete`, {
        description: `${data?.found || 0} matches found, ${data?.notFound || 0} not found`
      });
      
      fetchSignatures();
    } catch (error) {
      console.error('Batch verification error:', error);
      toast.error('Batch verification failed');
    }
  };

  const filteredSignatures = signatures.filter(s => {
    const matchesSearch = !searchQuery || 
      s.signer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || s.authentication_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Verified</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  const getSimilarityColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <AdminLayout title="Signature Verification Hub" description="Verify and validate petition signatures">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileSignature className="h-8 w-8 text-primary" />
              Signature Verification Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Verify and validate petition signatures against voter registry
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select petition project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={fetchSignatures} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Signatures</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Similarity</p>
                  <p className="text-2xl font-bold">{(stats.avgSimilarity * 100).toFixed(0)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="queue">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Verification Queue
            </TabsTrigger>
            <TabsTrigger value="all">
              <FileCheck className="h-4 w-4 mr-2" />
              All Signatures
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Signatures Pending Review</CardTitle>
                    <CardDescription>
                      Review and verify signatures that need manual validation
                    </CardDescription>
                  </div>
                  <Button onClick={runBatchVerification} disabled={stats.pending === 0}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Batch Verification
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSignatures.filter(s => s.authentication_status === 'pending' || s.needs_review).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p>No signatures pending review</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSignatures
                      .filter(s => s.authentication_status === 'pending' || s.needs_review)
                      .slice(0, 20)
                      .map(sig => (
                        <div 
                          key={sig.id} 
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                              <FileSignature className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{sig.signer_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {sig.address}, {sig.city} {sig.zip}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sig.batch_name} • {format(new Date(sig.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className={`text-sm font-medium ${getSimilarityColor(sig.similarity_score)}`}>
                                {sig.similarity_score !== null 
                                  ? `${(sig.similarity_score * 100).toFixed(0)}% match`
                                  : 'Not verified'
                                }
                              </p>
                              {getStatusBadge(sig.authentication_status)}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedSignature(sig);
                                  setComparisonOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleVerify(sig, 'verified')}
                                disabled={verifying === sig.id}
                              >
                                {verifying === sig.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ThumbsUp className="h-4 w-4" />
                                )}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleVerify(sig, 'rejected')}
                                disabled={verifying === sig.id}
                              >
                                <ThumbsDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Signatures</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name or address..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-[250px]"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[150px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {filteredSignatures.map(sig => (
                      <div 
                        key={sig.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{sig.signer_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {sig.address}, {sig.city} {sig.zip}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className={`text-sm ${getSimilarityColor(sig.similarity_score)}`}>
                            {sig.similarity_score !== null 
                              ? `${(sig.similarity_score * 100).toFixed(0)}%`
                              : '-'
                            }
                          </span>
                          {getStatusBadge(sig.authentication_status)}
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setSelectedSignature(sig);
                              setComparisonOpen(true);
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Verification Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">Verified</span>
                        <span className="text-sm font-medium text-green-600">
                          {stats.total > 0 ? ((stats.verified / stats.total) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={stats.total > 0 ? (stats.verified / stats.total) * 100 : 0} 
                        className="h-3"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">Rejected</span>
                        <span className="text-sm font-medium text-red-600">
                          {stats.total > 0 ? ((stats.rejected / stats.total) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0} 
                        className="h-3 [&>div]:bg-red-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm">Pending</span>
                        <span className="text-sm font-medium text-yellow-600">
                          {stats.total > 0 ? ((stats.pending / stats.total) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={stats.total > 0 ? (stats.pending / stats.total) * 100 : 0} 
                        className="h-3 [&>div]:bg-yellow-500"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Similarity Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { label: 'High Match (80%+)', min: 0.8, max: 1, color: 'bg-green-500' },
                      { label: 'Medium Match (50-80%)', min: 0.5, max: 0.8, color: 'bg-yellow-500' },
                      { label: 'Low Match (<50%)', min: 0, max: 0.5, color: 'bg-red-500' },
                    ].map(range => {
                      const count = signatures.filter(s => 
                        s.similarity_score !== null && 
                        s.similarity_score >= range.min && 
                        s.similarity_score < range.max
                      ).length;
                      const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                      
                      return (
                        <div key={range.label}>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm">{range.label}</span>
                            <span className="text-sm font-medium">{count} ({percentage.toFixed(1)}%)</span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className={`h-3 [&>div]:${range.color}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Processing Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Processed</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{stats.verified}</p>
                    <p className="text-sm text-muted-foreground">Verified Valid</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
                    <p className="text-sm text-muted-foreground">Rejected</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
                    <p className="text-sm text-muted-foreground">Awaiting Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Signature Comparison Dialog */}
        <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Signature Comparison</DialogTitle>
            </DialogHeader>
            {selectedSignature && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Signer Information</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Name:</strong> {selectedSignature.signer_name}</p>
                      <p><strong>Address:</strong> {selectedSignature.address}</p>
                      <p><strong>City:</strong> {selectedSignature.city}</p>
                      <p><strong>ZIP:</strong> {selectedSignature.zip}</p>
                      <p><strong>Batch:</strong> {selectedSignature.batch_name}</p>
                      <p><strong>Date:</strong> {format(new Date(selectedSignature.created_at), 'PPP')}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Verification Status</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Authentication:</span>
                        {getStatusBadge(selectedSignature.authentication_status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Similarity Score:</span>
                        <span className={`font-medium ${getSimilarityColor(selectedSignature.similarity_score)}`}>
                          {selectedSignature.similarity_score !== null 
                            ? `${(selectedSignature.similarity_score * 100).toFixed(0)}%`
                            : 'Not calculated'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2 text-center">Captured Signature</h4>
                    <div className="bg-muted h-32 rounded flex items-center justify-center">
                      {selectedSignature.signature_url ? (
                        <img 
                          src={selectedSignature.signature_url} 
                          alt="Captured signature" 
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground">No signature image</span>
                      )}
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2 text-center">Reference Signature</h4>
                    <div className="bg-muted h-32 rounded flex items-center justify-center">
                      <span className="text-muted-foreground">No reference available</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setComparisonOpen(false)}>
                    Close
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      handleVerify(selectedSignature, 'verified');
                      setComparisonOpen(false);
                    }}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Verify
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      handleVerify(selectedSignature, 'rejected');
                      setComparisonOpen(false);
                    }}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
