import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the admin user making the request
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Check if the authenticated user is an admin
    const { data: adminUser, error: adminError } = await supabaseClient
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (adminError || !adminUser || adminUser.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required')
    }

    const { auth_user_id, new_password } = await req.json()

    if (!auth_user_id || !new_password) {
      throw new Error('Missing required fields: auth_user_id and new_password')
    }

    if (new_password.length < 6) {
      throw new Error('Password must be at least 6 characters long')
    }

    // Reset the user's password using the admin client
    const { data, error } = await supabaseClient.auth.admin.updateUserById(
      auth_user_id,
      { password: new_password }
    )

    if (error) {
      console.error('Error resetting password:', error)
      throw new Error(`Failed to reset password: ${error.message}`)
    }

    console.log(`Password reset successfully for user: ${auth_user_id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password reset successfully',
        user_id: auth_user_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Password reset error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})