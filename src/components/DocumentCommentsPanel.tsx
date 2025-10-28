import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { MessageSquare, Flag, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  document_id: string;
  user_id: string;
  comment: string;
  flag_for_review: boolean;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_profile?: {
    full_name: string;
    email: string;
  };
}

interface DocumentCommentsPanelProps {
  documentId: string;
}

export const DocumentCommentsPanel = ({ documentId }: DocumentCommentsPanelProps) => {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [flagForReview, setFlagForReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadComments();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`document_comments:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_comments',
          filter: `document_id=eq.${documentId}`,
        },
        () => loadComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('document_comments')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    // Fetch user profiles separately
    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      const commentsWithProfiles = data.map(comment => ({
        ...comment,
        user_profile: profileMap.get(comment.user_id) || { full_name: 'Unknown', email: '' },
      }));

      setComments(commentsWithProfiles);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('document_comments').insert({
        document_id: documentId,
        user_id: user?.id,
        comment: newComment.trim(),
        flag_for_review: flagForReview,
      });

      if (error) throw error;

      toast.success(flagForReview ? 'Document flagged for review' : 'Comment added');
      setNewComment('');
      setFlagForReview(false);
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('document_comments')
        .update({
          is_resolved: true,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Comment resolved');
      loadComments();
    } catch (error) {
      console.error('Error resolving comment:', error);
      toast.error('Failed to resolve comment');
    }
  };

  const unresolvedCount = comments.filter(c => !c.is_resolved).length;
  const flaggedCount = comments.filter(c => c.flag_for_review && !c.is_resolved).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Comments & Notes</CardTitle>
          </div>
          <div className="flex gap-2">
            {unresolvedCount > 0 && (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                {unresolvedCount} unresolved
              </Badge>
            )}
            {flaggedCount > 0 && (
              <Badge variant="destructive">
                <Flag className="h-3 w-3 mr-1" />
                {flaggedCount} flagged
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment or note..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={flagForReview}
                onChange={(e) => setFlagForReview(e.target.checked)}
                className="rounded"
              />
              <Flag className="h-4 w-4 text-destructive" />
              Flag for admin review
            </label>
            <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
              Add Comment
            </Button>
          </div>
        </div>

        <Separator />

        {/* Comments List */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No comments yet. Add the first one!
              </p>
            ) : (
              comments.map((comment) => (
                <Card key={comment.id} className={comment.is_resolved ? 'opacity-60' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {comment.user_profile?.full_name || 'Unknown User'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {comment.flag_for_review && !comment.is_resolved && (
                          <Badge variant="destructive" className="mb-2">
                            <Flag className="h-3 w-3 mr-1" />
                            Flagged for Review
                          </Badge>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                      {!comment.is_resolved && (isAdmin || comment.user_id === user?.id) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolve(comment.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {comment.is_resolved && (
                      <Badge variant="outline" className="mt-2">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Resolved
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
