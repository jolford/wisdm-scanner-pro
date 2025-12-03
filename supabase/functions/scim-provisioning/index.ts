import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SCIMUser {
  schemas: string[];
  id?: string;
  userName: string;
  name?: {
    givenName?: string;
    familyName?: string;
    formatted?: string;
  };
  emails?: Array<{ value: string; primary?: boolean; type?: string }>;
  active?: boolean;
  externalId?: string;
  groups?: Array<{ value: string; display?: string }>;
}

interface SCIMListResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: SCIMUser[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Extract bearer token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('SCIM: Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
      });
    }

    const token = authHeader.substring(7);

    // Hash the incoming token to compare with stored hash
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Validate token against scim_configs
    const { data: config, error: configError } = await supabase
      .from('scim_configs')
      .select('*, customers(company_name)')
      .eq('scim_token_hash', tokenHash)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('SCIM: Invalid token or disabled config', configError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.replace('/scim-provisioning', '');
    const method = req.method;

    console.log(`SCIM: ${method} ${path} for customer ${config.customer_id}`);

    // Log sync activity
    const logSync = async (action: string, status: string, details: Record<string, unknown>) => {
      await supabase.from('scim_sync_logs').insert({
        config_id: config.id,
        action,
        status,
        details,
        synced_at: new Date().toISOString()
      });
    };

    // SCIM Users endpoint
    if (path === '/Users' || path.startsWith('/Users/')) {
      const userId = path.replace('/Users/', '').replace('/Users', '');

      // GET /Users - List users
      if (method === 'GET' && !userId) {
        const filter = url.searchParams.get('filter');
        const startIndex = parseInt(url.searchParams.get('startIndex') || '1');
        const count = parseInt(url.searchParams.get('count') || '100');

        let query = supabase
          .from('profiles')
          .select('*', { count: 'exact' });

        // Filter by customer via user_customers
        const { data: customerUsers } = await supabase
          .from('user_customers')
          .select('user_id')
          .eq('customer_id', config.customer_id);

        const userIds = customerUsers?.map(u => u.user_id) || [];

        if (userIds.length > 0) {
          query = query.in('id', userIds);
        } else {
          // No users for this customer
          const response: SCIMListResponse = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: 0,
            startIndex,
            itemsPerPage: count,
            Resources: []
          };
          return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
          });
        }

        // Handle SCIM filter (basic userName filter support)
        if (filter) {
          const match = filter.match(/userName eq "([^"]+)"/);
          if (match) {
            query = query.eq('email', match[1]);
          }
        }

        const { data: profiles, count: totalCount } = await query
          .range(startIndex - 1, startIndex + count - 2);

        const resources: SCIMUser[] = (profiles || []).map(p => ({
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
          id: p.id,
          userName: p.email,
          name: {
            givenName: p.full_name?.split(' ')[0] || '',
            familyName: p.full_name?.split(' ').slice(1).join(' ') || '',
            formatted: p.full_name
          },
          emails: [{ value: p.email, primary: true, type: 'work' }],
          active: true,
          externalId: p.id
        }));

        const response: SCIMListResponse = {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
          totalResults: totalCount || 0,
          startIndex,
          itemsPerPage: count,
          Resources: resources
        };

        await logSync('list_users', 'success', { count: resources.length });

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
        });
      }

      // GET /Users/:id - Get single user
      if (method === 'GET' && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!profile) {
          return new Response(JSON.stringify({ 
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            detail: 'User not found',
            status: 404
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
          });
        }

        const user: SCIMUser = {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
          id: profile.id,
          userName: profile.email,
          name: {
            givenName: profile.full_name?.split(' ')[0] || '',
            familyName: profile.full_name?.split(' ').slice(1).join(' ') || '',
            formatted: profile.full_name
          },
          emails: [{ value: profile.email, primary: true, type: 'work' }],
          active: true,
          externalId: profile.id
        };

        return new Response(JSON.stringify(user), {
          headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
        });
      }

      // POST /Users - Create user
      if (method === 'POST') {
        const body: SCIMUser = await req.json();
        const email = body.userName || body.emails?.[0]?.value;
        const fullName = body.name?.formatted || 
          `${body.name?.givenName || ''} ${body.name?.familyName || ''}`.trim();

        if (!email) {
          return new Response(JSON.stringify({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            detail: 'userName or email is required',
            status: 400
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
          });
        }

        console.log(`SCIM: Creating user ${email}`);

        // Create user in Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, provisioned_by: 'scim' }
        });

        if (authError) {
          console.error('SCIM: Error creating auth user', authError);
          await logSync('create_user', 'error', { email, error: authError.message });

          // Check if user already exists
          if (authError.message.includes('already been registered')) {
            return new Response(JSON.stringify({
              schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
              detail: 'User already exists',
              status: 409
            }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
            });
          }

          return new Response(JSON.stringify({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            detail: authError.message,
            status: 500
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
          });
        }

        // Link user to customer
        await supabase.from('user_customers').insert({
          user_id: authUser.user.id,
          customer_id: config.customer_id
        });

        // Assign default role
        if (config.default_role) {
          await supabase.from('user_roles').insert({
            user_id: authUser.user.id,
            role: config.default_role
          });
        }

        await logSync('create_user', 'success', { email, user_id: authUser.user.id });

        // Update last sync
        await supabase
          .from('scim_configs')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id);

        const response: SCIMUser = {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
          id: authUser.user.id,
          userName: email,
          name: {
            givenName: body.name?.givenName || '',
            familyName: body.name?.familyName || '',
            formatted: fullName
          },
          emails: [{ value: email, primary: true, type: 'work' }],
          active: true,
          externalId: body.externalId || authUser.user.id
        };

        return new Response(JSON.stringify(response), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
        });
      }

      // PATCH /Users/:id - Update user
      if (method === 'PATCH' && userId) {
        const body = await req.json();
        const operations = body.Operations || [];

        console.log(`SCIM: Updating user ${userId}`, operations);

        for (const op of operations) {
          if (op.op === 'replace' && op.path === 'active' && op.value === false) {
            // Deactivate user
            const { error } = await supabase.auth.admin.updateUserById(userId, {
              ban_duration: '876000h' // ~100 years = effectively disabled
            });

            if (error) {
              console.error('SCIM: Error deactivating user', error);
              await logSync('deactivate_user', 'error', { user_id: userId, error: error.message });
            } else {
              await logSync('deactivate_user', 'success', { user_id: userId });
            }
          } else if (op.op === 'replace' && op.path === 'active' && op.value === true) {
            // Reactivate user
            const { error } = await supabase.auth.admin.updateUserById(userId, {
              ban_duration: 'none'
            });

            if (error) {
              console.error('SCIM: Error reactivating user', error);
              await logSync('reactivate_user', 'error', { user_id: userId, error: error.message });
            } else {
              await logSync('reactivate_user', 'success', { user_id: userId });
            }
          }
        }

        // Update last sync
        await supabase
          .from('scim_configs')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id);

        // Return updated user
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        const user: SCIMUser = {
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
          id: userId,
          userName: profile?.email || '',
          name: { formatted: profile?.full_name || '' },
          emails: profile ? [{ value: profile.email, primary: true }] : [],
          active: true
        };

        return new Response(JSON.stringify(user), {
          headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
        });
      }

      // DELETE /Users/:id - Delete user
      if (method === 'DELETE' && userId) {
        console.log(`SCIM: Deleting user ${userId}`);

        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) {
          console.error('SCIM: Error deleting user', error);
          await logSync('delete_user', 'error', { user_id: userId, error: error.message });

          return new Response(JSON.stringify({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            detail: error.message,
            status: 500
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
          });
        }

        await logSync('delete_user', 'success', { user_id: userId });

        // Update last sync
        await supabase
          .from('scim_configs')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id);

        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }
    }

    // ServiceProviderConfig endpoint (required for SCIM discovery)
    if (path === '/ServiceProviderConfig') {
      return new Response(JSON.stringify({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        documentationUri: 'https://docs.example.com/scim',
        patch: { supported: true },
        bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
        filter: { supported: true, maxResults: 100 },
        changePassword: { supported: false },
        sort: { supported: false },
        etag: { supported: false },
        authenticationSchemes: [{
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication using OAuth Bearer Token'
        }]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
      });
    }

    // ResourceTypes endpoint
    if (path === '/ResourceTypes') {
      return new Response(JSON.stringify({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: 1,
        Resources: [{
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
          id: 'User',
          name: 'User',
          endpoint: '/Users',
          schema: 'urn:ietf:params:scim:schemas:core:2.0:User'
        }]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
      });
    }

    // Schemas endpoint
    if (path === '/Schemas') {
      return new Response(JSON.stringify({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: 1,
        Resources: [{
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:Schema'],
          id: 'urn:ietf:params:scim:schemas:core:2.0:User',
          name: 'User',
          description: 'User Account'
        }]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
      });
    }

    return new Response(JSON.stringify({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Endpoint not found',
      status: 404
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
    });

  } catch (error) {
    console.error('SCIM: Unexpected error', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: message,
      status: 500
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/scim+json' }
    });
  }
});
