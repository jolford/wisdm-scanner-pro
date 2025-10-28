# Collaboration & Analytics Features

## Overview
This document describes the new collaboration, audit, and analytics features implemented in the WISDM document validation system.

## 1. Document Locking & Real-Time Presence

### Database
- **Table**: `document_locks`
- **Features**:
  - Prevents simultaneous edits by multiple users
  - Automatic lock expiration after 10 minutes
  - Auto-renewal every 5 minutes while editing
  - Session-based tracking

### Implementation
- **Hook**: `useDocumentLock(documentId)`
  - `acquireLock()` - Acquire edit lock
  - `releaseLock()` - Release edit lock
  - `isLocked` - Lock status
  - `lockedBy` - User information
  - `hasLock` - Current user has lock

- **Component**: `DocumentLockIndicator`
  - Visual badge showing lock status
  - Tooltip with editor information

### Usage
```typescript
import { useDocumentLock } from '@/hooks/use-document-lock';
import { DocumentLockIndicator } from '@/components/DocumentLockIndicator';

const { isLocked, lockedBy, hasLock, acquireLock, releaseLock } = useDocumentLock(documentId);

// Acquire lock before editing
const handleEdit = async () => {
  const acquired = await acquireLock();
  if (acquired) {
    // Start editing
  }
};

// Show lock indicator
<DocumentLockIndicator isLocked={isLocked} lockedBy={lockedBy} hasLock={hasLock} />
```

## 2. Document Comments & Notes

### Database
- **Table**: `document_comments`
- **Features**:
  - Add notes to documents
  - Flag documents for admin review
  - Resolve comments
  - Real-time updates via Supabase Realtime

### Component
- **Component**: `DocumentCommentsPanel`
- **Features**:
  - Add comments with optional flag for review
  - View all comments with timestamps
  - Resolve comments (user's own or admin)
  - Badge indicators for unresolved/flagged comments
  - Real-time synchronization

### Usage
```typescript
import { DocumentCommentsPanel } from '@/components/DocumentCommentsPanel';

<DocumentCommentsPanel documentId={documentId} />
```

## 3. Field Change History

### Database
- **Table**: `field_changes`
- **Features**:
  - Track all field-level changes
  - Store old and new values
  - Record change type (create, update, delete)
  - Capture validation status at time of change
  - Link to user who made the change

### Function
- **Function**: `track_field_change()`
- **Parameters**:
  - `document_id` - Document ID
  - `field_name` - Name of changed field
  - `old_value` - Previous value
  - `new_value` - New value
  - `change_type` - 'create', 'update', or 'delete'

### Component
- **Component**: `FieldChangeHistory`
- **Features**:
  - Timeline view of all changes
  - Color-coded by change type
  - Shows old vs new values for updates
  - User information and timestamps
  - Real-time updates

### Usage
```typescript
import { FieldChangeHistory } from '@/components/FieldChangeHistory';

// Display history
<FieldChangeHistory documentId={documentId} />

// Track a change (call from your document editing logic)
await supabase.rpc('track_field_change', {
  _document_id: documentId,
  _field_name: 'invoice_number',
  _old_value: '12345',
  _new_value: '12346',
  _change_type: 'update'
});
```

## 4. Validation Analytics Dashboard

### Database
- **Table**: `validation_analytics`
- **Metrics Tracked**:
  - Documents validated/rejected per day/hour
  - Average validation time
  - Field-level error tracking
  - Per-user productivity metrics
  - Per-project metrics

### Page
- **Route**: `/admin/validation-analytics`
- **Features**:
  - **Summary Cards**:
    - Total validated documents
    - Total rejected documents
    - Average time per document
    - Overall accuracy percentage
  
  - **User Productivity**:
    - Validated vs rejected by user
    - Accuracy percentage per user
    - Ranked leaderboard

  - **Error-Prone Fields**:
    - Top 10 fields with most corrections
    - Visual bar chart representation
    - Error frequency counts

  - **Filters**:
    - Time range (7, 30, 90 days)
    - Project selection

### Analytics Tracking
To populate analytics data, you should call this when validating/rejecting documents:

```typescript
// Insert analytics record
await supabase.from('validation_analytics').insert({
  customer_id: customerId,
  project_id: projectId,
  document_type: documentType,
  user_id: userId,
  validation_date: new Date().toISOString().split('T')[0],
  validation_hour: new Date().getHours(),
  documents_validated: validatedCount,
  documents_rejected: rejectedCount,
  avg_time_seconds: avgTime,
  total_time_seconds: totalTime,
  field_errors: { 
    'field_name': errorCount 
  }
});
```

## Integration Guide

### 1. Add to Validation Screen

```typescript
import { useDocumentLock } from '@/hooks/use-document-lock';
import { DocumentLockIndicator } from '@/components/DocumentLockIndicator';
import { DocumentCommentsPanel } from '@/components/DocumentCommentsPanel';
import { FieldChangeHistory } from '@/components/FieldChangeHistory';

function ValidationScreen({ documentId }) {
  const { isLocked, lockedBy, hasLock, acquireLock, releaseLock } = useDocumentLock(documentId);

  useEffect(() => {
    // Try to acquire lock when component mounts
    acquireLock();
    return () => releaseLock(); // Release on unmount
  }, []);

  return (
    <div>
      <DocumentLockIndicator isLocked={isLocked} lockedBy={lockedBy} hasLock={hasLock} />
      
      {/* Only allow editing if we have the lock */}
      {hasLock && <DocumentEditor />}
      {!hasLock && <p>Document is locked by {lockedBy?.full_name}</p>}
      
      {/* Side panels */}
      <DocumentCommentsPanel documentId={documentId} />
      <FieldChangeHistory documentId={documentId} />
    </div>
  );
}
```

### 2. Track Field Changes

When updating document metadata:

```typescript
const handleFieldUpdate = async (fieldName: string, oldValue: string, newValue: string) => {
  // Update the document
  await supabase
    .from('documents')
    .update({ [`extracted_metadata.${fieldName}`]: newValue })
    .eq('id', documentId);

  // Track the change
  await supabase.rpc('track_field_change', {
    _document_id: documentId,
    _field_name: fieldName,
    _old_value: oldValue,
    _new_value: newValue,
    _change_type: 'update'
  });
};
```

### 3. Record Analytics

After validation/rejection:

```typescript
const recordValidationMetric = async (validated: boolean, timeSpent: number) => {
  const { data: customer } = await supabase
    .from('projects')
    .select('customer_id')
    .eq('id', projectId)
    .single();

  await supabase.from('validation_analytics').upsert({
    customer_id: customer.customer_id,
    project_id: projectId,
    document_type: documentType,
    user_id: userId,
    validation_date: new Date().toISOString().split('T')[0],
    validation_hour: new Date().getHours(),
    documents_validated: validated ? 1 : 0,
    documents_rejected: validated ? 0 : 1,
    avg_time_seconds: timeSpent,
    total_time_seconds: timeSpent,
  }, {
    onConflict: 'customer_id,project_id,validation_date,validation_hour'
  });
};
```

## Security Considerations

All features include proper RLS policies:
- Users can only view/edit documents in their customer's projects
- Admins can resolve any comments
- Analytics are tenant-isolated
- Locks are session-based and automatically expire

## Performance Optimizations

- **Indexes**: Added on all foreign keys and frequently queried columns
- **Real-time**: Uses Supabase channels for instant updates
- **Lock Cleanup**: Automatic cleanup function for expired locks
- **Aggregation**: Analytics pre-aggregated by date/hour

## Future Enhancements

Potential improvements:
- Presence indicators showing all users viewing a batch
- @ mentions in comments
- Comment threading/replies
- Export audit reports as PDF/Excel
- Real-time collaboration cursors
- Advanced analytics dashboards with charts
